import sys
import os
import webview
import ui.backend

def main():
    
    # Path to web folder
    if hasattr(sys, '_MEIPASS'):
        base_dir = sys._MEIPASS
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
    web_dir = os.path.join(base_dir, 'web', 'dist')
    if not os.path.exists(web_dir):
        # Fallback to dev mode
        web_dir = os.path.join(base_dir, 'web')
        
    index_path = os.path.join(web_dir, 'index.html')
    
    api = ui.backend.Api()
    window = webview.create_window('SyncForge', url=index_path, js_api=api, width=1000, height=750)
    ui.backend.setup_shim(window)
    
    webview.start(debug=False)

if __name__ == "__main__":
    main()
    sys.exit(0)
