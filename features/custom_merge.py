import os
from core.utils import ask_directory, get_files_recursive, get_track_signature, run_subprocess, parse_track_selection, ask_user
from core.mkv_tools import get_tracks_info, format_track_label
from core.utils import match_files

VIDEO_EXT = ('.mkv', '.mp4', '.avi', '.mov', '.flv', '.webm')

def run_custom_merge():
    print("\n--- MODE 4: CUSTOM MERGE FROM TWO SOURCES (SMART BATCH) ---")
    folder_a = ask_directory( "Select Folder A (Base Video + Audio/Subs)")
    folder_b = ask_directory( "Select Folder B (Additional Audio/Subs)")
    if not folder_a or not folder_b: return

    out_folder = ask_directory( "Select OUTPUT Folder")
    if not out_folder: return

    pairs = match_files(get_files_recursive(folder_a, VIDEO_EXT), get_files_recursive(folder_b, VIDEO_EXT))
    if not pairs: return

    print("\n🔍 Analyzing structure of pairs...")
    groups = {}
    for f_a, f_b in pairs:
        tracks_a = get_tracks_info(f_a)
        tracks_b = get_tracks_info(f_b)
        sig = f"{get_track_signature(tracks_a)}||{get_track_signature(tracks_b)}"
        if sig not in groups:
            groups[sig] = {'tracks_a': tracks_a, 'tracks_b': tracks_b, 'pairs': []}
        groups[sig]['pairs'].append((f_a, f_b))

    print(f"✅ Found {len(pairs)} pairs, grouped into {len(groups)} distinct structures.")

    actions_to_execute = []

    for i, (sig, group) in enumerate(groups.items(), 1):
        pairs_in_group = group['pairs']
        tracks_a = group['tracks_a']
        tracks_b = group['tracks_b']
        
        print("\n" + "="*60)
        print(f"📦 BATCH {i}/{len(groups)} - Contains {len(pairs_in_group)} pairs:")
        
        print("\n--- FOLDER A (BASE VIDEO) ---")
        audio_a = [t for t in tracks_a if t['type'] == 'audio']
        subs_a = [t for t in tracks_a if t['type'] == 'subtitles']
        if audio_a:
            print(" AUDIO:")
            for t in audio_a: print(f"   {format_track_label(t)}")
        if subs_a:
            print(" SUBTITLES:")
            for t in subs_a: print(f"   {format_track_label(t)}")
            
        sel_a_audio = ask_user("Choose audio tracks from Folder A", tracks=audio_a, kind="multiple", context=f"Batch {i}/{len(groups)} / {len(pairs_in_group)} pairs").strip().lower()
        sel_a_subs = ask_user("Choose subtitle tracks from Folder A", tracks=subs_a, kind="multiple", context=f"Batch {i}/{len(groups)} / {len(pairs_in_group)} pairs").strip().lower()

        print("\n--- FOLDER B (ADDITIONAL SOURCE) ---")
        audio_b = [t for t in tracks_b if t['type'] == 'audio']
        subs_b = [t for t in tracks_b if t['type'] == 'subtitles']
        if audio_b:
            print(" AUDIO:")
            for t in audio_b: print(f"   {format_track_label(t)}")
        if subs_b:
            print(" SUBTITLES:")
            for t in subs_b: print(f"   {format_track_label(t)}")
            
        sel_b_audio = ask_user("Choose audio tracks from Folder B", tracks=audio_b, kind="multiple", context=f"Batch {i}/{len(groups)} / {len(pairs_in_group)} pairs").strip().lower()
        sel_b_subs = ask_user("Choose subtitle tracks from Folder B", tracks=subs_b, kind="multiple", context=f"Batch {i}/{len(groups)} / {len(pairs_in_group)} pairs").strip().lower()

        actions_to_execute.append({
            'pairs': pairs_in_group,
            'keep_a_audio': parse_track_selection(sel_a_audio, audio_a),
            'keep_a_subs': parse_track_selection(sel_a_subs, subs_a),
            'keep_b_audio': parse_track_selection(sel_b_audio, audio_b),
            'keep_b_subs': parse_track_selection(sel_b_subs, subs_b)
        })

    print("\n" + "="*60)
    print("🚀 MULTI-BATCH PROCESSING PHASE")
    print("="*60)

    for batch_idx, action in enumerate(actions_to_execute, 1):
        print(f"\n💾 Processing Batch {batch_idx}...")
        for f_a, f_b in action['pairs']:
            base_name = os.path.splitext(os.path.basename(f_a))[0]
            out_file = os.path.abspath(os.path.normpath(os.path.join(out_folder, f"{base_name}_merged.mkv")))
            out_dir = os.path.dirname(out_file)
            
            clean_a = os.path.abspath(os.path.normpath(f_a))
            clean_b = os.path.abspath(os.path.normpath(f_b))

            cmd = ["mkvmerge", "-o", out_file]

            if action['keep_a_audio']: cmd += ["--audio-tracks", ",".join(map(str, action['keep_a_audio']))]
            else: cmd += ["--no-audio"]

            if action['keep_a_subs']: cmd += ["--subtitle-tracks", ",".join(map(str, action['keep_a_subs']))]
            else: cmd += ["--no-subtitles"]
            
            cmd.append(clean_a)

            cmd += ["--no-video", "--no-chapters"]
            
            if action['keep_b_audio']: cmd += ["--audio-tracks", ",".join(map(str, action['keep_b_audio']))]
            else: cmd += ["--no-audio"]

            if action['keep_b_subs']: cmd += ["--subtitle-tracks", ",".join(map(str, action['keep_b_subs']))]
            else: cmd += ["--no-subtitles"]
                
            cmd.append(clean_b)

            returncode = run_subprocess(cmd, cwd=out_dir)
            if returncode != 0:
                print(f"   ❌ Error writing {base_name}")
            else:
                print(f"   -> Saved: {os.path.basename(out_file)}")

    print(f"\n✅ Operations complete! Files saved to: {out_folder}")
