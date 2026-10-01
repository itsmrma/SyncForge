import PyInstaller.__main__
import os
import sys

sep = os.pathsep

options = [
    'main.py',
    '--name=SyncForge',
    '--onefile',
    '--windowed',
    '--noconfirm',
    '--collect-all=notifypy',
    '--collect-all=ffsubsync',
    '--additional-hooks-dir=hooks',
    f'--add-data=web/dist{sep}web/dist',
]
if sys.platform == 'linux':
    options += ['--hidden-import=webview.platforms.qt',
                '--hidden-import=PySide6.QtWebEngineCore',
                '--hidden-import=PySide6.QtWebEngineWidgets']
PyInstaller.__main__.run(options)
