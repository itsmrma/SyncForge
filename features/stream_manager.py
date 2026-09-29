import os
import subprocess
from core.utils import ask_directory, get_files_recursive, get_track_signature, run_subprocess
from core.mkv_tools import get_tracks_info, format_track_label

VIDEO_EXT = ('.mkv', '.mp4', '.avi', '.mov', '.flv', '.webm')

def run_stream_manager():
    print("\n--- MODE 1: STREAM MANAGER (SMART BATCH) ---")
    folder = ask_directory( "Select Video Folder to process")
    if not folder: return
    
    out_folder = ask_directory( "Select OUTPUT Folder")
    if not out_folder: return

    videos = get_files_recursive(folder, VIDEO_EXT)
    if not videos: return print("No videos found.")

    print("\n🔍 Analyzing file structures...")
    groups = {}
    for vid in videos:
        tracks = get_tracks_info(vid)
        sig = get_track_signature(tracks)
        if sig not in groups:
            groups[sig] = {'tracks': tracks, 'files': []}
        groups[sig]['files'].append(vid)

    print(f"✅ Found {len(videos)} files, grouped into {len(groups)} distinct track structures.")

    print("\n" + "="*60)
    print("🛠️  CONFIGURATION PHASE")
    print("Answer questions for each group. Processing starts at the end.")
    print("="*60)
    
    actions_to_execute = []

    for i, (sig, group) in enumerate(groups.items(), 1):
        files = group['files']
        tracks = group['tracks']
        
        print(f"\n📦 GROUP {i}/{len(groups)} - Contains {len(files)} identical files:")
        for f in files[:3]: print(f"  - {os.path.basename(f)}")
        if len(files) > 3: print(f"  ... and {len(files) - 3} more files.")
        
        audio_tracks = [t for t in tracks if t['type'] == 'audio']
        sub_tracks = [t for t in tracks if t['type'] == 'subtitles']

        print("\n--- AUDIO TRACKS ---")
        if audio_tracks:
            for t in audio_tracks: print(format_track_label(t))
        else:
            print(" (No audio tracks)")

        print("\n--- SUBTITLE TRACKS ---")
        if sub_tracks:
            for t in sub_tracks: print(format_track_label(t))
        else:
            print(" (No subtitle tracks)")
        
        print("\n------------------------------------------------")
        print("Enter IDs to KEEP for this group (e.g. 1, 3).")
        print(" - Leave EMPTY to keep everything.")
        print(" - Type 's' to SKIP this group.")
        sel = input(f"Group {i} Selection: ").strip().lower()
        
        if sel == 's':
            print(f"⏭️ Group {i} skipped.")
            continue
            
        ids_to_keep = [int(x.strip()) for x in sel.split(',')] if sel else None

        do_opus_conversion = False
        if audio_tracks:
            conv_ans = input("Do you want to convert kept audio tracks to Opus stereo 128kbps? (y/n): ").strip().lower()
            do_opus_conversion = (conv_ans == 'y')

        actions_to_execute.append({
            'group_idx': i,
            'files': files,
            'tracks': tracks,
            'ids_to_keep': ids_to_keep,
            'do_opus': do_opus_conversion,
            'audio_tracks_info': audio_tracks
        })

    if not actions_to_execute:
        print("\nNo actions programmed. Returning to main menu.")
        return

    print("\n" + "="*60)
    print("🚀 PROCESSING PHASE")
    print("="*60)

    for action in actions_to_execute:
        group_idx = action['group_idx']
        files = action['files']
        tracks = action['tracks']
        ids_to_keep = action['ids_to_keep']
        do_opus = action['do_opus']
        audio_tracks_list = action['audio_tracks_info']

        print(f"\n💾 Processing Group {group_idx} ({len(files)} files)...")
        
        for vid in files:
            filename = os.path.basename(vid)
            name_only = os.path.splitext(filename)[0]
            
            clean_vid = os.path.abspath(os.path.normpath(vid))
            out = os.path.abspath(os.path.normpath(os.path.join(out_folder, f"{name_only}_mod.mkv")))
            out_dir = os.path.dirname(out)
            
            cmd = ["mkvmerge", "-o", out]
            temp_files = []

            if ids_to_keep is not None:
                curr_a = [t for t in tracks if t['id'] in ids_to_keep and t['type'] == 'audio']
                curr_s = [t for t in tracks if t['id'] in ids_to_keep and t['type'] == 'subtitles']
            else:
                curr_a = [t for t in tracks if t['type'] == 'audio']
                curr_s = [t for t in tracks if t['type'] == 'subtitles']
            
            if do_opus and curr_a:
                cmd.append("--no-audio")
                
                if ids_to_keep is not None:
                    if curr_s: cmd += ["--subtitle-tracks", ",".join(str(t['id']) for t in curr_s)]
                    else: cmd += ["--no-subtitles"]
                
                cmd.append(clean_vid)

                for a_track in curr_a:
                    idx = audio_tracks_list.index(a_track)
                    temp_opus = os.path.join(out_dir, f"temp_audio_{a_track['id']}.opus")
                    temp_files.append(temp_opus)

                    print(f"   🎵 Opus conversion for: {filename} (ID {a_track['id']})")
                    ff_cmd = [
                        "ffmpeg", "-y", "-i", clean_vid,
                        "-map", f"0:a:{idx}",
                        "-c:a", "libopus", "-b:a", "128k", "-vbr", "on", "-compression_level", "10", "-ac", "2",
                        temp_opus
                    ]
                    run_subprocess(ff_cmd, cwd=out_dir)

                    lang = a_track.get('properties', {}).get('language', 'und')
                    name = a_track.get('properties', {}).get('track_name', '')
                    
                    cmd += ["--language", f"0:{lang}"]
                    if name: cmd += ["--track-name", f"0:{name} (Opus)"]
                    if a_track.get('properties', {}).get('default_track'):
                        cmd += ["--default-track", "0:1"]
                    else:
                        cmd += ["--default-track", "0:0"]
                    
                    cmd.append(temp_opus)
            else:
                if ids_to_keep is not None:
                    if curr_a: cmd += ["--audio-tracks", ",".join(str(t['id']) for t in curr_a)]
                    else: cmd += ["--no-audio"]
                    
                    if curr_s: cmd += ["--subtitle-tracks", ",".join(str(t['id']) for t in curr_s)]
                    else: cmd += ["--no-subtitles"]
                    
                cmd.append(clean_vid)
            
            returncode = run_subprocess(cmd, cwd=out_dir)
            
            for t_f in temp_files:
                if os.path.exists(t_f): os.remove(t_f)

            if returncode != 0:
                print(f"   ❌ Error writing {filename}")
            else:
                print(f"   -> Saved: {os.path.basename(out)}")
        
    print(f"\n✅ Done! All batches processed in: {out_folder}")

