import sys
import builtins
import tkinter as tk
from tkinter import filedialog
import eel
import os
import time

from features.stream_manager import run_stream_manager, run_set_default_tracks
from features.sub_sync import run_sync_subs, run_sync_subs_from_mkv
from features.injection import run_injection
from features.custom_merge import run_custom_merge
import core.config
from core.utils import get_files_recursive

root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)

class StreamInterceptor:
    def __init__(self):
        self.last_update = 0
        self.buffer = ""
        
    def write(self, text):
        self.buffer += text
        now = time.time()
        if now - self.last_update > 0.05 or '\n' in text:
            try:
                eel.append_terminal(self.buffer)()
            except Exception:
                pass
            self.buffer = ""
            self.last_update = now
            
    def flush(self):
        if self.buffer:
            try:
                eel.append_terminal(self.buffer)()
            except Exception:
                pass
            self.buffer = ""

def patched_input(prompt=""):
    try:
        eel.append_terminal(prompt)()
        res = eel.ask_input(prompt)()
        eel.append_terminal(res + "\n")()
        return res
    except Exception:
        return ""

class FileDialogMock:
    @staticmethod
    def getExistingDirectory(parent=None, caption=""):
        res = filedialog.askdirectory(title=caption, master=root)
        if res:
            res = os.path.normpath(res)
        try:
            eel.append_terminal(f"[{caption}] Selected: {res}\n")()
        except:
            pass
        return res

# Apply patches
sys.stdout = StreamInterceptor()
builtins.input = patched_input

import sys
from unittest.mock import MagicMock
sys.modules['PyQt6'] = MagicMock()
sys.modules['PyQt6.QtWidgets'] = MagicMock()
sys.modules['PyQt6.QtWidgets'].QFileDialog = FileDialogMock
sys.modules['PyQt6.QtCore'] = MagicMock()
sys.modules['PyQt6.QtGui'] = MagicMock()
sys.modules['PyQt6.QtWidgets'].QApplication = MagicMock()

def match_files_ui_mock(target_list, source_list):
    try:
        res = eel.ask_matcher(target_list, source_list)()
        if not res:
            return []
        return res
    except Exception:
        return []

sys.modules['ui.matcher_ui'] = MagicMock()
sys.modules['ui.matcher_ui'].match_files_ui = match_files_ui_mock

@eel.expose
def run_module(module_name, settings):
    core.config.MAX_OFFSET_SECONDS = int(settings.get("max_offset", 1))
    core.config.AUTO_SYNC_AUDIO = settings.get("auto_audio", True)
    core.config.AUTO_SYNC_SUBS = settings.get("auto_subs", True)
    
    modules = {
        "stream_manager": run_stream_manager,
        "set_default": run_set_default_tracks,
        "sync_subs": run_sync_subs,
        "sync_subs_mkv": run_sync_subs_from_mkv,
        "injection": run_injection,
        "custom_merge": run_custom_merge
    }
    
    if module_name in modules:
        try:
            eel.append_terminal(f"\n--- Launching {module_name} ---\n")()
            modules[module_name]()
            eel.append_terminal(f"\n--- Finished ---\n")()
            return {"status": "ok"}
        except Exception as e:
            eel.append_terminal(f"\n[ERROR] {e}\n")()
            return {"status": "error", "message": str(e)}

@eel.expose
def get_version():
    return "1.4.0"
