import os
import tempfile

from syncforge.core import config
from syncforge.core.config import SUB_EXT, VIDEO_EXT
from syncforge.core.mkv_tools import get_tracks_info, select_track_interactive
from syncforge.core.utils import (
    ask_directory,
    get_files_recursive,
    get_track_signature,
    match_files,
    run_subprocess,
)


def run_sync_subs():
    print("\n--- MODE 2: SYNC EXTERNAL SUBTITLES ---")
    vid_folder = ask_directory( "Select VIDEO Folder")
    sub_folder = ask_directory( "Select SUBTITLE Folder")
    if not vid_folder or not sub_folder: return

    out_folder = ask_directory( "Select OUTPUT Folder")
    if not out_folder: return

    pairs = match_files(get_files_recursive(vid_folder, VIDEO_EXT), get_files_recursive(sub_folder, SUB_EXT))
    if not pairs: return

    for v_path, s_path in pairs:
        print(f"Syncing: {os.path.basename(v_path)}")
        with tempfile.TemporaryDirectory(prefix="syncforge_", dir=out_folder) as temp_dir:
            synced = os.path.join(temp_dir, "synced" + os.path.splitext(s_path)[1])

            v_clean = os.path.abspath(os.path.normpath(v_path))
            s_clean = os.path.abspath(os.path.normpath(s_path))


            if config.AUTO_SYNC_SUBS:
                cmd_ffsubsync = ["ffsubsync", v_clean, "-i", s_clean, "-o", synced]
                if config.ENABLE_MAX_OFFSET and config.MAX_OFFSET_SECONDS > 0:
                    cmd_ffsubsync.extend(["--max-offset-seconds", str(config.MAX_OFFSET_SECONDS)])

                run_subprocess(cmd_ffsubsync)
            else:
                # Just copy it so the rest of the flow works
                import shutil
                shutil.copy2(s_clean, synced)

            if os.path.exists(synced):
                filename = os.path.basename(v_clean)
                name_only = os.path.splitext(filename)[0]
                out = os.path.abspath(os.path.normpath(os.path.join(out_folder, f"{name_only}_subbed.mkv")))
                out_dir = os.path.dirname(out)

                cmd = ["mkvmerge", "-o", out, v_clean, "--language", "0:ita", synced]
                run_subprocess(cmd, cwd=out_dir)
                os.remove(synced)

    print(f"\nDone! Synced files saved to: {out_folder}")

def run_sync_subs_from_mkv():
    print("\n--- MODE 2B: SYNC SUBS FROM OTHER MKV (SMART BATCH) ---")
    tgt_folder = ask_directory( "Select TARGET VIDEO Folder (to subtitle)")
    src_folder = ask_directory( "Select SOURCE VIDEO Folder (has subtitles)")
    if not tgt_folder or not src_folder: return

    out_folder = ask_directory( "Select OUTPUT Folder")
    if not out_folder: return

    pairs = match_files(get_files_recursive(tgt_folder, VIDEO_EXT), get_files_recursive(src_folder, VIDEO_EXT))
    if not pairs: return

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
            with tempfile.TemporaryDirectory(prefix="syncforge_", dir=out_dir) as temp_dir:
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

                raw_sub = os.path.join(temp_dir, f"temp_raw_2b{sub_ext}")
                synced_sub = os.path.join(temp_dir, f"temp_synced_2b{sub_ext}")

                src_read_path = src_clean
                if os.name == 'nt' and not src_clean.startswith('\\\\') and not (len(src_clean) > 1 and src_clean[1] == ':' and src_clean.upper().startswith(('Z:', 'X:', 'Y:', 'W:', 'V:'))):
                    src_read_path = '\\\\?\\' + src_clean

                run_subprocess(["mkvextract", src_read_path, "tracks", f"{selected_sub_track['id']}:{raw_sub}"], cwd=out_dir)

                raw_sub_path = os.path.join(out_dir, raw_sub)
                synced_sub_path = os.path.join(out_dir, synced_sub)
                temp_files.append(raw_sub_path)

                final_sub_to_merge = os.path.splitext(raw_sub_path)[0] + ".idx" if sub_ext == ".sub" else raw_sub_path

                if os.path.exists(raw_sub_path):

                    if can_sync and config.AUTO_SYNC_SUBS:
                        print("      [Sync] Running ffsubsync...")
                        cmd_ffsubsync = ["ffsubsync", tgt_clean, "-i", raw_sub_path, "-o", synced_sub_path]
                        if config.ENABLE_MAX_OFFSET and config.MAX_OFFSET_SECONDS > 0:
                            cmd_ffsubsync.extend(["--max-offset-seconds", str(config.MAX_OFFSET_SECONDS)])
                        run_subprocess(cmd_ffsubsync, cwd=out_dir)

                        if os.path.exists(synced_sub_path) and os.path.getsize(synced_sub_path) > 0:
                            final_sub_to_merge = synced_sub_path
                            temp_files.append(synced_sub_path)
                            print("      ✅ Sync successful.")
                        else:
                            print("      ⚠️ Sync failed or impossible. Using original.")
                    elif can_sync and not config.AUTO_SYNC_SUBS:
                        print("      [Sync] Skipped (disabled in settings). Using original.")

                    cmd = ["mkvmerge", "-o", out_file, tgt_clean, "--language", "0:ita", final_sub_to_merge]
                    returncode = run_subprocess(cmd, cwd=out_dir)

                    if returncode != 0:
                        print("   ❌ ERROR during muxing.")
                    else:
                        print("   ✅ Done.")

                for t in temp_files:
                    if os.path.exists(t): os.remove(t)

    print(f"\n✅ All files processed and saved in: {out_folder}")
