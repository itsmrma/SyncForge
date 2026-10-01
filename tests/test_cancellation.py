import contextlib
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from core import processes, utils
from core.tasks import TaskCancelled, TaskProgress, current_task
from ui import backend


class CancellationTests(unittest.TestCase):
    def test_stop_interrupts_a_silent_subprocess_and_allows_next_task(self):
        api = backend.Api()
        started = threading.Event()
        results = []
        child = []
        original = processes.start_process

        def start(*args, **kwargs):
            process = original(*args, **kwargs)
            child.append(process)
            started.set()
            return process

        def task():
            utils.run_subprocess([sys.executable, '-c', 'import time; time.sleep(30)'])

        with patch.object(utils, 'start_process', side_effect=start), patch.object(backend, 'run_stream_manager', side_effect=task), contextlib.redirect_stdout(io.StringIO()):
            worker = threading.Thread(target=lambda: results.append(api.run_module('stream_manager', {'notify_on_finish': False})))
            worker.start()
            try:
                self.assertTrue(started.wait(3))
                api.stop_task()
                worker.join(timeout=5)
                self.assertFalse(worker.is_alive(), 'Stop must not wait for silent output')
                self.assertEqual(results[0]['status'], 'cancelled')
                self.assertIsNotNone(child[0].poll())
            finally:
                if worker.is_alive():
                    api.stop_task()
                    worker.join(timeout=10)
        with patch.object(backend, 'run_stream_manager', return_value=None):
            self.assertEqual(api.run_module('stream_manager', {})['status'], 'cancelled')

    def test_analysis_can_be_stopped_before_command_finishes(self):
        task = TaskProgress()
        timer = threading.Timer(0.25, task.cancel_event.set)
        token = current_task.set(task)
        try:
            timer.start()
            started = time.monotonic()
            with self.assertRaises(TaskCancelled):
                processes.capture_command([sys.executable, '-c', 'import time; time.sleep(30)'])
            self.assertLess(time.monotonic() - started, 5)
        finally:
            timer.cancel()
            current_task.reset(token)

    def test_cancelled_mux_removes_partial_file_and_preserves_previous_output(self):
        task = TaskProgress()
        token = current_task.set(task)
        try:
            with tempfile.TemporaryDirectory() as folder:
                output = Path(folder) / 'output.mkv'
                output.write_bytes(b'previous completed output')
                child = []

                def start(cmd, **kwargs):
                    staged = cmd[cmd.index('-o') + 1]
                    process = processes.start_process([sys.executable, '-c',
                        'import pathlib,sys,time; pathlib.Path(sys.argv[1]).write_bytes(b"partial"); time.sleep(30)', staged])
                    child.append(process)
                    return process

                timer = threading.Timer(0.5, task.cancel_event.set)
                with patch.object(utils, 'start_process', side_effect=start), contextlib.redirect_stdout(io.StringIO()):
                    timer.start()
                    try:
                        with self.assertRaises(TaskCancelled):
                            utils.run_subprocess(['mkvmerge', '-o', str(output), 'input.mkv'])
                    finally:
                        timer.cancel()
                self.assertEqual(output.read_bytes(), b'previous completed output')
                self.assertEqual(list(Path(folder).iterdir()), [output])
                self.assertIsNotNone(child[0].poll())
        finally:
            current_task.reset(token)

    @unittest.skipUnless(os.name == 'nt', 'Windows console flags')
    def test_analysis_and_processing_hide_console_windows(self):
        with patch('subprocess.Popen') as popen:
            processes.start_process(['mkvmerge', '-J', 'video.mkv'], capture=True)
        self.assertTrue(popen.call_args.kwargs['creationflags'] & subprocess.CREATE_NO_WINDOW)
        self.assertEqual(popen.call_args.kwargs['startupinfo'].wShowWindow, 0)

    @unittest.skipUnless(os.name == 'nt', 'Windows console flags')
    def test_library_spawned_ffmpeg_is_also_hidden(self):
        original = subprocess.Popen
        calls = []

        class FakePopen:
            def __init__(self, *args, **kwargs):
                calls.append(kwargs)

        try:
            subprocess.Popen = FakePopen
            processes.hide_child_consoles()
            subprocess.Popen(['ffmpeg'])
            self.assertTrue(calls[0]['creationflags'] & subprocess.CREATE_NO_WINDOW)
        finally:
            subprocess.Popen = original


if __name__ == '__main__':
    unittest.main()
