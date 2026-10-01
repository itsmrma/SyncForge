"""Validate the frozen ffsubsync dispatcher without opening a GUI window."""
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    executable = str(Path(sys.argv[1]).resolve())
    with tempfile.TemporaryDirectory(prefix='syncforge-bundle-') as folder:
        source = Path(folder) / 'source.srt'
        output = Path(folder) / 'aligned.srt'
        source.write_text('1\n00:00:00,100 --> 00:00:01,200\nBundle smoke test\n', encoding='utf-8')
        subprocess.run([executable, '--ffsubsync', str(source), '-i', str(source), '-o', str(output)],
                       check=True, capture_output=True, timeout=60)
        assert 'Bundle smoke test' in output.read_text(encoding='utf-8')
    print('Bundled subtitle synchronizer passed')


if __name__ == '__main__':
    main()
