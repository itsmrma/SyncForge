import io
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from syncforge.core import mkv_tools, notifications, utils
from syncforge.core.audio_sync import find_audio_delay
from syncforge.core.process_env import external_tool_environment
from syncforge.core.tasks import TaskCancelled, TaskProgress, current_task
from syncforge.ui import backend


class TaskTests(unittest.TestCase):
    def setUp(self):
        backend.last_run_module = None
        backend.last_directory_choices = []
        self.api = backend.Api()
        self.notify = patch.object(backend, 'notify_task_finished').start()
        self.addCleanup(patch.stopall)

    def run_fake(self, function, **settings):
        with patch.object(backend, 'run_stream_manager', side_effect=function):
            return self.api.run_module('stream_manager', settings)

    def test_success_notifies_once_after_task_returns(self):
        def task():
            self.notify.assert_not_called()
            current_task.get().outputs += 2
        result = self.run_fake(task)
        self.assertEqual(result['status'], 'ok')
        self.notify.assert_called_once_with('Stream Manager', 'ok')

    def test_failure_notifies_and_allows_another_run(self):
        result = self.run_fake(lambda: (_ for _ in ()).throw(RuntimeError('broken mux')))
        self.assertEqual(result, {'status': 'error', 'message': 'broken mux'})
        self.notify.assert_called_once_with('Stream Manager', 'error')
        self.assertEqual(self.run_fake(lambda: None)['status'], 'cancelled')

    def test_warnings_are_not_a_clean_success(self):
        def task():
            progress = current_task.get()
            progress.outputs = 1
            progress.warnings = 1
        self.assertEqual(self.run_fake(task)['status'], 'warning')
        self.notify.assert_called_once_with('Stream Manager', 'warning')

    def test_disabled_notifications(self):
        def task():
            current_task.get().outputs = 1
        self.assertEqual(self.run_fake(task, notify_on_finish=False)['status'], 'ok')
        self.notify.assert_not_called()

    def test_cancelled_prompt_does_not_report_success(self):
        result = self.run_fake(lambda: (_ for _ in ()).throw(TaskCancelled()))
        self.assertEqual(result['status'], 'cancelled')

    def test_blank_disabled_offset_is_ignored(self):
        self.assertEqual(self.run_fake(lambda: None, max_offset='', enable_max_offset=False)['status'], 'cancelled')

    def test_invalid_offset_is_reported_without_starting(self):
        for offset in ('', '-1', '1.5', None):
            with self.subTest(offset=offset), patch.object(backend, 'run_stream_manager') as task:
                result = self.api.run_module('stream_manager', {'max_offset': offset, 'enable_max_offset': True})
                self.assertEqual(result['status'], 'error')
                task.assert_not_called()
        self.notify.assert_not_called()

    def test_unknown_module_and_repeat_without_history(self):
        self.assertEqual(self.api.run_module('missing', {})['status'], 'error')
        self.assertEqual(self.api.run_module('stream_manager', {}, repeat=True)['status'], 'error')

    def test_concurrent_run_is_rejected(self):
        self.api._run_lock.acquire()
        try:
            self.assertEqual(self.api.run_module('stream_manager', {})['status'], 'busy')
        finally:
            self.api._run_lock.release()

    def test_repeat_uses_previous_module_and_paths(self):
        received = []
        def task():
            received.append(utils.ask_directory('Select Video Folder'))
        with tempfile.TemporaryDirectory() as folder, patch.object(backend, 'run_stream_manager', side_effect=task):
            self.api.run_module('stream_manager', {}, {'video': folder})
            self.api.run_module('custom_merge', {}, repeat=True)
        self.assertEqual(received, [folder, folder])

    def test_unknown_matcher_response_is_not_retained(self):
        self.api.resolve_matcher('expired', [])
        self.assertNotIn('expired', backend.matcher_results)

    def test_single_file_repeat_defaults_output_to_parent_folder(self):
        received = []

        def task():
            received.append((utils.ask_directory('Select TARGET'), utils.ask_directory('Select SOURCE'),
                             utils.ask_directory('Select OUTPUT Folder')))

        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'target.mkv'
            source = Path(folder) / 'source.mkv'
            target.touch()
            source.touch()
            with patch.object(backend, 'run_custom_merge', side_effect=task):
                self.api.run_module('custom_merge', {}, {'video': str(target), 'sub': str(source)})
                self.api.run_module('stream_manager', {}, repeat=True)
            self.assertEqual(received, [(str(target), str(source), folder)] * 2)
            source.unlink()
            with patch.object(backend, 'run_custom_merge', side_effect=task):
                result = self.api.run_module('custom_merge', {}, repeat=True)
            self.assertEqual(result['status'], 'error')
            self.assertIn('File or folder does not exist', result['message'])

    def test_file_picker_filters_video_and_subtitle_files_and_handles_cancel(self):
        window = MagicMock()
        window.create_file_dialog.return_value = ('chosen.mkv',)
        with patch.object(backend, 'window_ref', window):
            self.assertEqual(self.api.pick_file(), 'chosen.mkv')
            options = window.create_file_dialog.call_args
            self.assertEqual(options.args, (backend.webview.OPEN_DIALOG,))
            self.assertFalse(options.kwargs['allow_multiple'])
            self.assertIn('*.mkv', options.kwargs['file_types'][0])
            self.api.pick_file('subtitles')
            self.assertIn('*.srt', window.create_file_dialog.call_args.kwargs['file_types'][0])
            self.assertNotIn('*.mkv', window.create_file_dialog.call_args.kwargs['file_types'][0])
            window.create_file_dialog.return_value = None
            self.assertEqual(self.api.pick_file(), '')

    def test_repeat_restores_pairing_order_and_new_run_resets_it(self):
        displayed = []

        def choose(targets, sources, on_order=None):
            displayed.append(list(sources))
            order = ['b', 'a', 'c'] if len(displayed) == 1 else list(sources)
            on_order(order)
            return list(zip(targets, order))

        def task():
            utils.match_files(['target'], ['a', 'b', 'c'])

        with patch.object(backend, 'request_matcher', side_effect=choose), patch.object(backend, 'run_stream_manager', side_effect=task):
            self.api.run_module('stream_manager', {})
            self.api.run_module('stream_manager', {}, repeat=True)
            self.api.run_module('stream_manager', {})
        self.assertEqual(displayed, [['a', 'b', 'c'], ['b', 'a', 'c'], ['a', 'b', 'c']])

    def test_repeat_pairing_handles_removed_and_new_files(self):
        self.api._matcher_orders = [['b', 'a', 'removed']]
        self.api._repeat_matcher_order = True
        with patch.object(backend, 'request_matcher', return_value=[]) as prompt:
            self.api._match_files(['target'], ['a', 'b', 'new'])
        self.assertEqual(prompt.call_args.args[1], ['b', 'a', 'new'])
        # Cancelling the prompt retains the last confirmed order.
        self.assertEqual(self.api._matcher_orders, [['b', 'a', 'removed']])

    def test_matcher_retains_full_order_including_unpaired_sources(self):
        saved = []
        window = MagicMock()

        def respond(script):
            callback_id = next(iter(backend.matcher_events))
            self.api.resolve_matcher(callback_id, [['target', 'b']], ['b', 'c', 'a'])
            return True

        window.evaluate_js.side_effect = respond
        with patch.object(backend, 'window_ref', window):
            self.assertEqual(backend.request_matcher(['target'], ['a', 'b', 'c'], on_order=saved.append), [['target', 'b']])
        self.assertEqual(saved, [['b', 'c', 'a']])
        self.assertEqual(backend.matcher_orders, {})

    def test_missing_matcher_frontend_does_not_wait(self):
        window = MagicMock()
        window.evaluate_js.return_value = False
        with patch.object(backend, 'window_ref', window):
            self.assertEqual(backend.request_matcher(['a'], ['b']), [])
        self.assertEqual(backend.matcher_events, {})

    def test_window_close_releases_pending_matcher(self):
        event = threading.Event()
        backend.matcher_events['pending'] = event
        try:
            backend.cancel_pending_matchers()
            self.assertTrue(event.is_set())
        finally:
            backend.matcher_events.pop('pending')

    def test_cancelled_input_raises_instead_of_looping(self):
        with patch.object(backend, 'window_ref', None):
            with self.assertRaises(TaskCancelled):
                backend.request_input('Select a track')

    def test_custom_prompt_waits_for_bridge_response_and_cleans_up(self):
        def respond(script):
            self.assertIn('Choose tracks', script)
            self.assertIn('"id": 8', script)
            self.api.resolve_input(next(iter(backend.input_events)), '1,8')
            return True
        window = MagicMock()
        window.evaluate_js.side_effect = respond
        with patch.object(backend, 'window_ref', window):
            self.assertEqual(backend.request_input('Choose tracks', tracks=[{'id': 8}], kind='multiple'), '1,8')
        self.assertEqual(backend.input_events, {})
        self.assertEqual(backend.input_results, {})

    def test_stop_releases_an_open_input_dialog(self):
        window = MagicMock()
        shown = threading.Event()
        window.evaluate_js.side_effect = lambda script: shown.set() or True
        outcomes = []
        with patch.object(backend, 'window_ref', window), patch.object(backend, 'run_stream_manager', side_effect=lambda: backend.request_input('Choose tracks')):
            worker = threading.Thread(target=lambda: outcomes.append(self.api.run_module('stream_manager', {})))
            worker.start()
            self.assertTrue(shown.wait(2))
            # Wait for the prompt to register (the launch log also evaluates JS).
            deadline = time.monotonic() + 2
            while not backend.input_events and time.monotonic() < deadline:
                time.sleep(0.01)
            self.assertEqual(self.api.stop_task()['status'], 'stopping')
            worker.join(timeout=3)
            self.assertFalse(worker.is_alive())
        self.assertEqual(outcomes[0]['status'], 'cancelled')
        self.assertEqual(backend.input_events, {})

    def test_stop_without_running_task_is_harmless(self):
        self.assertEqual(self.api.stop_task(), {'status': 'idle'})


