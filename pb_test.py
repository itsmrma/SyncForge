import sys
from PyQt6.QtWidgets import QApplication, QProgressBar, QWidget, QVBoxLayout
app = QApplication(sys.argv)
w = QWidget()
l = QVBoxLayout(w)
pb = QProgressBar()
pb.setRange(0,0)
pb.setFixedHeight(12)
pb.setStyleSheet("""
QProgressBar {
    background-color: #36343B;
    border-radius: 6px;
}
QProgressBar::chunk {
    background-color: #D0BCFF;
    border-radius: 6px;
}
""")
l.addWidget(pb)
w.show()
sys.exit(app.exec())
