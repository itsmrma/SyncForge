import os
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QLabel, 
                             QListWidget, QPushButton, QAbstractItemView)
from PyQt6.QtCore import Qt

class FileMatcherUI(QDialog):
    def __init__(self, targets, sources, parent=None, title="File Alignment"):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.resize(950, 600)
        
        self.targets = targets
        self.sources = sources
        self.result = []
        
        self.target_map = {os.path.basename(t): t for t in targets}
        self.source_map = {os.path.basename(s): s for s in sources}
        
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)
        
        # Labels
        lbl_layout = QHBoxLayout()
        lbl_target = QLabel("TARGET Files (Base Video)")
        lbl_source = QLabel("SOURCE Files (Audio/Subs to extract)")
        lbl_layout.addWidget(lbl_target)
        lbl_layout.addWidget(lbl_source)
        layout.addLayout(lbl_layout)
        
        # Lists
        list_layout = QHBoxLayout()
        
        self.list_target = QListWidget()
        self.list_target.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.list_target.addItems([os.path.basename(t) for t in self.targets])
        
        self.list_source = QListWidget()
        self.list_source.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.list_source.addItems([os.path.basename(s) for s in self.sources])
        
        self.list_target.itemSelectionChanged.connect(self.list_source.clearSelection)
        self.list_source.itemSelectionChanged.connect(self.list_target.clearSelection)
        
        list_layout.addWidget(self.list_target)
        
        # Buttons
        btn_layout = QVBoxLayout()
        btn_up = QPushButton("▲")
        btn_up.clicked.connect(self.move_up)
        btn_down = QPushButton("▼")
        btn_down.clicked.connect(self.move_down)
        btn_del = QPushButton("✕")
        btn_del.setObjectName("DeleteButton")
        btn_del.clicked.connect(self.remove_item)
        
        btn_layout.addStretch()
        btn_layout.addWidget(btn_up)
        btn_layout.addWidget(btn_down)
        btn_layout.addWidget(btn_del)
        btn_layout.addStretch()
        
        list_layout.addLayout(btn_layout)
        list_layout.addWidget(self.list_source)
        
        layout.addLayout(list_layout)
        
        # Confirm Button
        btn_confirm = QPushButton("CONFIRM PAIRING")
        btn_confirm.setObjectName("ConfirmButton")
        btn_confirm.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_confirm.clicked.connect(self.confirm)
        layout.addWidget(btn_confirm)
        
        self.apply_styles()

    def apply_styles(self):
        style = """
        QDialog {
            background-color: #0F172A;
        }
        QLabel {
            color: #F8FAFC;
            font-weight: 800;
            font-size: 14px;
        }
        QListWidget {
            background-color: #1E293B;
            color: #E2E8F0;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 10px;
            font-size: 13px;
            outline: 0;
        }
        QListWidget::item {
            padding: 5px;
            border-radius: 4px;
        }
        QListWidget::item:selected {
            background-color: #3B82F6;
            color: white;
        }
        QPushButton {
            background-color: #1E293B;
            color: #E2E8F0;
            border: 1px solid #334155;
            border-radius: 6px;
            padding: 8px;
            font-weight: bold;
        }
        QPushButton:hover {
            background-color: #334155;
            border: 1px solid #475569;
        }
        QPushButton#DeleteButton {
            color: #EF4444;
        }
        QPushButton#DeleteButton:hover {
            background-color: #7F1D1D;
            color: white;
            border: 1px solid #EF4444;
        }
        QPushButton#ConfirmButton {
            background-color: #3B82F6;
            color: white;
            border: none;
            padding: 12px;
            font-size: 14px;
            margin-top: 10px;
            border-radius: 8px;
        }
        QPushButton#ConfirmButton:hover {
            background-color: #2563EB;
        }
        """
        self.setStyleSheet(style)

    def get_selected_list(self):
        if self.list_target.selectedItems():
            return self.list_target
        elif self.list_source.selectedItems():
            return self.list_source
        return None

    def move_up(self):
        lbox = self.get_selected_list()
        if not lbox: return
        row = lbox.currentRow()
        if row > 0:
            item = lbox.takeItem(row)
            lbox.insertItem(row - 1, item)
            lbox.setCurrentRow(row - 1)

    def move_down(self):
        lbox = self.get_selected_list()
        if not lbox: return
        row = lbox.currentRow()
        if row < lbox.count() - 1:
            item = lbox.takeItem(row)
            lbox.insertItem(row + 1, item)
            lbox.setCurrentRow(row + 1)

    def remove_item(self):
        lbox = self.get_selected_list()
        if not lbox: return
        row = lbox.currentRow()
        lbox.takeItem(row)

    def confirm(self):
        final_targets = []
        final_sources = []
        
        for i in range(self.list_target.count()):
            name = self.list_target.item(i).text()
            if name in self.target_map:
                final_targets.append(self.target_map[name])
                
        for i in range(self.list_source.count()):
            name = self.list_source.item(i).text()
            if name in self.source_map:
                final_sources.append(self.source_map[name])
        
        limit = min(len(final_targets), len(final_sources))
        self.result = list(zip(final_targets[:limit], final_sources[:limit]))
        self.accept()

def match_files_ui(target_list, source_list):
    if not target_list or not source_list:
        print("Empty file lists.")
        return []
        
    from PyQt6.QtWidgets import QApplication
    import sys
    
    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv)
        
    dialog = FileMatcherUI(target_list, source_list)
    dialog.exec()
    return dialog.result
