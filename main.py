import os
import eel
import ui.backend

def main():
    
    # Path to web folder
    web_dir = os.path.join(os.path.dirname(__file__), 'web', 'dist')
    if not os.path.exists(web_dir):
        # Fallback to dev mode
        web_dir = os.path.join(os.path.dirname(__file__), 'web')
        
    eel.init(web_dir)
    try:
        eel.start('index.html', size=(1000, 750), port=0)
    except Exception as e:
        print(f"Error starting Eel: {e}")

if __name__ == "__main__":
    main()
