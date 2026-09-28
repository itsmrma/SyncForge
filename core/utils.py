import os
import shutil
import sys

# Optional math libraries for audio sync
try:
    import numpy as np
    from scipy import signal
    from scipy.io import wavfile
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

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
        print("Install them using: pip install numpy scipy")
        input("Press Enter to continue anyway (or Ctrl+C to exit)...")

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
