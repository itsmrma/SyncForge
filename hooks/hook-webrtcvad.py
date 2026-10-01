from PyInstaller.utils.hooks import copy_metadata

# ffsubsync installs webrtcvad-wheels, which provides the webrtcvad module.
datas = copy_metadata('webrtcvad-wheels')
