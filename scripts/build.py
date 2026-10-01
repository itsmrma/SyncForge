"""Build the standalone desktop executable from any working directory."""

import os
import sys
from pathlib import Path

import PyInstaller.__main__


def main():
    root = Path(__file__).resolve().parents[1]
    frontend = root / "src/syncforge/web/dist"
    if not (frontend / "index.html").is_file():
        raise SystemExit("Build the frontend first: cd web && npm ci && npm run build")
    options = [
        str(root / "main.py"),
        "--name=SyncForge",
        "--onefile",
        "--windowed",
        "--noconfirm",
        "--collect-all=notifypy",
        "--collect-all=ffsubsync",
        "--copy-metadata=syncforge",
        f"--paths={root / 'src'}",
        f"--additional-hooks-dir={root / 'hooks'}",
        f"--add-data={frontend}{os.pathsep}syncforge/web/dist",
        f"--distpath={root / 'dist'}",
        f"--workpath={root / 'build/pyinstaller'}",
        f"--specpath={root / 'build'}",
    ]
    if sys.platform == "linux":
        options += [
            "--hidden-import=webview.platforms.qt",
            "--hidden-import=PySide6.QtWebEngineCore",
            "--hidden-import=PySide6.QtWebEngineWidgets",
        ]
    PyInstaller.__main__.run(options)


if __name__ == "__main__":
    main()
