import sys
import builtins
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QPushButton, QLabel, QTextEdit, QMessageBox, QInputDialog)
from PyQt6.QtGui import QFont, QFontDatabase, QIcon
from PyQt6.QtCore import Qt

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
        self.resize(900, 700)
        
        # Override built-in input to use a Qt Dialog
        builtins.input = self.custom_input
        
        self.init_ui()
        
        # Override stdout to redirect to console text edit
        sys.stdout = StreamInterceptor(self.console)

    def custom_input(self, prompt=""):
        # Process events so the UI is updated before the dialog pops up
        QApplication.processEvents()
        text, ok = QInputDialog.getText(self, "Input Required", prompt)
        # Log the prompt and the answer so the user sees it in the console history
        print(prompt + (text if ok else " [Cancelled]"))
        return text if ok else ""

    def init_ui(self):
        central_widget = QWidget()
        central_widget.setObjectName("CentralWidget")
        self.setCentralWidget(central_widget)
        
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(30, 30, 30, 30)
        layout.setSpacing(15)

        title = QLabel("SyncForge")
        title.setObjectName("Title")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        
        subtitle = QLabel("Advanced Audio & Video Synchronization")
        subtitle.setObjectName("Subtitle")
        subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(subtitle)

        # Buttons
        from features.stream_manager import run_stream_manager, run_set_default_tracks
        from features.sub_sync import run_sync_subs, run_sync_subs_from_mkv
        from features.injection import run_injection
        from features.custom_merge import run_custom_merge

        self.buttons = [
            ("Stream Manager (Smart Batch)", run_stream_manager),
            ("Set Default & Forced Tracks (In-Place)", run_set_default_tracks),
            ("Sync External Subtitles (.srt to Video)", run_sync_subs),
            ("Sync Subtitles from another MKV", run_sync_subs_from_mkv),
            ("Inject Source into Target (WaveSync + Sub Sync)", run_injection),
            ("Custom Merge (Grab tracks from 2 folders)", run_custom_merge),
        ]

        for text, func in self.buttons:
            btn = QPushButton(text)
            btn.setObjectName("MenuButton")
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.clicked.connect(lambda checked, f=func: self.run_module(f))
            layout.addWidget(btn)

        self.console = QTextEdit()
        self.console.setObjectName("Console")
        self.console.setReadOnly(True)
        layout.addWidget(self.console)

        # APPLY MODERN STYLESHEET
        self.apply_styles()

    def apply_styles(self):
        font = QFont("Inter", 10)
        QApplication.setFont(font)
        
        style = """
        QWidget#CentralWidget {
            background-color: #0F172A;
        }
        QLabel#Title {
            font-size: 32px;
            font-weight: 800;
            color: #F8FAFC;
            letter-spacing: 1px;
            margin-bottom: 0px;
        }
        QLabel#Subtitle {
            font-size: 14px;
            font-weight: 400;
            color: #94A3B8;
            margin-bottom: 20px;
        }
        QPushButton#MenuButton {
            background-color: #1E293B;
            color: #E2E8F0;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 12px;
            font-size: 14px;
            font-weight: 600;
            text-align: left;
            padding-left: 20px;
        }
        QPushButton#MenuButton:hover {
            background-color: #3B82F6;
            color: white;
            border: 1px solid #60A5FA;
        }
        QPushButton#MenuButton:pressed {
            background-color: #2563EB;
        }
        QTextEdit#Console {
            background-color: #0B0F19;
            color: #38BDF8;
            border: 1px solid #1E293B;
            border-radius: 8px;
            padding: 15px;
            font-family: Consolas, "Courier New", monospace;
            font-size: 12px;
            margin-top: 15px;
        }
        QInputDialog {
            background-color: #1E293B;
            color: white;
        }
        QInputDialog QLabel {
            color: white;
            font-weight: bold;
        }
        QInputDialog QLineEdit {
            background-color: #0F172A;
            color: white;
            border: 1px solid #3B82F6;
            border-radius: 4px;
            padding: 5px;
        }
        QInputDialog QPushButton {
            background-color: #3B82F6;
            color: white;
            border-radius: 4px;
            padding: 5px 15px;
            font-weight: bold;
        }
        QInputDialog QPushButton:hover {
            background-color: #60A5FA;
        }
        """
        self.setStyleSheet(style)

    def run_module(self, func):
        print(f"\n--- Starting: {func.__name__} ---\n")
        
        for btn in self.findChildren(QPushButton):
            btn.setEnabled(False)

        try:
            func()
        except Exception as e:
            print(f"\n[ERROR] {e}")
            
        print(f"\n--- Process finished ---")
        for btn in self.findChildren(QPushButton):
            btn.setEnabled(True)

def run_app():
    app = QApplication(sys.argv)
    
    # Force Inter font
    import os
    font_path_reg = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts', 'Inter-Regular.ttf')
    font_path_bold = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts', 'Inter-Bold.ttf')
    
    # In PyInstaller --onedir, the path needs to be resolved based on sys._MEIPASS or executable location
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
