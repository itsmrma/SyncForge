import sys
from PyQt6.QtWidgets import QApplication, QProgressBar, QWidget, QVBoxLayout
app = QApplication(sys.argv)
w = QWidget()
w.setStyleSheet("""
    QProgressBar {
        background-color: #36343B;
        border-radius: 4px;
        border: none;
    }
    QProgressBar::chunk {
        background-color: #D0BCFF;
        border-radius: 4px;
        margin: 1px;
        width: 30px;
    }
""")
l = QVBoxLayout(w)
pb = QProgressBar()
pb.setRange(0, 0) # indeterminate
pb.setFixedSize(300, 8)
l.addWidget(pb)
w.show()
# app.exec()
