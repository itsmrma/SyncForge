import sys
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QPushButton, QLabel, QTextEdit, QMessageBox, QInputDialog)
from PyQt6.QtCore import pyqtSignal, QObject, QThread
import traceback

class WorkerSignals(QObject):
    finished = pyqtSignal()
    error = pyqtSignal(str)
    log = pyqtSignal(str)
    request_input = pyqtSignal(str, str, dict) # title, prompt, response_dict

class Worker(QThread):
    def __init__(self, target, *args, **kwargs):
        super().__init__()
        self.target = target
        self.args = args
        self.kwargs = kwargs
        self.signals = WorkerSignals()
        
    def run(self):
        try:
            self.target(*self.args, **self.kwargs)
            self.signals.finished.emit()
        except Exception as e:
            err = traceback.format_exc()
            self.signals.error.emit(str(e) + "\n" + err)

class SyncForgeApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("SyncForge - Audio & Video Sync")
        self.resize(800, 600)
        self.init_ui()
        self.worker = None

    def init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)

        title = QLabel("🎬⚒️ SyncForge")
        title.setStyleSheet("font-size: 24px; font-weight: bold; margin-bottom: 10px;")
        layout.addWidget(title)

        # Buttons
        from features.stream_manager import run_stream_manager, run_set_default_tracks
        from features.sub_sync import run_sync_subs, run_sync_subs_from_mkv
        from features.injection import run_injection
        from features.custom_merge import run_custom_merge

        self.buttons = [
            ("1. Stream Manager (Smart Batch)", run_stream_manager),
            ("1b. Set Default & Forced Tracks (In-Place)", run_set_default_tracks),
            ("2. Sync External Subtitles (.srt to Video)", run_sync_subs),
            ("2b. Sync Subtitles from another MKV", run_sync_subs_from_mkv),
            ("3. Inject Source into Target (WaveSync + Sub Sync)", run_injection),
            ("4. Custom Merge (Grab tracks from 2 folders)", run_custom_merge),
        ]

        for text, func in self.buttons:
            btn = QPushButton(text)
            btn.setStyleSheet("padding: 10px; font-size: 14px;")
            btn.clicked.connect(lambda checked, f=func: self.run_module(f))
            layout.addWidget(btn)

        self.console = QTextEdit()
        self.console.setReadOnly(True)
        self.console.setStyleSheet("background-color: #1e1e1e; color: #d4d4d4; font-family: monospace;")
        layout.addWidget(self.console)

    def log(self, text):
        self.console.append(text)

    def run_module(self, func):
        self.log(f"\n--- Starting Module: {func.__name__} ---")
        
        # Disable buttons
        for btn in self.findChildren(QPushButton):
            btn.setEnabled(False)

        # In a real app we'd redirect stdout and input. 
        # For this transition phase, we'll run it in a thread. 
        # Note: Tkinter/filedialog and inputs inside the thread might freeze or crash.
        # So we warn the user.
        QMessageBox.information(self, "Console Mode", 
            "The module will now run. Please check the terminal/console window for prompts and progress, "
            "as the PyQt6 transition is actively replacing the console prompts.")
        
        # We will run it synchronously for now to keep the console `input()` working until fully refactored
        try:
            func()
        except Exception as e:
            self.log(f"Error: {e}")
            
        self.log(f"--- Module finished ---")
        for btn in self.findChildren(QPushButton):
            btn.setEnabled(True)

def run_app():
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    window = SyncForgeApp()
    window.show()
    sys.exit(app.exec())
