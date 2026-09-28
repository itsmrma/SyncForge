import tkinter as tk
from core.utils import check_deps
from features.stream_manager import run_stream_manager, run_set_default_tracks
from features.sub_sync import run_sync_subs, run_sync_subs_from_mkv
from features.injection import run_injection
from features.custom_merge import run_custom_merge

def main():
    check_deps()
    root = tk.Tk()
    root.withdraw()

    while True:
        print("\n=== SYNCFORGE: MKV & Audio/Sub Sync Tool ===")
        print("1.  Stream Manager (Smart Batch)")
        print("1b. Set Default and Forced Tracks (Smart Batch, In-Place)")
        print("2.  Sync External Subtitles (.srt to Video)")
        print("2b. Sync Subtitles from another MKV (Smart Batch)")
        print("3.  Inject Source into Target (Audio WaveSync + Sub Sync)")
        print("4.  Custom Merge (Grab tracks from 2 folders)")
        print("q.  Quit")
        
        choice = input("Choose an option: ").strip().lower()
        if choice == '1': run_stream_manager()
        elif choice == '1b': run_set_default_tracks()
        elif choice == '2': run_sync_subs()
        elif choice == '2b': run_sync_subs_from_mkv()
        elif choice == '3': run_injection()
        elif choice == '4': run_custom_merge()
        elif choice == 'q': break

if __name__ == "__main__":
    main()