def run_set_default_tracks():
    print("\n--- MODE 1B: SET DEFAULT/FORCED TRACKS (IN-PLACE) ---")
    folder = ask_directory( "Select Video Folder to process")
    if not folder: return

    videos = get_files_recursive(folder, VIDEO_EXT)
    if not videos: return print("No videos found.")

    print("\n🔍 Analyzing file structures...")
    groups = {}
    for vid in videos:
        tracks = get_tracks_info(vid)
        sig = get_track_signature(tracks)
        if sig not in groups:
            groups[sig] = {'tracks': tracks, 'files': []}
        groups[sig]['files'].append(vid)

    print(f"✅ Found {len(videos)} files, grouped into {len(groups)} structures.")

    for i, (sig, group) in enumerate(groups.items(), 1):
        files = group['files']
        tracks = group['tracks']
        
        print("\n" + "="*60)
        print(f"📦 GROUP {i}/{len(groups)} - Contains {len(files)} identical files:")
        for f in files[:3]: print(f"  - {os.path.basename(f)}")
        if len(files) > 3: print(f"  ... and {len(files) - 3} more files.")
        
        audio_tracks = [t for t in tracks if t['type'] == 'audio']
        sub_tracks = [t for t in tracks if t['type'] == 'subtitles']

        print("\n--- AUDIO TRACKS ---")
        if audio_tracks:
            for t in audio_tracks: print(format_track_label(t))
        
        print("\n--- SUBTITLE TRACKS ---")
        if sub_tracks:
            for t in sub_tracks: print(format_track_label(t))
        
        print("\n------------------------------------------------")
        print("Enter Track ID. Leave EMPTY to not modify that parameter.")
        print("Type 's' to skip this group.")
        
        sel_audio = input("DEFAULT AUDIO Track ID: ").strip().lower()
        if sel_audio == 's':
            print(f"⏭️ Group {i} skipped.")
            continue
            
        sel_sub_def = input("DEFAULT SUBTITLE Track ID: ").strip().lower()
        sel_sub_forced = input("FORCED SUBTITLE Track ID: ").strip().lower()

        target_audio_id = int(sel_audio) if sel_audio.isdigit() else None
        target_sub_def_id = int(sel_sub_def) if sel_sub_def.isdigit() else None
        target_sub_forced_id = int(sel_sub_forced) if sel_sub_forced.isdigit() else None

        if target_audio_id is None and target_sub_def_id is None and target_sub_forced_id is None:
            print("No modification requested for this group.")
            continue

        print("💾 Modifying in-place (No remuxing)...")
        for vid in files:
            clean_vid = os.path.abspath(os.path.normpath(vid))
            vid_dir = os.path.dirname(clean_vid)
            
            write_path = clean_vid
            if os.name == 'nt' and not clean_vid.startswith('\\\\') and not (len(clean_vid) > 1 and clean_vid[1] == ':' and clean_vid.upper().startswith(('Z:', 'X:', 'Y:', 'W:', 'V:'))):
                write_path = '\\\\?\\' + clean_vid

            cmd = ["mkvpropedit", write_path]
            modifiche_aggiunte = False
            
            if target_audio_id is not None:
                for idx, t in enumerate(audio_tracks, 1):
                    val = "1" if t['id'] == target_audio_id else "0"
                    cmd.extend(["--edit", f"track:a{idx}", "--set", f"flag-default={val}"])
                    modifiche_aggiunte = True
            
            if target_sub_def_id is not None or target_sub_forced_id is not None:
                for idx, t in enumerate(sub_tracks, 1):
                    edits_for_track = []
                    
                    if target_sub_def_id is not None:
                        val_def = "1" if t['id'] == target_sub_def_id else "0"
                        edits_for_track.extend(["--set", f"flag-default={val_def}"])
                        
                    if target_sub_forced_id is not None:
                        val_forced = "1" if t['id'] == target_sub_forced_id else "0"
                        edits_for_track.extend(["--set", f"flag-forced={val_forced}"])
                    
                    if edits_for_track:
                        cmd.extend(["--edit", f"track:s{idx}"])
                        cmd.extend(edits_for_track)
                        modifiche_aggiunte = True

            if modifiche_aggiunte:
                returncode = run_subprocess(cmd, cwd=vid_dir)
                if returncode != 0:
                    print(f"   ❌ mkvpropedit error on {os.path.basename(vid)}")
                else:
                    print(f"   -> Modified: {os.path.basename(vid)}")
            else:
                print(f"   -> No modifications for: {os.path.basename(vid)}")
        
    print(f"\n✅ Operations completed on original files!")
