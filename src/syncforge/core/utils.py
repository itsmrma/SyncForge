import importlib.util
import os
import queue
import sys
import threading
import uuid
from pathlib import Path

from syncforge.core.processes import start_process, stop_process_tree
from syncforge.core.tasks import check_cancelled, current_task

# Check for math libraries without loading them into memory
HAS_SCIPY = importlib.util.find_spec('scipy') is not None and importlib.util.find_spec('numpy') is not None

_ask_directory_callback = None
_ask_input_callback = None


def set_ask_input_callback(callback):
    global _ask_input_callback
    _ask_input_callback = callback


def ask_user(prompt, **options):
    check_cancelled()
    if _ask_input_callback:
        return _ask_input_callback(prompt, **options)
    return input(prompt)
def set_ask_directory_callback(callback):
    global _ask_directory_callback
    _ask_directory_callback = callback

def ask_directory(caption=""):
    check_cancelled()
    if _ask_directory_callback:
        return _ask_directory_callback(caption)
    return input(f"{caption}: ").strip()

_ask_matcher_callback = None
def set_ask_matcher_callback(callback):
    global _ask_matcher_callback
    _ask_matcher_callback = callback

def match_files(targets, sources):
    check_cancelled()
    if _ask_matcher_callback:
        return _ask_matcher_callback(targets, sources)
    return []

def get_files_recursive(folder, extensions):
    """Recursively finds files and normalizes paths for Windows."""
    found_files = []
    normalized_folder = os.path.abspath(os.path.normpath(folder))
    
    for root, dirs, files in os.walk(normalized_folder):
        check_cancelled()
        for file in files:
            if file.lower().endswith(extensions):
                full_path = os.path.abspath(os.path.normpath(os.path.join(root, file)))
                found_files.append(full_path)
    found_files.sort()
    return found_files

def get_track_signature(tracks):
    """Creates a unique text signature based on the structure of a file's audio/sub tracks."""
    sig_parts = []
    for t in tracks:
        if t['type'] in ('audio', 'subtitles'):
            lang = t.get('properties', {}).get('language', 'und')
            codec = t.get('codec', 'Unknown')
            sig_parts.append(f"{t['id']}_{t['type']}_{lang}_{codec}")
    return "|".join(sig_parts)


def parse_track_selection(selection, tracks):
    """Validate track IDs before constructing commands which can remove tracks."""
    if selection == 'n':
        return []
    if not selection:
        return [track['id'] for track in tracks]
    try:
        ids = [int(value.strip()) for value in selection.split(',')]
    except ValueError:
        raise ValueError("Track IDs must be comma-separated whole numbers.") from None
    valid_ids = {track['id'] for track in tracks}
    if not set(ids).issubset(valid_ids):
        raise ValueError("The selection contains a track ID that is not available.")
    return list(dict.fromkeys(ids))

def run_subprocess(cmd, cwd=None):
    """Runs a subprocess, captures output real-time, and prevents cmd window on Windows."""
    import subprocess
    cmd = list(cmd)
    tool = os.path.splitext(os.path.basename(cmd[0]))[0].lower()
    if tool == 'ffsubsync':
        if getattr(sys, 'frozen', False):
            cmd = [sys.executable, '--ffsubsync', *cmd[1:]]
        else:
            cmd = [sys.executable, '-m', 'syncforge', '--ffsubsync', *cmd[1:]]
    output = None
    staged = None
    if tool == 'mkvmerge' and '-o' in cmd:
        index = cmd.index('-o') + 1
        if Path(cmd[index]).suffix.lower() == '.mkv':
            output = Path(cmd[index])
            if not output.is_absolute():
                output = Path(cwd or os.getcwd()) / output
            staged = output.with_name(f'.syncforge-part-{uuid.uuid4().hex}.mkv')
            cmd[index] = str(staged)
    process = None
    reader = None
    try:
        process = start_process(cmd, cwd=cwd, bundled=tool == 'ffsubsync')
        lines = queue.Queue()

        def read_output():
            try:
                for line in process.stdout:
                    lines.put(line)
            finally:
                lines.put(None)

        reader = threading.Thread(target=read_output, daemon=True)
        reader.start()
        while True:
            # In-place metadata edits finish their short write before stopping.
            if tool != 'mkvpropedit':
                check_cancelled()
            try:
                line = lines.get(timeout=0.1)
            except queue.Empty:
                continue
            if line is None:
                break
            print(line, end='')
        while True:
            if tool != 'mkvpropedit':
                check_cancelled()
            try:
                returncode = process.wait(timeout=0.1)
                break
            except subprocess.TimeoutExpired:
                continue
        if tool != 'mkvpropedit':
            check_cancelled()
        if returncode not in ((0, 1) if tool in ('mkvmerge', 'mkvextract', 'mkvpropedit') else (0,)):
            raise subprocess.CalledProcessError(returncode, cmd)
        if staged is not None:
            os.replace(staged, output)
    finally:
        if process is not None:
            if process.poll() is None:
                stop_process_tree(process)
            if reader is not None:
                reader.join(timeout=2)
            process.stdout.close()
        if staged is not None:
            staged.unlink(missing_ok=True)
    progress = current_task.get()
    # MKVToolNix uses 1 for success with warnings, 2 for an actual error.
    if returncode == 1 and tool in ('mkvmerge', 'mkvextract', 'mkvpropedit'):
        if progress is not None:
            progress.warnings += 1
        print(f"[Warning] {tool} finished with warnings; see the output above.")
        returncode = 0
    if progress is not None and tool in ('mkvmerge', 'mkvpropedit'):
        # Count final outputs, not temporary intermediate audio files.
        if tool == 'mkvpropedit' or os.path.splitext(cmd[cmd.index('-o') + 1])[1].lower() == '.mkv':
            progress.outputs += 1
    return returncode

