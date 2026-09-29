import os
import shutil
import sys
import importlib.util

# Check for math libraries without loading them into memory
HAS_SCIPY = importlib.util.find_spec('scipy') is not None and importlib.util.find_spec('numpy') is not None

_ask_directory_callback = None
def set_ask_directory_callback(callback):
    global _ask_directory_callback
    _ask_directory_callback = callback

def ask_directory(caption=""):
    if _ask_directory_callback:
        return _ask_directory_callback(caption)
    return input(f"{caption}: ").strip()

_ask_matcher_callback = None
def set_ask_matcher_callback(callback):
    global _ask_matcher_callback
    _ask_matcher_callback = callback

def match_files(targets, sources):
    if _ask_matcher_callback:
        return _ask_matcher_callback(targets, sources)
    return []

def check_deps():
    missing = []
    if not shutil.which("mkvmerge"): missing.append("mkvmerge (MKVToolNix)")
    if not shutil.which("mkvextract"): missing.append("mkvextract (MKVToolNix)")
    if not shutil.which("mkvpropedit"): missing.append("mkvpropedit (MKVToolNix)")
    if not shutil.which("ffmpeg"): missing.append("ffmpeg")
    if not shutil.which("ffsubsync"): missing.append("ffsubsync")
    
    if missing:
        print("ERROR: The following programs are missing from the system PATH:")
        for m in missing: print(f" - {m}")
        sys.exit(1)
        
    if not HAS_SCIPY:
        print("WARNING: 'numpy' and 'scipy' are not installed.")
        print("Audio waveform synchronization will not work (Subtitle sync will still work).")

def get_files_recursive(folder, extensions):
    """Recursively finds files and normalizes paths for Windows."""
    found_files = []
    normalized_folder = os.path.abspath(os.path.normpath(folder))
    
    for root, dirs, files in os.walk(normalized_folder):
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

def run_subprocess(cmd, cwd=None):
    """Runs a subprocess, captures output real-time, and prevents cmd window on Windows."""
    import subprocess
    creationflags = 0
    if os.name == 'nt':
        creationflags = subprocess.CREATE_NO_WINDOW
        
    process = subprocess.Popen(
        cmd, 
        stdout=subprocess.PIPE, 
        stderr=subprocess.STDOUT, 
        text=True, 
        encoding='utf-8', 
        errors='replace',
        cwd=cwd, 
        creationflags=creationflags
    )
    
    while True:
        line = process.stdout.readline()
        if not line and process.poll() is not None:
            break
        if line:
            print(line, end='')
            
    process.stdout.close()
    return process.wait()

