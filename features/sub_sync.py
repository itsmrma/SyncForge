import os
import subprocess
from PyQt6.QtWidgets import QFileDialog, QApplication
from core.utils import get_files_recursive, get_track_signature
from core.mkv_tools import get_tracks_info, select_track_interactive
from ui.matcher_ui import match_files_ui

VIDEO_EXT = ('.mkv', '.mp4', '.avi', '.mov', '.flv', '.webm')
SUB_EXT = ('.srt', '.ass', '.vtt', '.ssa')

def run_sync_subs():
    print("\n--- MODE 2: SYNC EXTERNAL SUBTITLES ---")
    vid_folder = QFileDialog.getExistingDirectory(None, "Select VIDEO Folder")
    sub_folder = QFileDialog.getExistingDirectory(None, "Select SUBTITLE Folder")
    if not vid_folder or not sub_folder: return

    out_folder = QFileDialog.getExistingDirectory(None, "Select OUTPUT Folder")
    if not out_folder: return

    pairs = match_files_ui(get_files_recursive(vid_folder, VIDEO_EXT), get_files_recursive(sub_folder, SUB_EXT))
    if not pairs: return

    for v_path, s_path in pairs:
        print(f"Syncing: {os.path.basename(v_path)}")
        synced = s_path + ".synced.srt"
        
        v_clean = os.path.abspath(os.path.normpath(v_path))
        s_clean = os.path.abspath(os.path.normpath(s_path))
        
        subprocess.run(["ffsubsync", v_clean, "-i", s_clean, "-o", synced], stdout=subprocess.DEVNULL)
        
        if os.path.exists(synced):
            filename = os.path.basename(v_clean)
            name_only = os.path.splitext(filename)[0]
            out = os.path.abspath(os.path.normpath(os.path.join(out_folder, f"{name_only}_subbed.mkv")))
            out_dir = os.path.dirname(out)
            
            cmd = ["mkvmerge", "-o", out, v_clean, "--language", "0:ita", synced]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=out_dir)
            os.remove(synced)
            
    print(f"\nDone! Synced files saved to: {out_folder}")

def run_sync_subs_from_mkv():
    print("\n--- MODE 2B: SYNC SUBS FROM OTHER MKV (SMART BATCH) ---")
    tgt_folder = QFileDialog.getExistingDirectory(None, "Select TARGET VIDEO Folder (to subtitle)")
    src_folder = QFileDialog.getExistingDirectory(None, "Select SOURCE VIDEO Folder (has subtitles)")
    if not tgt_folder or not src_folder: return

    out_folder = QFileDialog.getExistingDirectory(None, "Select OUTPUT Folder")
    if not out_folder: return

    pairs = match_files_ui(get_files_recursive(tgt_folder, VIDEO_EXT), get_files_recursive(src_folder, VIDEO_EXT))
    if not pairs: return

    max_offset = input("\nEnter max offset in seconds for ffsubsync (e.g. 1, or 0 for no limit): ").strip()
    if not max_offset.isdigit(): max_offset = "1"

    print("\n🔍 Analyzing SOURCE file structures...")
    groups = {}
    for tgt, src in pairs:
        src_tracks = get_tracks_info(src)
        sig = get_track_signature(src_tracks)
        if sig not in groups:
            groups[sig] = {'tracks': src_tracks, 'pairs': []}
        groups[sig]['pairs'].append((tgt, src))
        
    print(f"✅ Found {len(pairs)} pairs, grouped into {len(groups)} distinct source structures.")

    for i, (sig, group) in enumerate(groups.items(), 1):
        pairs_in_group = group['pairs']
        src_tracks = group['tracks']
        
        print("\n" + "="*60)
        print(f"📦 BATCH {i}/{len(groups)} - Contains {len(pairs_in_group)} pairs:")
        
        selected_sub_track = select_track_interactive(src_tracks, 'subtitles', f"Batch {i}/{len(groups)}")
        if not selected_sub_track:
            print("⏭️ No subtitle track selected, skipping batch.")
            continue

        for tgt, src in pairs_in_group:
            print(f"\n>> Processing Target: {os.path.basename(tgt)}")
            filename = os.path.basename(tgt)
            base_name = os.path.splitext(filename)[0]
            
            tgt_clean = os.path.abspath(os.path.normpath(tgt))
            src_clean = os.path.abspath(os.path.normpath(src))
            
            out_file = os.path.abspath(os.path.normpath(os.path.join(out_folder, f"{base_name}_subbed.mkv")))
            out_dir = os.path.dirname(out_file)
            temp_files = []

            print(f"   📝 Extracting Sub ID {selected_sub_track['id']}...")
            codec_id = selected_sub_track.get('properties', {}).get('codec_id', '').upper()
            codec_name = selected_sub_track.get('codec', '').upper()
            
            sub_ext = ".srt"
            can_sync = True
            if "ASS" in codec_id or "SSA" in codec_id or "ASS" in codec_name:
                sub_ext = ".ass"
            elif "PGS" in codec_id or "PG" in codec_name:
                sub_ext = ".sup"
                can_sync = False
            elif "VOBSUB" in codec_id:
                sub_ext = ".sub"
                can_sync = False

            raw_sub = f"temp_raw_2b{sub_ext}"
            synced_sub = f"temp_synced_2b{sub_ext}"
            
            src_read_path = src_clean
            if os.name == 'nt' and not src_clean.startswith('\\\\') and not (len(src_clean) > 1 and src_clean[1] == ':' and src_clean.upper().startswith(('Z:', 'X:', 'Y:', 'W:', 'V:'))):
                src_read_path = '\\\\?\\' + src_clean

            subprocess.run(["mkvextract", src_read_path, "tracks", f"{selected_sub_track['id']}:{raw_sub}"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=out_dir)
            
            raw_sub_path = os.path.join(out_dir, raw_sub)
            synced_sub_path = os.path.join(out_dir, synced_sub)
            temp_files.append(raw_sub_path)
            
            final_sub_to_merge = raw_sub_path

            if os.path.exists(raw_sub_path):
                if can_sync:
                    print(f"      [Sync] Running ffsubsync...")
                    cmd_ffsubsync = ["ffsubsync", tgt_clean, "-i", raw_sub_path, "-o", synced_sub_path, "--max-offset-seconds", str(max_offset)]
                    subprocess.run(cmd_ffsubsync, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=out_dir)
                    
                    if os.path.exists(synced_sub_path) and os.path.getsize(synced_sub_path) > 0:
                        final_sub_to_merge = synced_sub_path
                        temp_files.append(synced_sub_path)
                        print("      ✅ Sync successful.")
                    else:
                        print("      ⚠️ Sync failed or impossible. Using original.")
                
                cmd = ["mkvmerge", "-o", out_file, tgt_clean, "--language", "0:ita", final_sub_to_merge]
                res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', cwd=out_dir)
                
                if res.returncode != 0:
                    print(f"   ❌ ERROR during muxing:")
                    print(f"      {res.stderr.strip() or res.stdout.strip()}")
                else:
                    print("   ✅ Done.")

            for t in temp_files:
                if os.path.exists(t): os.remove(t)
                    
    print(f"\n✅ All files processed and saved in: {out_folder}")
