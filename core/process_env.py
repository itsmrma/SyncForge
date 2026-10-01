import os
import sys


def external_tool_environment():
    """Keep bundled Qt libraries out of system tools' Linux library search path."""
    env = os.environ.copy()
    if getattr(sys, 'frozen', False) and sys.platform.startswith('linux'):
        original = env.get('LD_LIBRARY_PATH_ORIG')
        if original is not None:
            env['LD_LIBRARY_PATH'] = original
        else:
            env.pop('LD_LIBRARY_PATH', None)
    return env
