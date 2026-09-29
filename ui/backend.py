import sys
import builtins
import os
import time
import json
import webview
from unittest.mock import MagicMock

window_ref = None

class EelShim:
    def append_terminal(self, text):
        def caller():
            if window_ref:
                try:
                    window_ref.evaluate_js(f"if(window.eel && window.eel.append_terminal) window.eel.append_terminal({json.dumps(text)})")
                except Exception:
                    pass
        return caller
        
    def ask_input(self, prompt):
        def caller():
            if window_ref:
                try:
                    res = window_ref.evaluate_js(f"window.eel && window.eel.ask_input ? window.eel.ask_input({json.dumps(prompt)}) : ''")
                    return res if res is not None else ""
                except Exception:
                    return ""
            return ""
        return caller
        
    def ask_matcher(self, target, source):
        def caller():
            if window_ref:
                try:
                    res = window_ref.evaluate_js(f"window.eel && window.eel.ask_matcher ? window.eel.ask_matcher({json.dumps(target)}, {json.dumps(source)}) : []")
                    return res if res else []
                except Exception:
                    return []
            return []
        return caller

eel = EelShim()

def setup_shim(win):
    global window_ref
    window_ref = win

# --- SETUP MOCKS BEFORE IMPORTING FEATURES ---
last_run_module = None
last_directory_choices = []
is_repeating = False
current_directory_index = 0

class FileDialogMock:
    @staticmethod
    def getExistingDirectory(parent=None, caption=""):
        global is_repeating, current_directory_index, last_directory_choices
        if is_repeating:
            if current_directory_index < len(last_directory_choices):
                res = last_directory_choices[current_directory_index]
                current_directory_index += 1
                try:
                    eel.append_terminal(f"[{caption}] Auto-selected: {res}\n")()
                except: pass
                return res
            else:
                is_repeating = False # Fallback

        res = ""
        if window_ref:
            try:
                paths = window_ref.create_file_dialog(webview.FOLDER_DIALOG)
                if paths and len(paths) > 0:
                    res = paths[0]
            except Exception:
                pass

        if res:
            res = os.path.normpath(res)
            last_directory_choices.append(res)
        try:
            eel.append_terminal(f"[{caption}] Selected: {res}\n")()
        except:
            pass
        return res

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
# ---------------------------------------------

from features.stream_manager import run_stream_manager, run_set_default_tracks
from features.sub_sync import run_sync_subs, run_sync_subs_from_mkv
from features.injection import run_injection
from features.custom_merge import run_custom_merge
import core.config
from core.utils import get_files_recursive

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

# Apply patches
sys.stdout = StreamInterceptor()
builtins.input = patched_input

class Api:
    def pick_folder(self):
        if window_ref:
            try:
                paths = window_ref.create_file_dialog(webview.FOLDER_DIALOG)
                if paths and len(paths) > 0:
                    return paths[0]
            except Exception:
                pass
        return ""

    def run_module(self, module_name, settings, paths=None, repeat=False):
        global last_run_module, last_directory_choices, is_repeating, current_directory_index
        
        core.config.MAX_OFFSET_SECONDS = int(settings.get("max_offset", 1))
        core.config.ENABLE_MAX_OFFSET = settings.get("enable_max_offset", True)
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
        
        if repeat and last_run_module:
            module_name = last_run_module
            is_repeating = True
            current_directory_index = 0
        else:
            last_run_module = module_name
            is_repeating = True
            current_directory_index = 0
            
            # Populate last_directory_choices with the provided paths
            last_directory_choices = []
            if paths:
                p_vid = paths.get("video", "")
                p_sub = paths.get("sub", "")
                p_out = paths.get("output", "")
                if not p_out:
                    p_out = p_vid
                
                # Depending on the module, we queue the paths in the order they are asked
                if module_name == "set_default":
                    last_directory_choices = [p_vid]
                elif module_name == "stream_manager":
                    last_directory_choices = [p_vid, p_out]
                else:
                    last_directory_choices = [p_vid, p_sub, p_out]
                    
        if module_name in modules:
            try:
                eel.append_terminal(f"\n--- Launching {module_name} ---\n")()
                modules[module_name]()
                eel.append_terminal(f"\n--- Finished ---\n")()
                return {"status": "ok"}
            except Exception as e:
                eel.append_terminal(f"\n[ERROR] {e}\n")()
                return {"status": "error", "message": str(e)}

    def get_version(self):
        return "1.6.1"
