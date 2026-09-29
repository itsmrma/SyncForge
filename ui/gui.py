import sys
import builtins
import subprocess
import time
import os
import qtawesome as qta
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                             QPushButton, QLabel, QTextEdit, QInputDialog, QFileDialog,
                             QProgressBar, QMessageBox)
from PyQt6.QtGui import QFont, QFontDatabase, QIcon
from PyQt6.QtCore import Qt, QSize

from features.stream_manager import run_stream_manager, run_set_default_tracks
from features.sub_sync import run_sync_subs, run_sync_subs_from_mkv
from features.injection import run_injection
from features.custom_merge import run_custom_merge

# --- CACHES FOR RETRY MECHANISM ---

class FileDialogCache:
    def __init__(self):
        self.cache = []
        self.index = 0
        self.replaying = False
        self.orig_getExistingDirectory = QFileDialog.getExistingDirectory

    def getExistingDirectory(self, parent=None, caption="", directory="", options=None):
        if self.replaying and self.index < len(self.cache):
            res = self.cache[self.index]
            self.index += 1
            print(f"[Cached Input] {caption}: {res}")
            return res
            
        if options is not None:
            res = self.orig_getExistingDirectory(parent, caption, directory, options)
        else:
            res = self.orig_getExistingDirectory(parent, caption, directory)
            
        if not self.replaying:
            self.cache.append(res)
        return res

fd_cache = FileDialogCache()
QFileDialog.getExistingDirectory = fd_cache.getExistingDirectory


class InputCache:
    def __init__(self):
        self.cache = []
        self.index = 0
        self.replaying = False
        self.main_win = None

    def custom_input(self, prompt=""):
        if self.replaying and self.index < len(self.cache):
            res = self.cache[self.index]
            self.index += 1
            print(prompt + res + " [Cached]")
            return res
            
        QApplication.processEvents()
        text, ok = QInputDialog.getText(self.main_win, "Input Required", prompt)
        res = text if ok else ""
        print(prompt + (res if ok else " [Canceled]"))
        
        if not self.replaying:
            self.cache.append(res)
        return res

input_cache = InputCache()
builtins.input = input_cache.custom_input


# Patch FileMatcherUI.exec so we can cache that too
try:
    from ui.matcher_ui import FileMatcherUI
    orig_matcher_exec = FileMatcherUI.exec

    class MatcherCache:
        def __init__(self):
            self.cache = []
            self.index = 0
            self.replaying = False

        def _exec_impl(self, dialog_instance):
            if self.replaying and self.index < len(self.cache):
                res = self.cache[self.index]
                self.index += 1
                dialog_instance.result = res
                dialog_instance.accept()
                return 1 # Accepted
                
            ret = orig_matcher_exec(dialog_instance)
            
            if not self.replaying:
                self.cache.append(dialog_instance.result)
            return ret

    matcher_cache = MatcherCache()
    def exec_override(dialog_instance):
        return matcher_cache._exec_impl(dialog_instance)
    FileMatcherUI.exec = exec_override
except ImportError:
    pass

# --- NON-BLOCKING SUBPROCESS PATCH ---

orig_run = subprocess.run

def run_with_events(*args, **kwargs):
    try:
        capture = kwargs.pop('capture_output', False)
        if capture:
            kwargs['stdout'] = subprocess.PIPE
            kwargs['stderr'] = subprocess.PIPE
            
        p = subprocess.Popen(*args, **kwargs)
        while p.poll() is None:
            QApplication.processEvents()
            time.sleep(0.01)
            
        stdout, stderr = p.communicate()
        return subprocess.CompletedProcess(p.args, p.returncode, stdout, stderr)
    except FileNotFoundError as e:
        raise e

subprocess.run = run_with_events


# --- GUI ---

class StreamInterceptor:
    def __init__(self, text_widget):
        self.text_widget = text_widget
        self.last_update = 0

    def write(self, text):
        self.text_widget.insertPlainText(text)
        
        now = time.time()
        if now - self.last_update > 0.05:
            self.text_widget.verticalScrollBar().setValue(self.text_widget.verticalScrollBar().maximum())
            QApplication.processEvents()
            self.last_update = now

    def flush(self):
        pass

class SyncForgeApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("SyncForge")
        self.resize(1000, 750)
        
        input_cache.main_win = self
        self.selected_func = None
        
        self.init_ui()
        sys.stdout = StreamInterceptor(self.console)

    def init_ui(self):
        central_widget = QWidget()
        central_widget.setObjectName("CentralWidget")
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(24, 24, 24, 24)
        main_layout.setSpacing(16)

        # Header
        header_layout = QHBoxLayout()
        header_text_layout = QVBoxLayout()
        title = QLabel("SyncForge")
        title.setObjectName("Title")
        header_text_layout.addWidget(title)
        
        subtitle = QLabel("Advanced Audio & Video Synchronization")
        subtitle.setObjectName("Subtitle")
        header_text_layout.addWidget(subtitle)
        
        header_layout.addLayout(header_text_layout)
        header_layout.addStretch()
        main_layout.addLayout(header_layout)

        # Middle Content: Sidebar + Details
        content_layout = QHBoxLayout()
        content_layout.setSpacing(16)

        # Left Sidebar (Buttons)
        sidebar_layout = QVBoxLayout()
        sidebar_layout.setSpacing(8)
        sidebar_layout.setAlignment(Qt.AlignmentFlag.AlignTop)

        self.modules = [
            {
                "title": "Stream Manager",
                "desc": "Select a folder of MKV files and batch-remove unwanted audio or subtitle tracks. The operation is lossless and instantaneous (no video re-encoding).",
                "func": run_stream_manager,
                "icon": "mdi.format-list-checks"
            },
            {
                "title": "Set Default & Forced",
                "desc": "Modify the 'Default' and 'Forced' track flags across an entire batch of MKV files. Useful to ensure your player selects the right audio and subs automatically.",
                "func": run_set_default_tracks,
                "icon": "mdi.flag"
            },
            {
                "title": "Sync External Subtitles",
                "desc": "Automatically align your .srt files to the video's audio track. Leverages FFsubsync to analyze speech waveforms and fix out-of-sync issues.",
                "func": run_sync_subs,
                "icon": "mdi.subtitles"
            },
            {
                "title": "Sync Subs from MKV",
                "desc": "Automatically extracts subtitles from a 'Source' MKV and realigns them to the audio of a 'Target' MKV. Perfect if you switched releases.",
                "func": run_sync_subs_from_mkv,
                "icon": "mdi.sync"
            },
            {
                "title": "WaveSync Injection",
                "desc": "The real magic. Automatically calculates the exact delay (in milliseconds) between the audio of two different video files. Extracts audio and subs from the Source, syncs them, and injects them into the Target.",
                "func": run_injection,
                "icon": "mdi.waveform"
            },
            {
                "title": "Custom Track Merge",
                "desc": "Combine specific tracks from two different batches of videos (Folder A and Folder B) to create the ultimate hybrid file.",
                "func": run_custom_merge,
                "icon": "mdi.source-merge"
            }
        ]

        self.sidebar_buttons = []
        for i, mod in enumerate(self.modules):
            btn = QPushButton(f"  {mod['title']}")
            btn.setObjectName("SidebarButton")
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            
            icon_color = '#CAC4D0' 
            btn.setIcon(qta.icon(mod["icon"], color=icon_color))
            btn.setIconSize(QSize(22, 22))
            
            btn.clicked.connect(lambda checked, idx=i: self.select_module(idx))
            sidebar_layout.addWidget(btn)
            self.sidebar_buttons.append(btn)

        sidebar_layout.addSpacing(20)
        
        self.btn_repeat = QPushButton("  Repeat Last Operation")
        self.btn_repeat.setObjectName("RepeatButton")
        self.btn_repeat.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_repeat.setIcon(qta.icon('mdi.replay', color='#CAC4D0'))
        self.btn_repeat.setIconSize(QSize(22, 22))
        self.btn_repeat.clicked.connect(self.run_repeat)
        self.btn_repeat.setEnabled(False)
        sidebar_layout.addWidget(self.btn_repeat)
        
        lbl_repeat_desc = QLabel("Re-executes the last operation (same module, same folders & inputs).")
        lbl_repeat_desc.setObjectName("RepeatDesc")
        lbl_repeat_desc.setWordWrap(True)
        sidebar_layout.addWidget(lbl_repeat_desc)

        sidebar_container = QWidget()
        sidebar_container.setFixedWidth(260)
        
        # Settings Area in Sidebar
        sidebar_layout.addStretch()
        
        settings_layout = QVBoxLayout()
        settings_layout.setSpacing(6)
        settings_label = QLabel("FFsubsync Max Offset (s):")
        settings_label.setStyleSheet("color: #CAC4D0; font-size: 13px; font-weight: 600;")
        
        from PyQt6.QtWidgets import QSpinBox
        self.spin_offset = QSpinBox()
        self.spin_offset.setRange(0, 60)
        self.spin_offset.setValue(1)
        self.spin_offset.setSpecialValueText("0 (No Limit)")
        
        settings_layout.addWidget(settings_label)
        settings_layout.addWidget(self.spin_offset)
        
        from PyQt6.QtWidgets import QCheckBox
        self.chk_sync_audio = QCheckBox("Auto-sync Audio (WaveSync)")
        self.chk_sync_audio.setChecked(True)
        self.chk_sync_audio.setStyleSheet("color: #CAC4D0; font-size: 13px;")
        
        self.chk_sync_subs = QCheckBox("Auto-sync Subs (FFsubsync)")
        self.chk_sync_subs.setChecked(True)
        self.chk_sync_subs.setStyleSheet("color: #CAC4D0; font-size: 13px;")
        
        settings_layout.addSpacing(10)
        settings_layout.addWidget(self.chk_sync_audio)
        settings_layout.addWidget(self.chk_sync_subs)
        
        sidebar_layout.addLayout(settings_layout)

        sidebar_container.setLayout(sidebar_layout)
        content_layout.addWidget(sidebar_container)

        # Right Details Panel
        details_widget = QWidget()
        details_widget.setObjectName("DetailsPanel")
        details_layout = QVBoxLayout(details_widget)
        details_layout.setContentsMargins(32, 32, 32, 32)
        details_layout.setSpacing(24)

        self.lbl_mod_title = QLabel("Select a module")
        self.lbl_mod_title.setObjectName("DetailTitle")
        details_layout.addWidget(self.lbl_mod_title)

        self.lbl_mod_desc = QLabel("Click on one of the tools in the left menu to discover its features and launch it.")
        self.lbl_mod_desc.setObjectName("DetailDesc")
        self.lbl_mod_desc.setWordWrap(True)
        self.lbl_mod_desc.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        details_layout.addWidget(self.lbl_mod_desc, stretch=1)

        self.btn_open = QPushButton("  Launch Module")
        self.btn_open.setObjectName("LaunchButton")
        self.btn_open.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_open.setIcon(qta.icon('mdi.rocket-launch', color='#381E72'))
        self.btn_open.setIconSize(QSize(20, 20))
        self.btn_open.hide() 
        self.btn_open.clicked.connect(self.run_selected_module)
        
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        button_layout.addWidget(self.btn_open)
        details_layout.addLayout(button_layout)

        content_layout.addWidget(details_widget)
        main_layout.addLayout(content_layout, stretch=1)

        # Bottom Area
        bottom_layout = QVBoxLayout()
        bottom_layout.setSpacing(12)
        
        progress_layout = QHBoxLayout()
        self.progress_bar = QProgressBar()
        self.progress_bar.setObjectName("ProgressBar")
        self.progress_bar.setTextVisible(False)
        self.progress_bar.setFixedHeight(8)
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        
        self.btn_toggle_console = QPushButton("  Show Terminal")
        self.btn_toggle_console.setObjectName("ToggleConsoleButton")
        self.btn_toggle_console.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_toggle_console.setIcon(qta.icon('mdi.chevron-down', color='#CAC4D0'))
        self.btn_toggle_console.setCheckable(True)
        self.btn_toggle_console.clicked.connect(self.toggle_console)
        
        progress_layout.addWidget(self.progress_bar, stretch=1)
        progress_layout.addWidget(self.btn_toggle_console)
        
        bottom_layout.addLayout(progress_layout)
        
        self.console = QTextEdit()
        self.console.setObjectName("Console")
        self.console.setReadOnly(True)
        self.console.setFixedHeight(200)
        self.console.hide()
        
        bottom_layout.addWidget(self.console)
        main_layout.addLayout(bottom_layout)

        self.apply_styles()

    def select_module(self, idx):
        mod = self.modules[idx]
        self.lbl_mod_title.setText(mod["title"])
        self.lbl_mod_desc.setText(mod["desc"])
        self.selected_func = mod["func"]
        self.btn_open.show()
        
        for i, btn in enumerate(self.sidebar_buttons):
            if i == idx:
                btn.setProperty("selected", "true")
                btn.setIcon(qta.icon(self.modules[i]["icon"], color='#E8DEF8')) 
            else:
                btn.setProperty("selected", "false")
                btn.setIcon(qta.icon(self.modules[i]["icon"], color='#CAC4D0')) 
            btn.style().unpolish(btn)
            btn.style().polish(btn)

    def toggle_console(self, checked):
        if checked:
            self.console.show()
            self.btn_toggle_console.setText("  Hide Terminal")
            self.btn_toggle_console.setIcon(qta.icon('mdi.chevron-up', color='#CAC4D0'))
        else:
            self.console.hide()
            self.btn_toggle_console.setText("  Show Terminal")
            self.btn_toggle_console.setIcon(qta.icon('mdi.chevron-down', color='#CAC4D0'))

    def run_selected_module(self):
        if not self.selected_func: return
        print(f"\n--- Launching Module: {self.lbl_mod_title.text()} ---\n")
        import core.config
        core.config.MAX_OFFSET_SECONDS = self.spin_offset.value()
        core.config.AUTO_SYNC_AUDIO = self.chk_sync_audio.isChecked()
        core.config.AUTO_SYNC_SUBS = self.chk_sync_subs.isChecked()
        
        self.btn_open.setEnabled(False)
        self.btn_repeat.setEnabled(False)
        self.btn_open.setIcon(qta.icon('mdi.rocket-launch', color='#938F99'))
        for btn in self.sidebar_buttons:
            btn.setEnabled(False)
            
        self.progress_bar.setRange(0, 0)
        
        # Clear caches for new normal run
        fd_cache.cache = []
        input_cache.cache = []
        try:
            matcher_cache.cache = []
        except NameError:
            pass

        while True:
            try:
                self.selected_func()
                break
            except FileNotFoundError as e:
                missing_exe = e.filename if e.filename else str(e)
                self.progress_bar.setRange(0, 100)
                self.progress_bar.setValue(0)
                
                msg = QMessageBox(self)
                msg.setIcon(QMessageBox.Icon.Critical)
                msg.setWindowTitle("Missing Dependency")
                msg.setText(f"A required dependency is missing: {missing_exe}")
                msg.setInformativeText("Please install it and make sure it's accessible in your system PATH.\n\nDo you want to retry with the same selections?")
                msg.setStyleSheet(self.styleSheet())
                
                retry_btn = msg.addButton("Retry", QMessageBox.ButtonRole.AcceptRole)
                cancel_btn = msg.addButton("Cancel", QMessageBox.ButtonRole.RejectRole)
                msg.exec()
                
                if msg.clickedButton() == retry_btn:
                    fd_cache.replaying = True
                    fd_cache.index = 0
                    input_cache.replaying = True
                    input_cache.index = 0
                    try:
                        matcher_cache.replaying = True
                        matcher_cache.index = 0
                    except NameError:
                        pass
                        
                    self.progress_bar.setRange(0, 0)
                    print(f"\n[INFO] Retrying module with cached selections...")
                    continue
                else:
                    break
            except Exception as e:
                print(f"\n[ERROR] {e}")
                break
                
        # DO NOT Reset caches so we can repeat later
        fd_cache.replaying = False
        input_cache.replaying = False
        try:
            matcher_cache.replaying = False
        except NameError:
            pass

        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(100)
        
        print(f"\n--- Module finished ---")
        self.btn_open.setEnabled(True)
        self.btn_repeat.setEnabled(True)
        self.btn_open.setIcon(qta.icon('mdi.rocket-launch', color='#381E72'))
        for btn in self.sidebar_buttons:
            btn.setEnabled(True)
            
    def run_repeat(self):
        if not self.selected_func: return
        print(f"\n--- Repeating Last Operation ({self.lbl_mod_title.text()}) ---\n")
        
        self.btn_open.setEnabled(False)
        self.btn_repeat.setEnabled(False)
        for btn in self.sidebar_buttons:
            btn.setEnabled(False)
            
        self.progress_bar.setRange(0, 0)

        fd_cache.replaying = True
        fd_cache.index = 0
        input_cache.replaying = True
        input_cache.index = 0
        try:
            matcher_cache.replaying = True
            matcher_cache.index = 0
        except NameError:
            pass

        try:
            self.selected_func()
        except Exception as e:
            print(f"\n[ERROR] {e}")

        fd_cache.replaying = False
        input_cache.replaying = False
        try:
            matcher_cache.replaying = False
        except NameError:
            pass

        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(100)
        
        print(f"\n--- Repeat finished ---")
        self.btn_open.setEnabled(True)
        self.btn_repeat.setEnabled(True)
        for btn in self.sidebar_buttons:
            btn.setEnabled(True)

    def apply_styles(self):
        font = QFont("Inter", 10)
        QApplication.setFont(font)
        
        style = """
        QWidget#CentralWidget {
            background-color: #141218;
        }
        QLabel#Title {
            font-size: 28px;
            font-weight: 800;
            color: #E6E0E9;
            letter-spacing: 0.5px;
        }
        QLabel#Subtitle {
            font-size: 14px;
            font-weight: 500;
            color: #CAC4D0;
        }
        QPushButton#SidebarButton {
            background-color: transparent;
            color: #CAC4D0;
            border: none;
            border-radius: 24px;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: 600;
            text-align: left;
        }
        QPushButton#SidebarButton:hover {
            background-color: #2B2930;
            color: #E6E0E9;
        }
        QPushButton#SidebarButton[selected="true"] {
            background-color: #4A4458;
            color: #E8DEF8;
        }
        QWidget#DetailsPanel {
            background-color: #211F26;
            border-radius: 24px;
        }
        QLabel#DetailTitle {
            font-size: 24px;
            font-weight: 800;
            color: #E6E0E9;
        }
        QLabel#DetailDesc {
            font-size: 15px;
            font-weight: 400;
            color: #CAC4D0;
            line-height: 1.6;
        }
        QPushButton#LaunchButton {
            background-color: #D0BCFF;
            color: #381E72;
            border: none;
            border-radius: 20px;
            padding: 12px 32px;
            font-size: 15px;
            font-weight: 700;
        }
        QPushButton#LaunchButton:hover {
            background-color: #B69DF8;
        }
        QPushButton#LaunchButton:disabled {
            background-color: #36343B;
            color: #938F99;
        }
        QTextEdit#Console {
            background-color: #1D1B20;
            color: #D0BCFF;
            border: 1px solid #36343B;
            border-radius: 16px;
            padding: 16px;
            font-family: Consolas, "Courier New", monospace;
            font-size: 13px;
        }
        QInputDialog, QMessageBox {
            background-color: #211F26;
            color: #E6E0E9;
        }
        QInputDialog QLabel, QMessageBox QLabel {
            color: #E6E0E9;
            font-weight: 600;
        }
        QInputDialog QLineEdit {
            background-color: #141218;
            color: #E6E0E9;
            border: 1px solid #938F99;
            border-radius: 8px;
            padding: 8px;
        }
        QInputDialog QLineEdit:focus {
            border: 2px solid #D0BCFF;
        }
        QInputDialog QPushButton, QMessageBox QPushButton {
            background-color: #D0BCFF;
            color: #381E72;
            border-radius: 16px;
            padding: 8px 24px;
            font-weight: 700;
        }
        QInputDialog QPushButton:hover, QMessageBox QPushButton:hover {
            background-color: #B69DF8;
        }
        QSpinBox {
            background-color: #1D1B20;
            color: #E6E0E9;
            border: 1px solid #4A4458;
            border-radius: 6px;
            padding: 6px;
        }
        QSpinBox::up-button, QSpinBox::down-button {
            background-color: transparent;
            width: 16px;
        }
        QProgressBar#ProgressBar {
            background-color: #36343B;
            border-radius: 4px;
            border: none;
        }
        QProgressBar#ProgressBar::chunk {
            background-color: #D0BCFF;
            border-radius: 4px;
            width: 20px;
        }
        QPushButton#ToggleConsoleButton {
            background-color: transparent;
            color: #CAC4D0;
            border: none;
            font-size: 13px;
            font-weight: 600;
            padding: 4px;
        }
        QPushButton#ToggleConsoleButton:hover {
            color: #E6E0E9;
        }
        """
        self.setStyleSheet(style)

def run_app():
    app = QApplication(sys.argv)
    
    # Force Inter font
    font_path_reg = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts', 'Inter-Regular.ttf')
    font_path_bold = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts', 'Inter-Bold.ttf')
    
    if hasattr(sys, '_MEIPASS'):
        font_path_reg = os.path.join(sys._MEIPASS, 'assets', 'fonts', 'Inter-Regular.ttf')
        font_path_bold = os.path.join(sys._MEIPASS, 'assets', 'fonts', 'Inter-Bold.ttf')

    if os.path.exists(font_path_reg):
        QFontDatabase.addApplicationFont(font_path_reg)
    if os.path.exists(font_path_bold):
        QFontDatabase.addApplicationFont(font_path_bold)
        
    app.setFont(QFont("Inter", 10))
    
    window = SyncForgeApp()
    window.show()
    sys.exit(app.exec())