class FileSelectionTests(unittest.TestCase):
    def test_selected_file_excludes_siblings_and_folder_still_recurses(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            selected = root / 'selected.MKV'
            selected.touch()
            (root / 'nested').mkdir()
            sibling = root / 'nested' / 'other.mkv'
            sibling.touch()
            (root / 'ignore.txt').touch()
            self.assertEqual(utils.get_files_recursive(str(selected), ('.mkv',)), [str(selected)])
            self.assertEqual(utils.get_files_recursive(folder, ('.mkv',)), sorted([str(selected), str(sibling)]))

    def test_unsupported_file_and_missing_path_report_errors(self):
        with tempfile.TemporaryDirectory() as folder:
            wrong = Path(folder) / 'wrong.txt'
            wrong.touch()
            with self.assertRaisesRegex(ValueError, 'Unsupported file type'):
                utils.get_files_recursive(str(wrong), ('.mkv',))
            with self.assertRaisesRegex(ValueError, 'File or folder does not exist'):
                utils.get_files_recursive(str(Path(folder) / 'missing.mkv'), ('.mkv',))


class SubprocessTests(unittest.TestCase):
    def command(self, tool, code):
        process = MagicMock()
        process.stdout = io.StringIO('tool output\n')
        process.poll.return_value = code
        process.wait.return_value = code
        return patch('subprocess.Popen', return_value=process)

    def test_mkv_warnings_preserve_success_and_count_warning(self):
        for tool in ('mkvmerge', 'mkvextract', 'mkvpropedit'):
            progress = TaskProgress()
            token = current_task.set(progress)
            try:
                with self.command(tool, 1), patch('os.replace'):
                    self.assertEqual(utils.run_subprocess([tool, '-o', 'output.mkv']), 0)
                self.assertEqual(progress.warnings, 1)
            finally:
                current_task.reset(token)

    def test_external_command_failure_is_propagated(self):
        for tool, code in (('mkvmerge', 2), ('ffmpeg', 1), ('ffsubsync', 1)):
            with self.command(tool, code), self.assertRaises(subprocess.CalledProcessError):
                utils.run_subprocess([tool])

    def test_frozen_ffsubsync_uses_bundled_dispatch(self):
        with self.command('ffsubsync', 0) as popen, patch.object(sys, 'frozen', True, create=True):
            utils.run_subprocess(['ffsubsync', 'video.mkv', '-i', 'subs.srt'])
        self.assertEqual(popen.call_args.args[0][:2], [sys.executable, '--ffsubsync'])


class MetadataTests(unittest.TestCase):
    def setUp(self):
        mkv_tools._read_metadata.cache_clear()

    def test_in_place_changes_invalidate_metadata(self):
        with tempfile.TemporaryDirectory() as folder:
            video = Path(folder) / 'video.mkv'
            video.write_bytes(b'first')
            response = subprocess.CompletedProcess([], 0, b'{"tracks":[{"id":1}],"attachments":[{}]}', b'')
            with patch.object(mkv_tools, 'capture_command', return_value=response) as run:
                self.assertEqual(mkv_tools.get_tracks_info(str(video)), [{'id': 1}])
                self.assertTrue(mkv_tools.has_attachments(str(video)))
                self.assertEqual(run.call_count, 1)
                video.write_bytes(b'changed file')
                mkv_tools.get_tracks_info(str(video))
                self.assertEqual(run.call_count, 2)

    def test_identification_failures_do_not_become_empty_tracks(self):
        with tempfile.NamedTemporaryFile() as video, patch.object(mkv_tools, 'capture_command', return_value=subprocess.CompletedProcess([], 2, '', 'broken')):
            with self.assertRaisesRegex(RuntimeError, 'Cannot read tracks'):
                mkv_tools.get_tracks_info(video.name)

    def test_track_selection_rejects_invalid_ids_before_writing(self):
        tracks = [{'id': 1}, {'id': 2}]
        for selection in ('99', 'wrong', '1,wrong', '-1'):
            with self.subTest(selection=selection), self.assertRaises(ValueError):
                utils.parse_track_selection(selection, tracks)
        self.assertEqual(utils.parse_track_selection('', tracks), [1, 2])
        self.assertEqual(utils.parse_track_selection('n', tracks), [])


class NotificationTests(unittest.TestCase):
    def test_macos_passes_text_as_arguments(self):
        with patch('platform.system', return_value='Darwin'), patch('subprocess.run') as run:
            notifications.send_notification('SyncForge', 'Quotes " and $() stay text')
        self.assertEqual(run.call_args.args[0][-2:], ['SyncForge', 'Quotes " and $() stay text'])
        self.assertEqual(run.call_args.args[0][0], '/usr/bin/osascript')
        self.assertTrue(run.call_args.kwargs['check'])

    def test_linux_uses_native_notifier(self):
        with patch('platform.system', return_value='Linux'), patch('shutil.which', return_value=None), patch('notifypy.Notify') as notify:
            notifications.send_notification('Done', 'Stream Manager')
        notify.return_value.send_notification.assert_called_once()

    def test_linux_notify_send_uses_argument_list(self):
        with patch('platform.system', return_value='Linux'), patch('shutil.which', return_value='/usr/bin/notify-send'), patch('subprocess.run') as run:
            notifications.send_notification('Done', 'Stream Manager')
        self.assertEqual(run.call_args.args[0], ['notify-send', '--app-name=SyncForge', 'Done', 'Stream Manager'])

    @unittest.skipUnless(os.name == 'nt', 'Windows registry integration')
    def test_windows_registers_portable_app_identity(self):
        with patch('platform.system', return_value='Windows'), patch('notifypy.Notify') as notify, patch('winreg.CreateKeyEx') as create, patch('winreg.SetValueEx') as set_value:
            notifications.send_notification('Done', 'Stream Manager')
        self.assertIn('AppUserModelId', create.call_args.args[1])
        self.assertEqual(set_value.call_args.args[1], 'DisplayName')
        notify.return_value.send_notification.assert_called_once()

    def test_notification_failure_never_escapes_worker(self):
        with patch.object(notifications, 'send_notification', side_effect=RuntimeError('no desktop')), patch('threading.Thread') as thread:
            notifications.notify_task_finished('Stream Manager', 'ok')
            thread.call_args.kwargs['target']()
        thread.return_value.start.assert_called_once()

    def test_cancellation_does_not_spawn_notification(self):
        with patch('threading.Thread') as thread:
            notifications.notify_task_finished('Stream Manager', 'cancelled')
        thread.assert_not_called()


class AudioSyncTests(unittest.TestCase):
    def test_waveform_delay_sign_and_magnitude(self):
        import numpy as np
        from scipy.io import wavfile
        audio = np.random.default_rng(42).integers(-16000, 16000, size=8000, dtype=np.int16)
        shifted = np.concatenate([np.zeros(800, dtype=np.int16), audio[:-800]])
        with tempfile.TemporaryDirectory() as folder:
            reference = Path(folder) / 'reference.wav'
            source = Path(folder) / 'source.wav'
            wavfile.write(reference, 8000, audio)
            wavfile.write(source, 8000, shifted)
            self.assertEqual(find_audio_delay(str(reference), str(source)), -100)

    def test_silent_audio_cannot_be_reported_as_a_successful_alignment(self):
        import numpy as np
        from scipy.io import wavfile
        with tempfile.TemporaryDirectory() as folder:
            reference = Path(folder) / 'silent.wav'
            wavfile.write(reference, 8000, np.zeros(100, dtype=np.int16))
            with self.assertRaisesRegex(RuntimeError, 'No usable audio'):
                find_audio_delay(str(reference), str(reference))


class ProcessEnvironmentTests(unittest.TestCase):
    def test_frozen_linux_external_tools_get_system_libraries(self):
        with patch.object(sys, 'frozen', True, create=True), patch.object(sys, 'platform', 'linux'), patch.dict(os.environ, {'LD_LIBRARY_PATH': '/bundle', 'LD_LIBRARY_PATH_ORIG': '/system'}):
            env = external_tool_environment()
            self.assertEqual(env['LD_LIBRARY_PATH'], '/system')
            self.assertEqual(os.environ['LD_LIBRARY_PATH'], '/bundle')


if __name__ == '__main__':
    unittest.main()
