import sys
import builtins
import os
import time
import json
import webview
from core.tasks import TaskCancelled, TaskProgress, current_task, check_cancelled
from core.notifications import notify_task_finished

window_ref = None
active_api = None

class FrontendShim:
    def append_terminal(self, text):
        def caller():
            if window_ref:
                try:
                    window_ref.evaluate_js(f"if(window.frontend_api && window.frontend_api.append_terminal) window.frontend_api.append_terminal({json.dumps(text)})")
                except Exception:
                    pass
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

def setup_shim(win, api=None):
    global window_ref, active_api
    window_ref = win
    active_api = api
    sys.stdout = StreamInterceptor()
    builtins.input = patched_input
    core.utils.set_ask_input_callback(request_input)
    win.events.closed += cancel_pending_matchers


def cancel_pending_matchers():
    if active_api:
        active_api.stop_task()
    for evt in list(matcher_events.values()):
        evt.set()
    for evt in list(input_events.values()):
        evt.set()

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
            if not res:
                raise TaskCancelled()
            res = os.path.abspath(os.path.normpath(res))
            if "OUTPUT" in caption.upper():
                os.makedirs(res, exist_ok=True)
            elif not os.path.isdir(res):
                raise ValueError(f"Folder does not exist: {res}")
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
input_events = {}
input_results = {}


def request_input(prompt, **options):
    check_cancelled()
    if not window_ref:
        raise TaskCancelled()
    callback_id = str(uuid.uuid4())
    event = threading.Event()
    input_events[callback_id] = event
    payload = dict(options, prompt=prompt)
    try:
        shown = window_ref.evaluate_js(f"window.frontend_api && window.frontend_api.ask_input ? (window.frontend_api.ask_input({json.dumps(payload)}, '{callback_id}'), true) : false")
        if not shown:
            raise TaskCancelled()
        while not event.wait(0.1):
            check_cancelled()
        check_cancelled()
        result = input_results.get(callback_id)
        if result is None:
            raise TaskCancelled()
        return str(result)
    finally:
        input_events.pop(callback_id, None)
        input_results.pop(callback_id, None)

def mock_ask_matcher(target_list, source_list):
    callback_id = str(uuid.uuid4())
    if not window_ref:
        return []
    evt = threading.Event()
    matcher_events[callback_id] = evt
    
    try:
        if window_ref:
            shown = window_ref.evaluate_js(f"window.frontend_api && window.frontend_api.ask_matcher ? (window.frontend_api.ask_matcher({json.dumps(target_list)}, {json.dumps(source_list)}, '{callback_id}'), true) : false")
            if not shown:
                return []
        
        # Wait for the user to interact with the dialog
        while not evt.wait(0.1):
            check_cancelled()
        check_cancelled()
        
        res = matcher_results.get(callback_id, [])
    except TaskCancelled:
        raise
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
    encoding = 'utf-8'

    def __init__(self):
        self.last_update = 0
        self.buffer = ""
        self._lock = threading.Lock()

    def isatty(self):
        return False
        
    def write(self, text):
        chunk = ''
        with self._lock:
            self.buffer += text
            now = time.monotonic()
            if now - self.last_update > 0.05 or '\n' in text:
                chunk = self.buffer
                self.buffer = ''
                self.last_update = now
        if chunk:
            try:
                frontend.append_terminal(chunk)()
            except Exception:
                pass
        return len(text)
            
    def flush(self):
        with self._lock:
            chunk = self.buffer
            self.buffer = ''
        if chunk:
            try:
                frontend.append_terminal(chunk)()
            except Exception:
                pass

def patched_input(prompt=""):
    frontend.append_terminal(prompt)()
    res = request_input(prompt)
    frontend.append_terminal(res + "\n")()
    return res

