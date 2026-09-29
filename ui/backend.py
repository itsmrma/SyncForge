import sys
import builtins
import os
import time
import json
import webview
from unittest.mock import MagicMock

window_ref = None

class FrontendShim:
    def append_terminal(self, text):
        def caller():
            if window_ref:
                try:
                    window_ref.evaluate_js(f"if(window.frontend_api && window.frontend_api.append_terminal) window.frontend_api.append_terminal({json.dumps(text)})")
                except Exception:
                    pass
        return caller
        
    def ask_input(self, prompt):
        def caller():
            if window_ref:
                try:
                    res = window_ref.evaluate_js(f"window.frontend_api && window.frontend_api.ask_input ? window.frontend_api.ask_input({json.dumps(prompt)}) : ''")
                    return res if res is not None else ""
                except Exception:
                    return ""
            return ""
        return caller
        
    def ask_matcher(self, target, source):
        def caller():
            if window_ref:
                try:
                    res = window_ref.evaluate_js(f"window.frontend_api && window.frontend_api.ask_matcher ? window.frontend_api.ask_matcher({json.dumps(target)}, {json.dumps(source)}) : []")
                    return res if res else []
                except Exception:
                    return []
            return []
        return caller

frontend = FrontendShim()

def setup_shim(win):
    global window_ref
    window_ref = win

# --- SETUP MOCKS BEFORE IMPORTING FEATURES ---
last_run_module = None
last_directory_choices = []
is_repeating = False
current_directory_index = 0

def mock_ask_directory(caption=""):
    global is_repeating, current_directory_index, last_directory_choices
    if is_repeating:
        if current_directory_index < len(last_directory_choices):
            res = last_directory_choices[current_directory_index]
            current_directory_index += 1
            try:
                frontend.append_terminal(f"[{caption}] Auto-selected: {res}\n")()
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
        frontend.append_terminal(f"[{caption}] Selected: {res}\n")()
    except:
        pass
    return res

import core.utils
core.utils.set_ask_directory_callback(mock_ask_directory)

import threading
import uuid

matcher_events = {}
matcher_results = {}

def mock_ask_matcher(target_list, source_list):
    callback_id = str(uuid.uuid4())
    evt = threading.Event()
    matcher_events[callback_id] = evt
    
    try:
        if window_ref:
            window_ref.evaluate_js(f"if(window.frontend_api && window.frontend_api.ask_matcher) window.frontend_api.ask_matcher({json.dumps(target_list)}, {json.dumps(source_list)}, '{callback_id}')")
        
        # Wait for the user to interact with the dialog
        evt.wait()
        
        res = matcher_results.get(callback_id, [])
    except Exception as e:
        if window_ref:
            frontend.append_terminal(f"\n[ERROR] in ask_matcher: {e}\n")()
        res = []
    finally:
        matcher_events.pop(callback_id, None)
        matcher_results.pop(callback_id, None)
        
    return res

core.utils.set_ask_matcher_callback(mock_ask_matcher)
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
                frontend.append_terminal(self.buffer)()
            except Exception:
                pass
            self.buffer = ""
            self.last_update = now
            
    def flush(self):
        if self.buffer:
            try:
                frontend.append_terminal(self.buffer)()
            except Exception:
                pass
            self.buffer = ""

def patched_input(prompt=""):
    try:
        frontend.append_terminal(prompt)()
        res = frontend.ask_input(prompt)()
        frontend.append_terminal(res + "\n")()
        return res
    except Exception:
        return ""

# Apply patches
sys.stdout = StreamInterceptor()
builtins.input = patched_input

class Api:
    def resolve_matcher(self, callback_id, res):
        global matcher_results, matcher_events
        matcher_results[callback_id] = res
        if callback_id in matcher_events:
            matcher_events[callback_id].set()

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
                frontend.append_terminal(f"\n--- Launching {module_name} ---\n")()
                modules[module_name]()
                frontend.append_terminal(f"\n--- Finished ---\n")()
                return {"status": "ok"}
            except Exception as e:
                frontend.append_terminal(f"\n[ERROR] {e}\n")()
                return {"status": "error", "message": str(e)}

    def get_version(self):
        return "1.6.2"
