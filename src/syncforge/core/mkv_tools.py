import json
import os
from functools import lru_cache

from syncforge.core.processes import capture_command
from syncforge.core.tasks import check_cancelled
from syncforge.core.utils import ask_user


@lru_cache(maxsize=256)
def _read_metadata(filepath, size, modified_ns):
    """Cache by file identity and modification time, including in-place edits."""
    read_path = filepath
    if os.name == 'nt' and not filepath.startswith('\\\\') and not filepath.upper().startswith(('Z:', 'X:', 'Y:', 'W:', 'V:')):
        read_path = '\\\\?\\' + filepath
    result = capture_command(["mkvmerge", "-J", read_path], cwd=os.path.dirname(filepath))
    if result.returncode not in (0, 1):
        detail = result.stderr.strip()
        raise RuntimeError(f"Cannot read tracks from {filepath}: {detail}")
    return json.loads(result.stdout)


def _metadata(filepath):
    check_cancelled()
    filepath = os.path.abspath(os.path.normpath(filepath))
    info = os.stat(filepath)
    return _read_metadata(filepath, info.st_size, info.st_mtime_ns)


def get_tracks_info(filepath):
    return _metadata(filepath).get('tracks', [])


def has_attachments(filepath):
    return bool(_metadata(filepath).get('attachments', []))


def format_track_label(track):
    t_id = track['id']
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
            sel = int(ask_user("Choose the track to use in this batch", tracks=candidates, kind='single', context=group_desc))
            found = next((t for t in candidates if t['id'] == sel), None)
            if found: return found
        except ValueError: pass
