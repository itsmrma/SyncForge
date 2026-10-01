import sys
import os

def main():
    from core.processes import hide_child_consoles
    hide_child_consoles()
    import webview
    import ui.backend
    if sys.platform == 'darwin':
        # Finder does not inherit the shell's Homebrew paths.
        os.environ['PATH'] = os.pathsep.join(['/opt/homebrew/bin', '/usr/local/bin', os.environ.get('PATH', '')])
    
    # Path to web folder
    if hasattr(sys, '_MEIPASS'):
        base_dir = sys._MEIPASS
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
    web_dir = os.path.join(base_dir, 'web', 'dist')
    if not os.path.exists(os.path.join(web_dir, 'index.html')):
        raise RuntimeError('Frontend build missing. Run npm ci and npm run build in the web directory.')
        
    index_path = os.path.join(web_dir, 'index.html')
    
    api = ui.backend.Api()
    window = webview.create_window('SyncForge', url=index_path, js_api=api, width=1000, height=750, text_select=True)
    ui.backend.setup_shim(window, api)
    
    webview.start(debug=False, gui='qt' if sys.platform == 'linux' else None)

if __name__ == "__main__":
    from multiprocessing import freeze_support
    freeze_support()
    if '--ffsubsync' in sys.argv[1:2]:
        from core.processes import hide_child_consoles
        hide_child_consoles()
        sys.argv = [sys.argv[0], *sys.argv[2:]]
        if sys.stdout is None:
            sys.stdout = open(os.devnull, 'w')
        if sys.stderr is None:
            sys.stderr = open(os.devnull, 'w')
        from core.process_env import external_tool_environment
        child_env = external_tool_environment()
        os.environ.clear()
        os.environ.update(child_env)
        from ffsubsync import main as sync_subtitles
        sys.exit(sync_subtitles())
    main()
    sys.exit(0)
