import os
import subprocess
from tkinter import filedialog
from core.utils import get_files_recursive, get_track_signature, HAS_SCIPY
from core.mkv_tools import get_tracks_info, select_track_interactive, has_attachments
from core.audio_sync import extract_audio_segment, find_audio_delay, MAX_AUDIO_DELAY_MS
from ui.matcher_ui import match_files_ui

VIDEO_EXT = ('.mkv', '.mp4', '.avi', '.mov', '.flv', '.webm')

def run_injection():
    print("\n--- SOURCE -> TARGET INJECTION ---")
    tgt_folder = filedialog.askdirectory(title="Select TARGET Folder (High Quality Video)")
    src_folder = filedialog.askdirectory(title="Select SOURCE Folder (Audio/Subtitles to extract)")
    
    if not tgt_folder or not src_folder: return
    
    out_folder = filedialog.askdirectory(title="Select OUTPUT Folder")
    if not out_folder: return

    pairs = match_files_ui(get_files_recursive(tgt_folder, VIDEO_EXT), get_files_recursive(src_folder, VIDEO_EXT))
    if not pairs: return

    print("\n[TARGET] What do you want to KEEP from the High Quality file (RAW)?")
    keep_tgt_audio = input("   Keep original AUDIO? (y/n): ").lower() == 'y'
    keep_tgt_subs  = input("   Keep original SUBTITLES? (y/n): ").lower() == 'y'

    print("\n[SOURCE] What do you want to IMPORT from the Source file?")
    do_audio = input("   Import AUDIO? (y/n): ").lower() == 'y'
    do_audio_sync = False
    if do_audio:
        if HAS_SCIPY:
            do_audio_sync = input("      Apply auto-sync to audio (WaveSync)? (y/n): ").lower() == 'y'
        else:
            print("      (Audio auto-sync disabled: numpy/scipy missing)")

    do_subs  = input("   Import SUBTITLES? (y/n): ").lower() == 'y'
    do_sub_sync = False
    do_attachments = False
    if do_subs:
        do_sub_sync = input("      Apply auto-sync to subtitles (ffsubsync)? (y/n): ").lower() == 'y'
        max_offset = 0
        if do_sub_sync:
            max_offset = input("      Enter max offset in seconds for ffsubsync (e.g. 1, 0 for no limit): ").strip()
            if not max_offset.isdigit(): max_offset = 1 
        print("      (For ASS subtitles, importing original Fonts is vital to keep styling)")
        do_attachments = input("      Import ATTACHMENTS (Fonts) from source? (Y/n): ").lower() != 'n'

    print("\n🔍 Analyzing SOURCE file structures...")
    groups = {}
    for tgt, src in pairs:
        src_tracks = get_tracks_info(src)
        sig = get_track_signature(src_tracks)
        if sig not in groups:
            groups[sig] = {'tracks': src_tracks, 'pairs': []}
        groups[sig]['pairs'].append((tgt, src))
        
    for i, (sig, group) in enumerate(groups.items(), 1):
        pairs_in_group = group['pairs']
        src_tracks = group['tracks']
        
        print("\n" + "="*60)
        print(f"📦 BATCH {i}/{len(groups)} - {len(pairs_in_group)} pairs:")
        
        selected_audio_track = None
        selected_sub_track = None
        
        if do_audio:
            selected_audio_track = select_track_interactive(src_tracks, 'audio', f"Batch {i}/{len(groups)}")
        if do_subs:
            selected_sub_track = select_track_interactive(src_tracks, 'subtitles', f"Batch {i}/{len(groups)}")

        for tgt, src in pairs_in_group:
            print(f"\n>> Processing Target: {os.path.basename(tgt)}")
            filename = os.path.basename(tgt)
            base_name = os.path.splitext(filename)[0]
            
            tgt_clean = os.path.abspath(os.path.normpath(tgt))
            src_clean = os.path.abspath(os.path.normpath(src))
            
            out_file = os.path.abspath(os.path.normpath(os.path.join(out_folder, f"{base_name}_final.mkv")))
            out_dir = os.path.dirname(out_file)
            temp_files = []

            cmd = ["mkvmerge", "-o", out_file]
            
            if not keep_tgt_audio: cmd.append("--no-audio")
            if not keep_tgt_subs: cmd.append("--no-subtitles")
                
            cmd.append(tgt_clean)

            if do_audio and selected_audio_track:
                print(f"   🎤 Extracting Audio ID {selected_audio_track['id']}...")
                full_audio_ext = "temp_full_audio.mka"
                
                src_read_path = src_clean
                if os.name == 'nt' and not src_clean.startswith('\\\\') and not (len(src_clean) > 1 and src_clean[1] == ':' and src_clean.upper().startswith(('Z:', 'X:', 'Y:', 'W:', 'V:'))):
                    src_read_path = '\\\\?\\' + src_clean

                subprocess.run(["mkvextract", src_read_path, "tracks", f"{selected_audio_track['id']}:{full_audio_ext}"], 
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=out_dir)
                full_audio_path = os.path.join(out_dir, full_audio_ext)
                temp_files.append(full_audio_path)
                
                delay_ms = 0
                if do_audio_sync:
                    print(f"   🧪 Searching for sync (Max +/- {MAX_AUDIO_DELAY_MS}ms)...")
                    wav_ref = os.path.join(out_dir, "temp_ref.wav")
                    wav_src = os.path.join(out_dir, "temp_src.wav")
                    
                    extract_audio_segment(tgt_clean, wav_ref)
                    extract_audio_segment(full_audio_path, wav_src)
                    
                    if os.path.exists(wav_ref) and os.path.exists(wav_src):
                        delay_ms = find_audio_delay(wav_ref, wav_src)
                        print(f"   ⏱️  Delay applied: {delay_ms} ms")
                        temp_files.extend([wav_ref, wav_src])
                elif HAS_SCIPY:
                    print("   ℹ️ Audio auto-sync skipped.")
                
                cmd += ["--language", "0:ita", "--track-name", "0:Muxed Audio", 
                        "--sync", f"0:{delay_ms}", full_audio_path]

            if do_subs and selected_sub_track:
                print(f"   📝 Extracting Sub ID {selected_sub_track['id']}...")
                codec_id = selected_sub_track.get('properties', {}).get('codec_id', '').upper()
                codec_name = selected_sub_track.get('codec', '').upper()
                
                sub_ext = ".srt"
                can_sync = True
                if "ASS" in codec_id or "SSA" in codec_id or "ASS" in codec_name: sub_ext = ".ass"
                elif "PGS" in codec_id or "PG" in codec_name: sub_ext = ".sup"; can_sync = False
                elif "VOBSUB" in codec_id: sub_ext = ".sub"; can_sync = False

                raw_sub = f"temp_raw{sub_ext}"
                synced_sub = f"temp_synced{sub_ext}"
                
                subprocess.run(["mkvextract", src_read_path, "tracks", f"{selected_sub_track['id']}:{raw_sub}"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=out_dir)
                
                raw_sub_path = os.path.join(out_dir, raw_sub)
                synced_sub_path = os.path.join(out_dir, synced_sub)
                temp_files.append(raw_sub_path)
                
                final_sub_to_merge = raw_sub_path

                if os.path.exists(raw_sub_path):
                    if can_sync and do_sub_sync:
                        print(f"      [Sync] Starting ffsubsync...")
                        cmd_ffsubsync = ["ffsubsync", tgt_clean, "-i", raw_sub_path, "-o", synced_sub_path, "--max-offset-seconds", str(max_offset)]
                        subprocess.run(cmd_ffsubsync, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=out_dir)
                        
                        if os.path.exists(synced_sub_path) and os.path.getsize(synced_sub_path) > 0:
                            final_sub_to_merge = synced_sub_path
                            temp_files.append(synced_sub_path)
                            print("      ✅ Sync successful.")
                    
                    cmd += ["--language", "0:ita", "--track-name", "0:Muxed Sub", final_sub_to_merge]

            if do_attachments and has_attachments(src_clean):
                print("   📎 Importing attachments (Fonts/Images)...")
                cmd.extend(["--no-video", "--no-audio", "--no-subtitles", "--no-chapters", "--no-track-tags", "--no-global-tags", src_clean])

            print("   💾 Writing MKV file...")
            res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', cwd=out_dir)
            
            for t in temp_files:
                if os.path.exists(t): os.remove(t)
                
            if res.returncode != 0:
                print(f"   ❌ ERROR during muxing:")
                print(f"      {res.stderr.strip() or res.stdout.strip()}")
            else:
                print("   ✅ Done.")
