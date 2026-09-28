import os
import json
import subprocess
from functools import lru_cache

@lru_cache(maxsize=256)
def get_tracks_info(filepath):
    """Reads tracks using an extended path only if local to prevent locks. Cached for performance."""
    try:
        filepath = os.path.abspath(os.path.normpath(filepath))
        file_dir = os.path.dirname(filepath)
        
        read_path = filepath
        # Apply \\?\ literal workaround only if it's NOT a UNC path and NOT on a common network share
        if os.name == 'nt' and not filepath.startswith('\\\\') and not (len(filepath) > 1 and filepath[1] == ':' and filepath.upper().startswith(('Z:', 'X:', 'Y:', 'W:', 'V:'))):
            read_path = '\\\\?\\' + filepath
            
        res = subprocess.run(
            ["mkvmerge", "-J", read_path], 
            capture_output=True, 
            cwd=file_dir
        )
        
        if res.returncode != 0:
            return []
            
        stdout_text = res.stdout.decode('utf-8', errors='ignore').strip()
        return json.loads(stdout_text).get('tracks', [])
    except Exception:
        return []

@lru_cache(maxsize=256)
def has_attachments(filepath):
    """Checks if the MKV file has attachments (e.g. Fonts). Cached for performance."""
    try:
        filepath = os.path.abspath(os.path.normpath(filepath))
        file_dir = os.path.dirname(filepath)
        
        read_path = filepath
        if os.name == 'nt' and not filepath.startswith('\\\\') and not (len(filepath) > 1 and filepath[1] == ':' and filepath.upper().startswith(('Z:', 'X:', 'Y:', 'W:', 'V:'))):
            read_path = '\\\\?\\' + filepath

        res = subprocess.run(["mkvmerge", "-J", read_path], capture_output=True, cwd=file_dir)
        stdout_text = res.stdout.decode('utf-8', errors='ignore').strip()
        return len(json.loads(stdout_text).get('attachments', [])) > 0
    except Exception: 
        return False

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
