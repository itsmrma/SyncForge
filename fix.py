import re

filepath = r'C:\Users\mbena\itsmrma\README.md'
with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

stack_str = '**Stack:** `Python` \u00B7 `PyQt6` \u00B7 `SciPy` \u00B7 `FFmpeg` \u00B7 `MKVToolNix` \u00B7 `uv`\n'
text = re.sub(r'\*\*Stack:\*\* .*?\n', stack_str, text)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)
