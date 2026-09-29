import sys
import os
import eel
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
        
    eel.init(web_dir)
    try:
        eel.start('index.html', size=(1000, 750), port=0)
    except EnvironmentError:
        # Fallback to default system browser if Chrome/Edge are not found or broken
        eel.start('index.html', size=(1000, 750), port=0, mode='default')
    except Exception as e:
        print(f"Error starting Eel: {e}")

if __name__ == "__main__":
    main()
    sys.exit(0)
