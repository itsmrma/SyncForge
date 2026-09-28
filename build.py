import PyInstaller.__main__
import os

sep = os.pathsep

PyInstaller.__main__.run([
    'main.py',
    '--name=SyncForge',
    '--onefile',
    '--windowed',
    '--noconfirm',
    f'--add-data=assets/fonts{sep}assets/fonts',
])
