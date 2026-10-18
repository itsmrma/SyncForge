export const DEFAULT_SHORTCUTS = {
  launch_module: 'Ctrl+Enter',
  repeat_last: 'Ctrl+Shift+R',
  close_dialog: 'Esc',
  open_settings: 'Ctrl+,',
  toggle_terminal: 'Ctrl+L',
  module_1: 'Ctrl+1',
  module_2: 'Ctrl+2',
  module_3: 'Ctrl+3',
  module_4: 'Ctrl+4',
  module_5: 'Ctrl+5',
  module_6: 'Ctrl+6',
};

export const SHORTCUT_GROUPS = [
  {
    category: 'Execution & Task Control',
    color: '#34D399',
    items: [
      { id: 'launch_module', label: 'Launch Active Module' },
      { id: 'repeat_last', label: 'Repeat Last Run' },
      { id: 'close_dialog', label: 'Close Active Dialog / Cancel Prompt' },
    ],
  },
  {
    category: 'Workspace & Diagnostics',
    color: '#38BDF8',
    items: [
      { id: 'open_settings', label: 'Open / Close Settings' },
      { id: 'toggle_terminal', label: 'Toggle Developer Terminal' },
    ],
  },
  {
    category: 'Quick Module Switching',
    color: '#818CF8',
    items: [
      { id: 'module_1', label: 'Remove & Filter Tracks' },
      { id: 'module_2', label: 'Set Default & Forced Flags' },
      { id: 'module_3', label: 'Sync Subtitle Files to Audio' },
      { id: 'module_4', label: 'Extract & Sync Subs from MKV' },
      { id: 'module_5', label: 'Waveform Audio Sync & Merge' },
      { id: 'module_6', label: 'Direct Track Merge (No Sync)' },
    ],
  },
];

export const ALL_SHORTCUT_ITEMS = SHORTCUT_GROUPS.flatMap((g) => g.items);

export function loadInitialShortcuts() {
  try {
    const raw = localStorage.getItem('syncforge_shortcuts');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_SHORTCUTS, ...parsed };
      }
    }
  } catch {
    // ignore storage errors
  }
  return { ...DEFAULT_SHORTCUTS };
}

export function formatEventToShortcut(e) {
  if (!e || !e.key) return null;
  const rawKey = e.key;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(rawKey)) {
    return null;
  }

  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  let keyLabel = rawKey;
  if (rawKey === 'Escape' || rawKey === 'Esc') {
    keyLabel = 'Esc';
  } else if (rawKey === ' ') {
    keyLabel = 'Space';
  } else if (rawKey === 'ArrowUp') {
    keyLabel = 'Up';
  } else if (rawKey === 'ArrowDown') {
    keyLabel = 'Down';
  } else if (rawKey === 'ArrowLeft') {
    keyLabel = 'Left';
  } else if (rawKey === 'ArrowRight') {
    keyLabel = 'Right';
  } else if (rawKey.length === 1) {
    keyLabel = rawKey.toUpperCase();
  }

  parts.push(keyLabel);
  return parts.join('+');
}

export function matchesShortcut(e, comboStr) {
  if (!comboStr) return false;
  const pressed = formatEventToShortcut(e);
  if (!pressed) return false;
  return pressed.toLowerCase() === comboStr.toLowerCase();
}

export function splitShortcutKeys(comboStr) {
  if (!comboStr) return [];
  return comboStr.split('+').filter(Boolean);
}

export function formatCompactShortcut(comboStr) {
  if (!comboStr) return '';
  return comboStr
    .replace(/^Ctrl\+/i, '^')
    .replace(/Shift\+/i, '⇧')
    .replace(/Alt\+/i, '⌥');
}