class Api:
    def __init__(self):
        self._run_lock = threading.Lock()
        self._state_lock = threading.Lock()
        self._active_task = None

    def resolve_input(self, callback_id, result):
        event = input_events.get(callback_id)
        if event is not None:
            input_results[callback_id] = result
            event.set()

    def stop_task(self):
        with self._state_lock:
            task = self._active_task
            if task is None:
                return {"status": "idle"}
            task.cancel_event.set()
        for event in list(input_events.values()) + list(matcher_events.values()):
            event.set()
        if window_ref:
            try:
                window_ref.evaluate_js("window.frontend_api && window.frontend_api.cancel_requests && window.frontend_api.cancel_requests()")
            except Exception:
                pass
        return {"status": "stopping"}

    def resolve_matcher(self, callback_id, res):
        global matcher_results, matcher_events
        if callback_id in matcher_events:
            matcher_results[callback_id] = res
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
        if not self._run_lock.acquire(blocking=False):
            return {"status": "busy", "message": "A task is already running."}
        with self._state_lock:
            self._active_task = TaskProgress()
        try:
            return self._run_module(module_name, settings, paths, repeat)
        finally:
            with self._state_lock:
                self._active_task = None
            self._run_lock.release()

    def _run_module(self, module_name, settings, paths, repeat):
        global last_run_module, last_directory_choices, is_repeating, current_directory_index
        
        modules = {
            "stream_manager": run_stream_manager,
            "set_default": run_set_default_tracks,
            "sync_subs": run_sync_subs,
            "sync_subs_mkv": run_sync_subs_from_mkv,
            "injection": run_injection,
            "custom_merge": run_custom_merge
        }
        labels = {
            "stream_manager": "Stream Manager", "set_default": "Set Default & Forced",
            "sync_subs": "Sync External Subtitles", "sync_subs_mkv": "Sync Subs from MKV",
            "injection": "WaveSync Injection", "custom_merge": "Custom Track Merge",
        }
        if repeat:
            if not last_run_module:
                return {"status": "error", "message": "There is no previous task to repeat."}
            module_name = last_run_module
        if module_name not in modules:
            return {"status": "error", "message": "Unknown module."}
        try:
            enable_offset = bool(settings.get("enable_max_offset", False))
            max_offset = int(settings.get("max_offset", 1)) if enable_offset else 1
            if max_offset <= 0:
                raise ValueError()
        except (TypeError, ValueError):
            return {"status": "error", "message": "Max offset must be a positive whole number."}
        core.config.MAX_OFFSET_SECONDS = max_offset
        core.config.ENABLE_MAX_OFFSET = enable_offset
        core.config.AUTO_SYNC_AUDIO = settings.get("auto_audio", True)
        core.config.AUTO_SYNC_SUBS = settings.get("auto_subs", True)
        
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
                    
        progress = self._active_task
        token = current_task.set(progress)
        try:
            frontend.append_terminal(f"\n--- Launching {module_name} ---\n")()
            modules[module_name]()
            check_cancelled()
            if not progress.outputs:
                result = {"status": "cancelled", "message": "No files were processed."}
            elif progress.warnings:
                result = {"status": "warning", "message": f"Task completed with {progress.warnings} warning(s). Check the terminal."}
            else:
                result = {"status": "ok", "message": f"Task completed. {progress.outputs} file(s) processed."}
        except TaskCancelled:
            result = {"status": "cancelled", "message": f"Task stopped. {progress.outputs} completed file(s) kept; partial output removed."}
        except (Exception, SystemExit) as exc:
            result = {"status": "error", "message": str(exc)}
        finally:
            sys.stdout.flush()
            current_task.reset(token)
            is_repeating = False
            if window_ref:
                try:
                    window_ref.evaluate_js("window.frontend_api && window.frontend_api.cancel_requests && window.frontend_api.cancel_requests()")
                except Exception:
                    pass
        frontend.append_terminal(f"\n--- {result['message']} ---\n")()
        if settings.get("notify_on_finish", True):
            notify_task_finished(labels[module_name], result["status"])
        return result

    def get_version(self):
        return "1.7.1"
