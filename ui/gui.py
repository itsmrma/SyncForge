import sys
import builtins
import qtawesome as qta
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                             QPushButton, QLabel, QTextEdit, QInputDialog)
from PyQt6.QtGui import QFont, QFontDatabase, QIcon
from PyQt6.QtCore import Qt, QSize

class StreamInterceptor:
    def __init__(self, text_widget):
        self.text_widget = text_widget

    def write(self, text):
        self.text_widget.insertPlainText(text)
        self.text_widget.verticalScrollBar().setValue(self.text_widget.verticalScrollBar().maximum())
        QApplication.processEvents()

    def flush(self):
        pass

class SyncForgeApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("SyncForge")
        self.resize(1000, 750)
        
        # Override built-in input to use a Qt Dialog
        builtins.input = self.custom_input
        self.selected_func = None
        
        self.init_ui()
        sys.stdout = StreamInterceptor(self.console)

    def custom_input(self, prompt=""):
        QApplication.processEvents()
        text, ok = QInputDialog.getText(self, "Input Required", prompt)
        print(prompt + (text if ok else " [Canceled]"))
        return text if ok else ""

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

        from features.stream_manager import run_stream_manager, run_set_default_tracks
        from features.sub_sync import run_sync_subs, run_sync_subs_from_mkv
        from features.injection import run_injection
        from features.custom_merge import run_custom_merge

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
            
            # Material Design colors for icons
            icon_color = '#CAC4D0' # On-Surface-Variant
            btn.setIcon(qta.icon(mod["icon"], color=icon_color))
            btn.setIconSize(QSize(22, 22))
            
            btn.clicked.connect(lambda checked, idx=i: self.select_module(idx))
            sidebar_layout.addWidget(btn)
            self.sidebar_buttons.append(btn)

        sidebar_container = QWidget()
        sidebar_container.setFixedWidth(260)
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
        self.btn_open.hide() # Hidden until selection
        self.btn_open.clicked.connect(self.run_selected_module)
        
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        button_layout.addWidget(self.btn_open)
        details_layout.addLayout(button_layout)

        content_layout.addWidget(details_widget)
        main_layout.addLayout(content_layout)

        # Console
        self.console = QTextEdit()
        self.console.setObjectName("Console")
        self.console.setReadOnly(True)
        self.console.setFixedHeight(200)
        main_layout.addWidget(self.console)

        self.apply_styles()

    def select_module(self, idx):
        mod = self.modules[idx]
        self.lbl_mod_title.setText(mod["title"])
        self.lbl_mod_desc.setText(mod["desc"])
        self.selected_func = mod["func"]
        self.btn_open.show()
        
        # Highlight selected button (Material 3 Secondary Container behavior)
        for i, btn in enumerate(self.sidebar_buttons):
            if i == idx:
                btn.setProperty("selected", "true")
                btn.setIcon(qta.icon(self.modules[i]["icon"], color='#E8DEF8')) # On Secondary Container
            else:
                btn.setProperty("selected", "false")
                btn.setIcon(qta.icon(self.modules[i]["icon"], color='#CAC4D0')) # On Surface Variant
            # Refresh stylesheet state
            btn.style().unpolish(btn)
            btn.style().polish(btn)

    def run_selected_module(self):
        if not self.selected_func: return
        print(f"\\n--- Launching Module: {self.lbl_mod_title.text()} ---\\n")
        
        self.btn_open.setEnabled(False)
        self.btn_open.setIcon(qta.icon('mdi.rocket-launch', color='#938F99'))
        # Disable sidebar during run
        for btn in self.sidebar_buttons:
            btn.setEnabled(False)

        try:
            self.selected_func()
        except Exception as e:
            print(f"\\n[ERROR] {e}")
            
        print(f"\\n--- Module finished ---")
        self.btn_open.setEnabled(True)
        self.btn_open.setIcon(qta.icon('mdi.rocket-launch', color='#381E72'))
        for btn in self.sidebar_buttons:
            btn.setEnabled(True)

    def apply_styles(self):
        font = QFont("Inter", 10)
        QApplication.setFont(font)
        
        # Material Design 3 (M3) Dark Theme Colors
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
        QInputDialog {
            background-color: #211F26;
            color: #E6E0E9;
        }
        QInputDialog QLabel {
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
        QInputDialog QPushButton {
            background-color: #D0BCFF;
            color: #381E72;
            border-radius: 16px;
            padding: 8px 24px;
            font-weight: 700;
        }
        QInputDialog QPushButton:hover {
            background-color: #B69DF8;
        }
        """
        self.setStyleSheet(style)

def run_app():
    app = QApplication(sys.argv)
    
    # Force Inter font
    import os
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
