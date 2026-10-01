"""Application entry points for installed, source, and frozen builds."""

import os
import sys
from multiprocessing import freeze_support
from pathlib import Path


def frontend_path():
    return Path(__file__).parent / "web" / "dist" / "index.html"


def launch_gui():
    import webview

    from syncforge.ui.backend import Api, connect_frontend

    if sys.platform == "darwin":
        os.environ["PATH"] = os.pathsep.join(
            ["/opt/homebrew/bin", "/usr/local/bin", os.environ.get("PATH", "")]
        )
    index = frontend_path()
    if not index.is_file():
        raise RuntimeError(
            "Frontend build missing. Run npm ci and npm run build in the web directory."
        )
    api = Api()
    window = webview.create_window(
        "SyncForge",
        url=str(index),
        js_api=api,
        width=1000,
        height=750,
        text_select=True,
    )
    connect_frontend(window, api)
    webview.start(debug=False, gui="qt" if sys.platform == "linux" else None)


def main():
    freeze_support()
    from syncforge.core.processes import hide_child_consoles

    hide_child_consoles()
    if sys.argv[1:2] == ["--ffsubsync"]:
        sys.argv = [sys.argv[0], *sys.argv[2:]]
        if sys.stdout is None:
            sys.stdout = open(os.devnull, "w")
        if sys.stderr is None:
            sys.stderr = open(os.devnull, "w")
        from syncforge.core.process_env import external_tool_environment

        child_env = external_tool_environment()
        os.environ.clear()
        os.environ.update(child_env)
        from ffsubsync import main as sync_subtitles

        sys.exit(sync_subtitles())
    launch_gui()
