import os
import json
import subprocess
from functools import lru_cache
from core.process_env import external_tool_environment

@lru_cache(maxsize=256)
def _read_metadata(filepath, size, modified_ns):
    """Cache by file identity and modification time, including in-place edits."""
    read_path = filepath
    if os.name == 'nt' and not filepath.startswith('\\\\') and not filepath.upper().startswith(('Z:', 'X:', 'Y:', 'W:', 'V:')):
        read_path = '\\\\?\\' + filepath
    result = subprocess.run(
        ["mkvmerge", "-J", read_path], capture_output=True,
        cwd=os.path.dirname(filepath),
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
        env=external_tool_environment(),
    )
    if result.returncode not in (0, 1):
        detail = result.stderr.decode('utf-8', errors='replace').strip()
        raise RuntimeError(f"Cannot read tracks from {filepath}: {detail}")
    return json.loads(result.stdout.decode('utf-8'))


def _metadata(filepath):
    filepath = os.path.abspath(os.path.normpath(filepath))
    info = os.stat(filepath)
    return _read_metadata(filepath, info.st_size, info.st_mtime_ns)


def get_tracks_info(filepath):
    return _metadata(filepath).get('tracks', [])


def has_attachments(filepath):
    return bool(_metadata(filepath).get('attachments', []))


def format_track_label(track):
    t_id = track['id']
    t_type = track['type']
    props = track.get('properties', {})
    
    lang = props.get('language', 'und')
    codec = track.get('codec', 'Unknown')
    name = props.get('track_name', '')
    
    label = f"[ID: {t_id}] {lang.upper()} ({codec})"
    if name: label += f" - {name}"
        
    flags = []
    if props.get('default_track'): flags.append("Default")
    if props.get('forced_track'): flags.append("Forced")
    if flags: label += f" [{'|'.join(flags)}]"
        
    return label

def select_track_interactive(tracks, track_type, group_desc):
    candidates = [t for t in tracks if t['type'] == track_type]
    if not candidates: return None
    if len(candidates) == 1: return candidates[0]
    
    ita_tracks = [t for t in candidates if t.get('properties', {}).get('language') in ('ita', 'it')]
    if len(ita_tracks) == 1: return ita_tracks[0]

    print(f"\n⚠️  TRACK SELECTION FOR: {group_desc}")
    print(f"Multiple {track_type} tracks found. Which one do you want to use?")
    for t in candidates: print(f"   {format_track_label(t)}")
    
    while True:
        try:
            sel = int(input(f"   Enter Track ID to use in this batch: "))
            found = next((t for t in candidates if t['id'] == sel), None)
            if found: return found
        except ValueError: pass
