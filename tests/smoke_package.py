"""Check the actual wheel, rather than relying on the editable installation."""

import os
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


def main():
    with tempfile.TemporaryDirectory(prefix="syncforge-wheel-") as folder:
        installed = Path(folder) / "installed"
        with zipfile.ZipFile(sys.argv[1]) as wheel:
            wheel.extractall(installed)
        env = dict(os.environ, PYTHONPATH=str(installed))
        script = """
from pathlib import Path
from unittest.mock import patch
from syncforge import app
import syncforge
assert Path(syncforge.__file__).resolve().is_relative_to(Path.cwd() / 'installed')
assert app.frontend_path().is_file(), 'Frontend must be included in the installed wheel'
with patch.object(app, 'launch_gui') as launch:
    app.main()
    launch.assert_called_once_with()
"""
        subprocess.run(
            [sys.executable, "-c", script],
            cwd=folder,
            env=env,
            check=True,
            capture_output=True,
            timeout=30,
        )
        source = Path(folder) / "source.srt"
        output = Path(folder) / "aligned.srt"
        source.write_text(
            "1\n00:00:00,100 --> 00:00:01,200\nInstalled wheel test\n", encoding="utf-8"
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
            env=env,
            check=True,
            capture_output=True,
            timeout=30,
        )
        assert "Installed wheel test" in output.read_text(encoding="utf-8")
    print(
        "Installed wheel entry point, frontend resources, and subtitle synchronizer passed"
    )


if __name__ == "__main__":
    main()
