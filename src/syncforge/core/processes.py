"""Hidden, cancellable subprocesses shared by analysis and processing."""
import os
import signal
import subprocess

from syncforge.core.process_env import external_tool_environment
from syncforge.core.tasks import check_cancelled


def start_process(cmd, *, cwd=None, capture=False, bundled=False):
    check_cancelled()
    options = dict(stdout=subprocess.PIPE, stderr=subprocess.PIPE if capture else subprocess.STDOUT,
                   cwd=cwd, env=os.environ.copy() if bundled else external_tool_environment(),
                   text=True, encoding='utf-8', errors='replace', stdin=subprocess.DEVNULL)
    if os.name == 'nt':
        options['creationflags'] = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
        info = subprocess.STARTUPINFO()
        info.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        info.wShowWindow = 0
        options['startupinfo'] = info
    else:
        options['start_new_session'] = True
    return subprocess.Popen(cmd, **options)


def stop_process_tree(process):
    if process.poll() is not None:
        return
    if os.name == 'nt':
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       creationflags=subprocess.CREATE_NO_WINDOW, timeout=10)
    else:
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    process.wait(timeout=10)


def capture_command(cmd, *, cwd=None):
    process = start_process(cmd, cwd=cwd, capture=True)
    try:
        while True:
            check_cancelled()
            try:
                stdout, stderr = process.communicate(timeout=0.1)
                break
            except subprocess.TimeoutExpired:
                continue
        check_cancelled()
        return subprocess.CompletedProcess(cmd, process.returncode, stdout, stderr)
    finally:
        if process.poll() is None:
            stop_process_tree(process)


def hide_child_consoles():
    """Also cover ffmpeg calls made inside ffsubsync/third-party libraries."""
    if os.name != 'nt' or getattr(subprocess.Popen, '_syncforge_hidden', False):
        return
    original = subprocess.Popen

    class HiddenPopen(original):
        _syncforge_hidden = True

        def __init__(self, *args, **kwargs):
            kwargs['creationflags'] = kwargs.get('creationflags', 0) | subprocess.CREATE_NO_WINDOW
            super().__init__(*args, **kwargs)

    subprocess.Popen = HiddenPopen
