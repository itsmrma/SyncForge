import sys
import builtins
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                             QPushButton, QLabel, QTextEdit, QInputDialog)
from PyQt6.QtGui import QFont, QFontDatabase
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
        self.resize(950, 750)
        
        # Override built-in input to use a Qt Dialog
        builtins.input = self.custom_input
        self.selected_func = None
        
        self.init_ui()
        sys.stdout = StreamInterceptor(self.console)

    def custom_input(self, prompt=""):
        QApplication.processEvents()
        text, ok = QInputDialog.getText(self, "Input Required", prompt)
        print(prompt + (text if ok else " [Annullato]"))
        return text if ok else ""

    def init_ui(self):
        central_widget = QWidget()
        central_widget.setObjectName("CentralWidget")
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(30, 30, 30, 30)
        main_layout.setSpacing(20)

        # Header
        header_layout = QVBoxLayout()
        title = QLabel("SyncForge")
        title.setObjectName("Title")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header_layout.addWidget(title)
        
        subtitle = QLabel("Advanced Audio & Video Synchronization")
        subtitle.setObjectName("Subtitle")
        subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header_layout.addWidget(subtitle)
        main_layout.addLayout(header_layout)

        # Middle Content: Sidebar + Details
        content_layout = QHBoxLayout()
        content_layout.setSpacing(20)

        # Left Sidebar (Buttons)
        sidebar_layout = QVBoxLayout()
        sidebar_layout.setSpacing(10)
        sidebar_layout.setAlignment(Qt.AlignmentFlag.AlignTop)

        from features.stream_manager import run_stream_manager, run_set_default_tracks
        from features.sub_sync import run_sync_subs, run_sync_subs_from_mkv
        from features.injection import run_injection
        from features.custom_merge import run_custom_merge

        self.modules = [
            {
                "title": "Stream Manager",
                "desc": "Seleziona una cartella di file MKV ed elimina in blocco le tracce audio o sottotitoli che non ti servono. L'operazione è lossles e istantanea (non ricomprime il video).",
                "func": run_stream_manager
            },
            {
                "title": "Set Default & Forced Tracks",
                "desc": "Modifica i flag 'Default' e 'Forced' delle tracce su un intero lotto di file MKV. Utile per assicurarti che il tuo player selezioni l'audio e i subs giusti in automatico.",
                "func": run_set_default_tracks
            },
            {
                "title": "Sync External Subtitles",
                "desc": "Allinea automaticamente i tuoi file .srt all'audio di un video. Sfrutta FFsubsync per analizzare le onde vocali ed evitare fuori sincrono.",
                "func": run_sync_subs
            },
            {
                "title": "Sync Sub da un altro MKV",
                "desc": "Estrae in automatico i sottotitoli da un file MKV 'Sorgente' e li riallinea all'audio di un file MKV 'Destinazione'. Perfetto se hai cambiato release.",
                "func": run_sync_subs_from_mkv
            },
            {
                "title": "WaveSync Audio & Sub Injection",
                "desc": "La vera magia. Calcola automaticamente il ritardo esatto (in millisecondi) tra l'audio di due file video diversi. Estrae l'audio e i sub della Sorgente, li sincronizza e li inietta nel video Target.",
                "func": run_injection
            },
            {
                "title": "Custom Track Merge",
                "desc": "Combina tracce specifiche da due lotti di video differenti (Cartella A e Cartella B) per creare un file ibrido definitivo.",
                "func": run_custom_merge
            }
        ]

        self.sidebar_buttons = []
        for i, mod in enumerate(self.modules):
            btn = QPushButton(mod["title"])
            btn.setObjectName("SidebarButton")
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.clicked.connect(lambda checked, idx=i: self.select_module(idx))
            sidebar_layout.addWidget(btn)
            self.sidebar_buttons.append(btn)

        sidebar_container = QWidget()
        sidebar_container.setFixedWidth(280)
        sidebar_container.setLayout(sidebar_layout)
        content_layout.addWidget(sidebar_container)

        # Right Details Panel
        details_widget = QWidget()
        details_widget.setObjectName("DetailsPanel")
        details_layout = QVBoxLayout(details_widget)
        details_layout.setContentsMargins(25, 25, 25, 25)
        details_layout.setSpacing(15)

        self.lbl_mod_title = QLabel("Seleziona un modulo")
        self.lbl_mod_title.setObjectName("DetailTitle")
        details_layout.addWidget(self.lbl_mod_title)

        self.lbl_mod_desc = QLabel("Clicca su uno degli strumenti nel menu di sinistra per scoprirne le funzionalità e avviarlo.")
        self.lbl_mod_desc.setObjectName("DetailDesc")
        self.lbl_mod_desc.setWordWrap(True)
        self.lbl_mod_desc.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        details_layout.addWidget(self.lbl_mod_desc, stretch=1)

        self.btn_open = QPushButton("🚀 Apri Modulo")
        self.btn_open.setObjectName("LaunchButton")
        self.btn_open.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_open.hide() # Hidden until selection
        self.btn_open.clicked.connect(self.run_selected_module)
        details_layout.addWidget(self.btn_open)

        content_layout.addWidget(details_widget)
        main_layout.addLayout(content_layout)

        # Console
        self.console = QTextEdit()
        self.console.setObjectName("Console")
        self.console.setReadOnly(True)
        self.console.setFixedHeight(220)
        main_layout.addWidget(self.console)

        self.apply_styles()

    def select_module(self, idx):
        mod = self.modules[idx]
        self.lbl_mod_title.setText(mod["title"])
        self.lbl_mod_desc.setText(mod["desc"])
        self.selected_func = mod["func"]
        self.btn_open.show()
        
        # Highlight selected button
        for i, btn in enumerate(self.sidebar_buttons):
            if i == idx:
                btn.setProperty("selected", "true")
            else:
                btn.setProperty("selected", "false")
            # Refresh stylesheet state
            btn.style().unpolish(btn)
            btn.style().polish(btn)

    def run_selected_module(self):
        if not self.selected_func: return
        print(f"\\n--- Avvio Modulo: {self.lbl_mod_title.text()} ---\\n")
        
        self.btn_open.setEnabled(False)
        # Disable sidebar during run
        for btn in self.sidebar_buttons:
            btn.setEnabled(False)

        try:
            self.selected_func()
        except Exception as e:
            print(f"\\n[ERRORE] {e}")
            
        print(f"\\n--- Modulo terminato ---")
        self.btn_open.setEnabled(True)
        for btn in self.sidebar_buttons:
            btn.setEnabled(True)

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
            margin-bottom: -5px;
        }
        QLabel#Subtitle {
            font-size: 14px;
            font-weight: 400;
            color: #94A3B8;
        }
        QPushButton#SidebarButton {
            background-color: transparent;
            color: #94A3B8;
            border: 1px solid transparent;
            border-radius: 8px;
            padding: 12px 15px;
            font-size: 14px;
            font-weight: 600;
            text-align: left;
        }
        QPushButton#SidebarButton:hover {
            background-color: #1E293B;
            color: #E2E8F0;
        }
        QPushButton#SidebarButton[selected="true"] {
            background-color: #1E293B;
            color: #38BDF8;
            border: 1px solid #334155;
            border-left: 4px solid #38BDF8;
        }
        QWidget#DetailsPanel {
            background-color: #1E293B;
            border-radius: 12px;
            border: 1px solid #334155;
        }
        QLabel#DetailTitle {
            font-size: 20px;
            font-weight: 800;
            color: #F8FAFC;
        }
        QLabel#DetailDesc {
            font-size: 14px;
            color: #CBD5E1;
            line-height: 1.5;
        }
        QPushButton#LaunchButton {
            background-color: #3B82F6;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 14px;
            font-size: 15px;
            font-weight: bold;
        }
        QPushButton#LaunchButton:hover {
            background-color: #2563EB;
        }
        QPushButton#LaunchButton:disabled {
            background-color: #475569;
            color: #94A3B8;
        }
        QTextEdit#Console {
            background-color: #0B0F19;
            color: #38BDF8;
            border: 1px solid #1E293B;
            border-radius: 8px;
            padding: 15px;
            font-family: Consolas, "Courier New", monospace;
            font-size: 12px;
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
