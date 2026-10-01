"""Entry points and resources must work outside a source checkout."""

import subprocess
import sys
import tempfile
import unittest
from importlib.metadata import distribution
from pathlib import Path
from unittest.mock import patch

from syncforge import __version__, app
from syncforge.ui.backend import Api


class PackageTests(unittest.TestCase):
    def test_installed_command_launches_the_desktop_app(self):
        entry = next(
            item
            for item in distribution("syncforge").entry_points
            if item.group == "console_scripts" and item.name == "syncforge"
        )
        with (
            patch.object(sys, "argv", ["syncforge"]),
            patch.object(app, "launch_gui") as launch,
        ):
            entry.load()()
        launch.assert_called_once_with()
        self.assertEqual(Api().get_version(), __version__)

    def test_missing_frontend_reports_build_instructions(self):
        with patch.object(
            app, "frontend_path", return_value=Path("missing-frontend/index.html")
        ):
            with self.assertRaisesRegex(RuntimeError, "Frontend build missing"):
                app.launch_gui()

    def test_module_dispatches_subtitle_sync_from_an_unrelated_directory(self):
        with tempfile.TemporaryDirectory(prefix="syncforge-package-") as folder:
            source = Path(folder) / "source.srt"
            output = Path(folder) / "aligned.srt"
            source.write_text(
                "1\n00:00:00,100 --> 00:00:01,200\nPackage test\n", encoding="utf-8"
            )
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "syncforge",
                    "--ffsubsync",
                    str(source),
                    "-i",
                    str(source),
                    "-o",
                    str(output),
                ],
                cwd=folder,
                check=True,
                capture_output=True,
                timeout=30,
            )
            self.assertIn("Package test", output.read_text(encoding="utf-8"))
