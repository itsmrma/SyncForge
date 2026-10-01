"""Small real media files exercise every processing mode with installed tools."""
import contextlib
import io
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from core.mkv_tools import get_tracks_info
from core import utils
from ui.backend import Api


TOOLS_AVAILABLE = all(shutil.which(tool) for tool in ('ffmpeg', 'mkvmerge', 'mkvextract', 'mkvpropedit'))


@unittest.skipUnless(TOOLS_AVAILABLE, 'FFmpeg and MKVToolNix are required')
class MediaIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixtures = tempfile.TemporaryDirectory(prefix='syncforge-tests-')
        cls.addClassCleanup(cls.fixtures.cleanup)
        folder = Path(cls.fixtures.name)
        cls.subtitle = folder / 'subs.srt'
        cls.subtitle.write_text('1\n00:00:00,100 --> 00:00:01,200\nIntegration test\n', encoding='utf-8')
        base = folder / 'base.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=size=64x48:rate=10:color=blue',
                        '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '1.5',
                        '-c:v', 'mpeg4', '-c:a', 'aac', str(base)], check=True, capture_output=True)
        cls.video = folder / 'fixture.mkv'
        subprocess.run(['mkvmerge', '-o', str(cls.video), str(base), '--language', '0:ita', str(cls.subtitle)], check=True, capture_output=True)

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(prefix='syncforge-media-')
        self.addCleanup(self.folder.cleanup)
        root = Path(self.folder.name)
        self.target = root / 'target'
        self.source = root / 'source'
        self.output = root / 'output'
        self.target.mkdir()
        self.source.mkdir()
        self.output.mkdir()
        shutil.copy2(self.video, self.target / 'video.mkv')
        shutil.copy2(self.video, self.source / 'video.mkv')
        shutil.copy2(self.subtitle, self.source / 'subs.srt')
        self.api = Api()
        self.log = io.StringIO()
        self.redirect = contextlib.redirect_stdout(self.log)
        self.redirect.__enter__()
        self.addCleanup(self.redirect.__exit__, None, None, None)

    def run_mode(self, mode, answers=()):
        with patch('builtins.input', side_effect=answers), patch.object(utils, '_ask_matcher_callback', side_effect=lambda targets, sources: list(zip(targets, sources))):
            return self.api.run_module(mode, {'auto_audio': False, 'auto_subs': False, 'notify_on_finish': False},
                                       {'video': str(self.target), 'sub': str(self.source), 'output': str(self.output)})

    def assert_output(self, result, suffix):
        self.assertEqual(result['status'], 'ok', self.log.getvalue())
        output = self.output / f'video_{suffix}.mkv'
        self.assertTrue(output.exists())
        tracks = get_tracks_info(str(output))
        self.assertTrue(any(t['type'] == 'video' for t in tracks))
        self.assertFalse(list(self.output.glob('syncforge_*')), 'Temporary files must be cleaned')
        return tracks

    def test_stream_manager(self):
        tracks = self.assert_output(self.run_mode('stream_manager', ['', 'n']), 'mod')
        self.assertEqual(len(tracks), 3)

    def test_opus_conversion(self):
        tracks = self.assert_output(self.run_mode('stream_manager', ['', 'y']), 'mod')
        self.assertTrue(any(t['codec'] == 'Opus' for t in tracks))

    def test_set_default_and_forced_invalidates_cached_flags(self):
        video = str(self.target / 'video.mkv')
        before = get_tracks_info(video)
        self.assertFalse(before[2]['properties']['forced_track'])
        result = self.run_mode('set_default', ['1', '2', '2'])
        self.assertEqual(result['status'], 'ok', self.log.getvalue())
        after = get_tracks_info(video)
        self.assertTrue(after[2]['properties']['forced_track'])

    def test_invalid_default_track_does_not_clear_flags(self):
        video = str(self.target / 'video.mkv')
        before = get_tracks_info(video)
        result = self.run_mode('set_default', ['99', '', ''])
        self.assertEqual(result['status'], 'error')
        self.assertEqual(before, get_tracks_info(video))

    def test_external_subtitles(self):
        tracks = self.assert_output(self.run_mode('sync_subs'), 'subbed')
        self.assertEqual(sum(t['type'] == 'subtitles' for t in tracks), 2)
        self.assertFalse(list(self.source.glob('*.synced*')))

    def test_external_ass_preserves_format_when_sync_disabled(self):
        import pysubs2
        pysubs2.load(str(self.source / 'subs.srt')).save(str(self.source / 'subs.ass'))
        (self.source / 'subs.srt').unlink()
        tracks = self.assert_output(self.run_mode('sync_subs'), 'subbed')
        self.assertTrue(any(t.get('properties', {}).get('codec_id') == 'S_TEXT/ASS' for t in tracks))

    def test_subtitles_from_mkv(self):
        self.assert_output(self.run_mode('sync_subs_mkv'), 'subbed')

    def test_injection_subtitles_without_audio(self):
        tracks = self.assert_output(self.run_mode('injection', ['n', 'n', 'n', 'y', 'n']), 'final')
        self.assertEqual([t['type'] for t in tracks], ['video', 'subtitles'])

    def test_injection_audio_with_valid_matroska_intermediate(self):
        tracks = self.assert_output(self.run_mode('injection', ['n', 'n', 'y', 'n']), 'final')
        self.assertEqual([t['type'] for t in tracks], ['video', 'audio'])

    def test_custom_merge(self):
        self.assert_output(self.run_mode('custom_merge', ['n', 'n', '', '']), 'merged')

    def test_failed_conversion_cleans_temporary_files_and_reports_error(self):
        def fail(*args, **kwargs):
            raise subprocess.CalledProcessError(1, ['ffmpeg'])
        with patch('features.stream_manager.run_subprocess', side_effect=fail):
            result = self.run_mode('stream_manager', ['', 'y'])
        self.assertEqual(result['status'], 'error')
        self.assertEqual(list(self.output.iterdir()), [])

    def test_ffsubsync_runs_through_current_python_environment(self):
        synced = self.output / 'aligned.srt'
        with contextlib.redirect_stdout(io.StringIO()):
            utils.run_subprocess(['ffsubsync', str(self.source / 'subs.srt'), '-i', str(self.source / 'subs.srt'), '-o', str(synced)])
        self.assertIn('Integration test', synced.read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
