import os
import tempfile
from core.utils import ask_directory, get_files_recursive, get_track_signature, HAS_SCIPY, run_subprocess, ask_user
from core.mkv_tools import get_tracks_info, select_track_interactive, has_attachments
from core.audio_sync import extract_audio_segment, find_audio_delay, MAX_AUDIO_DELAY_MS
from core.utils import match_files

VIDEO_EXT = ('.mkv', '.mp4', '.avi', '.mov', '.flv', '.webm')

def run_injection():
    print("\n--- SOURCE -> TARGET INJECTION ---")
    tgt_folder = ask_directory( "Select TARGET Folder (High Quality Video)")
    src_folder = ask_directory( "Select SOURCE Folder (Audio/Subtitles to extract)")

    if not tgt_folder or not src_folder: return

    out_folder = ask_directory( "Select OUTPUT Folder")
    if not out_folder: return

    pairs = match_files(get_files_recursive(tgt_folder, VIDEO_EXT), get_files_recursive(src_folder, VIDEO_EXT))
    if not pairs: return

    print("\n[TARGET] What do you want to KEEP from the High Quality file (RAW)?")
    keep_tgt_audio = ask_user("Keep original audio from the target?", kind="confirm").lower() == 'y'
    keep_tgt_subs  = ask_user("Keep original subtitles from the target?", kind="confirm").lower() == 'y'

    print("\n[SOURCE] What do you want to IMPORT from the Source file?")
    do_audio = ask_user("Import audio from the source?", kind="confirm").lower() == 'y'
    do_audio_sync = False

    import core.config

    if do_audio:
        if HAS_SCIPY:
            do_audio_sync = core.config.AUTO_SYNC_AUDIO
            print(f"      Apply auto-sync to audio (WaveSync)? {'y' if do_audio_sync else 'n'} [from global settings]")
        else:
            print("      (Audio auto-sync disabled: numpy/scipy missing)")

    do_subs  = ask_user("Import subtitles from the source?", kind="confirm").lower() == 'y'
    do_sub_sync = False
    do_attachments = False
    if do_subs:
        do_sub_sync = core.config.AUTO_SYNC_SUBS
        print(f"      Apply auto-sync to subtitles (ffsubsync)? {'y' if do_sub_sync else 'n'} [from global settings]")
        print("      (For ASS subtitles, importing original Fonts is vital to keep styling)")
        do_attachments = ask_user("Import attachments (fonts) from the source?", kind="confirm").lower() != 'n'

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
            with tempfile.TemporaryDirectory(prefix="syncforge_", dir=out_dir) as temp_dir:
                temp_files = []
                src_read_path = src_clean

                cmd = ["mkvmerge", "-o", out_file]

                if not keep_tgt_audio: cmd.append("--no-audio")
                if not keep_tgt_subs: cmd.append("--no-subtitles")

                cmd.append(tgt_clean)

                if do_audio and selected_audio_track:
                    print(f"   🎤 Extracting Audio ID {selected_audio_track['id']}...")
                    full_audio_ext = os.path.join(temp_dir, "temp_full_audio.mka")

                    src_read_path = src_clean
                    if os.name == 'nt' and not src_clean.startswith('\\\\') and not (len(src_clean) > 1 and src_clean[1] == ':' and src_clean.upper().startswith(('Z:', 'X:', 'Y:', 'W:', 'V:'))):
                        src_read_path = '\\\\?\\' + src_clean

                    run_subprocess(["mkvmerge", "-o", full_audio_ext, "--no-video", "--no-subtitles", "--no-attachments", "--no-chapters", "--audio-tracks", str(selected_audio_track["id"]), src_read_path], cwd=out_dir)
                    full_audio_path = os.path.join(out_dir, full_audio_ext)
                    temp_files.append(full_audio_path)

                    delay_ms = 0
                    if do_audio_sync:
                        print(f"   🧪 Searching for sync (Max +/- {MAX_AUDIO_DELAY_MS}ms)...")
                        wav_ref = os.path.join(temp_dir, "temp_ref.wav")
                        wav_src = os.path.join(temp_dir, "temp_src.wav")

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

                    raw_sub = os.path.join(temp_dir, f"temp_raw{sub_ext}")
                    synced_sub = os.path.join(temp_dir, f"temp_synced{sub_ext}")

                    run_subprocess(["mkvextract", src_read_path, "tracks", f"{selected_sub_track['id']}:{raw_sub}"], cwd=out_dir)

                    raw_sub_path = os.path.join(out_dir, raw_sub)
                    synced_sub_path = os.path.join(out_dir, synced_sub)
                    temp_files.append(raw_sub_path)

                    final_sub_to_merge = os.path.splitext(raw_sub_path)[0] + ".idx" if sub_ext == ".sub" else raw_sub_path

                    if os.path.exists(raw_sub_path):
                        if can_sync and do_sub_sync:
                            print(f"      [Sync] Starting ffsubsync...")
                            import core.config
                            cmd_ffsubsync = ["ffsubsync", tgt_clean, "-i", raw_sub_path, "-o", synced_sub_path]
                            if core.config.ENABLE_MAX_OFFSET and core.config.MAX_OFFSET_SECONDS > 0:
                                cmd_ffsubsync.extend(["--max-offset-seconds", str(core.config.MAX_OFFSET_SECONDS)])
                            run_subprocess(cmd_ffsubsync, cwd=out_dir)

                            if os.path.exists(synced_sub_path) and os.path.getsize(synced_sub_path) > 0:
                                final_sub_to_merge = synced_sub_path
                                temp_files.append(synced_sub_path)
                                print("      ✅ Sync successful.")

                        cmd += ["--language", "0:ita", "--track-name", "0:Muxed Sub", final_sub_to_merge]

                if do_attachments and has_attachments(src_clean):
                    print("   📎 Importing attachments (Fonts/Images)...")
                    cmd.extend(["--no-video", "--no-audio", "--no-subtitles", "--no-chapters", "--no-track-tags", "--no-global-tags", src_clean])

                print("   💾 Writing MKV file...")
                returncode = run_subprocess(cmd, cwd=out_dir)

                for t in temp_files:
                    if os.path.exists(t): os.remove(t)

                if returncode != 0:
                    print(f"   ❌ ERROR during muxing.")
                else:
                    print("   ✅ Done.")
