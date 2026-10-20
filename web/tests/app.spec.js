import { test, expect } from '@playwright/test';
import { formatCompactShortcut, formatShortcutDisplay, splitShortcutKeys } from '../src/shortcuts.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.frontend_api));
});

async function append(page, text) {
  await page.evaluate(text => window.frontend_api.append_terminal(text), text);
  await expect(page.getByRole('log')).toContainText(text.trim().split('\n').at(-1));
}

for (const [title, id, targetLabel, sourceLabel, sourceType] of [
  ['Remove & Filter Tracks', 'stream_manager', 'Video File or Folder'],
  ['Set Default & Forced Flags', 'set_default', 'Video File or Folder'],
  ['Sync Subtitle Files to Audio', 'sync_subs', 'Video File or Folder', 'Subtitle File or Folder', 'subtitles'],
  ['Extract & Sync Subs from MKV', 'sync_subs_mkv', 'Target Video File or Folder', 'Source Video File or Folder', 'video'],
  ['Waveform Audio Sync & Merge', 'injection', 'Target File or Folder (High Quality)', 'Source File or Folder (Audio/Subs)', 'video'],
  ['Direct Track Merge (No Sync)', 'custom_merge', 'File or Folder A (Base Video)', 'File or Folder B (Additional Audio/Subs)', 'video'],
  ['Self-Sync Audio & Subtitles', 'internal_sync', 'Video File or Folder'],
]) {
  test(`${title} accepts individual files through native pickers`, async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 750 });
    await page.evaluate(() => {
      window.pickTypes = [];
      window.pywebview = { api: {
        pick_file: async type => {
          window.pickTypes.push(type);
          return type === 'subtitles' ? '/media/subtitle.srt' : `/media/video-${window.pickTypes.length}.mkv`;
        },
        pick_folder: async () => '/media/output',
        run_module: async (...args) => {
          window.lastRun = args;
          return { status: 'ok', message: 'Task completed.' };
        },
      } };
    });
    await page.getByRole('button', { name: title, exact: true }).click();
    const targetPicker = page.getByRole('button', { name: `Select file for ${targetLabel}`, exact: true });
    await expect(targetPicker).toBeInViewport();
    await targetPicker.click();
    await expect(page.getByRole('textbox', { name: targetLabel, exact: true })).toHaveValue('/media/video-1.mkv');
    if (sourceLabel) {
      await page.getByRole('button', { name: `Select file for ${sourceLabel}`, exact: true }).click();
      await expect(page.getByRole('textbox', { name: sourceLabel, exact: true })).toHaveValue(
        sourceType === 'subtitles' ? '/media/subtitle.srt' : '/media/video-2.mkv');
    }
    expect(await page.evaluate(() => window.pickTypes)).toEqual(sourceLabel ? ['video', sourceType] : ['video']);
    await expect(page.getByRole('button', { name: 'Select file for Output Folder', exact: true })).toHaveCount(0);
    if (id !== 'set_default') {
      await page.getByRole('button', { name: 'Select folder for Output Folder', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Output Folder', exact: true })).toHaveValue('/media/output');
    }
    await page.getByRole('button', { name: 'Launch Module' }).click();
    const run = await page.evaluate(() => window.lastRun);
    expect(run[0]).toBe(id);
    expect(run[2].video).toBe('/media/video-1.mkv');
    if (sourceLabel) expect(run[2].sub).toBe(sourceType === 'subtitles' ? '/media/subtitle.srt' : '/media/video-2.mkv');
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await page.getByRole('button', { name: 'Repeat Last' }).click();
    expect((await page.evaluate(() => window.lastRun))[3]).toBe(true);
  });
}

for (const outcome of ['saved', 'cancelled', 'failed']) {
  test(`log save dialog handles ${outcome} exports`, async ({ page }) => {
    await page.evaluate(outcome => {
      window.__TAURI_INTERNALS__ = { invoke: async (command, args) => {
        if (command !== 'save_logs') return null;
        window.savedLogs = args;
        if (outcome === 'failed') throw new Error('Could not save logs: access denied');
        return outcome === 'saved';
      } };
    }, outcome);
    await page.getByRole('button', { name: 'Show Terminal' }).click();
    await append(page, 'Normal output\n[ERROR] Mux failed\n');
    await page.getByRole('button', { name: 'Errors', exact: true }).click();
    await page.getByRole('button', { name: 'Download Logs' }).click();
    await expect.poll(() => page.evaluate(() => window.savedLogs)).toBeTruthy();
    const saved = await page.evaluate(() => window.savedLogs);
    expect(saved.content).toContain('Normal output\n[ERROR] Mux failed\n');
    expect(saved.defaultName).toMatch(/^syncforge_logs_.*\.txt$/);
    if (outcome === 'failed') {
      await expect(page.getByRole('alert')).toContainText('Could not save logs: access denied');
      await page.getByRole('button', { name: 'OK', exact: true }).click();
    } else {
      await expect(page.getByRole('alert')).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.getByRole('log')).toContainText('Normal output');
  });
}

test('folder selection and cancelled file selection preserve the chosen path', async ({ page }) => {
  await page.evaluate(() => {
    window.pywebview = { api: { pick_folder: async () => '/media/batch', pick_file: async () => '' } };
  });
  await page.getByRole('button', { name: 'Select folder for Video File or Folder', exact: true }).click();
  await page.getByRole('button', { name: 'Select file for Video File or Folder', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Video File or Folder', exact: true })).toHaveValue('/media/batch');
});

test('file picker failures are displayed without clearing the input', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Video File or Folder', exact: true }).fill('/media/selected.mkv');
  await page.evaluate(() => {
    window.pywebview = { api: { pick_file: async () => { throw new Error('Picker unavailable'); } } };
  });
  await page.getByRole('button', { name: 'Select file for Video File or Folder', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Picker unavailable');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Video File or Folder', exact: true })).toHaveValue('/media/selected.mkv');
});

test('terminal pauses while reading and resumes at the bottom', async ({ page }) => {
  await page.getByRole('button', { name: 'Show Terminal' }).click();
  const log = page.getByRole('log');
  await append(page, Array.from({ length: 150 }, (_, i) => `Initial log ${i}\n`).join(''));
  const atBottom = () => log.evaluate(e => e.scrollHeight - e.clientHeight - e.scrollTop <= 2);
  await expect.poll(atBottom).toBe(true);

  await log.hover();
  await page.mouse.wheel(0, -600);
  await expect.poll(atBottom).toBe(false);
  const pausedPosition = await log.evaluate(e => e.scrollTop);
  await append(page, 'New output while reading\n'.repeat(20));
  await expect.poll(() => log.evaluate(e => e.scrollTop)).toBe(pausedPosition);

  // Exceed the usual log cap without removing the text the user is reading.
  await append(page, 'Long output while reading\n'.repeat(2200));
  await expect(log).toContainText('Initial log 0');
  await expect.poll(() => log.evaluate(e => e.scrollTop)).toBe(pausedPosition);
  await page.getByRole('button', { name: 'Hide Terminal' }).click();
  await page.getByRole('button', { name: 'Show Terminal' }).click();
  await expect.poll(() => log.evaluate(e => e.scrollTop)).toBe(pausedPosition);

  await log.hover();
  await page.mouse.wheel(0, 100000);
  await expect.poll(atBottom).toBe(true);
  await append(page, 'Follow resumed\n'.repeat(20));
  await expect.poll(atBottom).toBe(true);

  await log.hover();
  await page.mouse.wheel(0, -600);
  await expect.poll(atBottom).toBe(false);
  await page.getByRole('button', { name: 'Go to end of terminal' }).click();
  await expect.poll(atBottom).toBe(true);
  await expect(page.getByRole('button', { name: 'Go to end of terminal' })).not.toBeVisible();
  await append(page, 'Button resumed following\n'.repeat(20));
  await expect.poll(atBottom).toBe(true);
});

test('backend rejection restores launch button and displays error', async ({ page }) => {
  await page.evaluate(() => {
    window.pywebview = { api: { run_module: async () => { throw new Error('Backend disconnected'); } } };
  });
  await page.getByRole('button', { name: 'Launch Module' }).click();
  await expect(page.getByRole('alert')).toContainText('Backend disconnected');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Launch Module' })).toBeEnabled();
});

test('task outcome is shown and notification preference reaches backend', async ({ page }) => {
  await page.evaluate(() => {
    window.pywebview = { api: { run_module: async (...args) => {
      window.lastRun = args;
      return { status: 'ok', message: 'Task completed. 1 file(s) processed.' };
    } } };
  });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('checkbox', { name: 'Notify when task finishes' }).uncheck();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Launch Module' }).click();
  await expect(page.getByRole('alert')).toContainText('Task completed.');
  expect(await page.evaluate(() => window.lastRun[1].notify_on_finish)).toBe(false);
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Repeat Last' })).toBeEnabled();
});

test('escape cancels the pairing dialog and releases backend', async ({ page }) => {
  await page.evaluate(() => {
    window.pywebview = { api: { resolve_matcher: async (...args) => { window.matchResponse = args; } } };
    window.frontend_api.ask_matcher(['target.mkv'], ['source.mkv'], 'pair-1');
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(() => window.matchResponse)).toEqual(['pair-1', []]);
});

test('pairing confirmation sends the displayed source order including unused sources', async ({ page }) => {
  await page.evaluate(() => {
    window.pywebview = { api: { resolve_matcher: async (...args) => { window.matchResponse = args; } } };
    window.frontend_api.ask_matcher(['target.mkv'], ['b.mkv', 'c.mkv', 'a.mkv'], 'ordered');
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm Pairing' }).click();
  expect(await page.evaluate(() => window.matchResponse)).toEqual([
    'ordered', [['target.mkv', 'b.mkv']], ['b.mkv', 'c.mkv', 'a.mkv'],
  ]);
});

test('sidebar collapses, switches modules, and opens settings without losing preferences', async ({ page }) => {
  const sidebar = page.getByRole('complementary', { name: 'Modules and settings' });
  const originalWidth = await sidebar.evaluate(element => element.clientWidth);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Notify when task finishes' }).uncheck();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect.poll(() => sidebar.evaluate(element => element.clientWidth)).toBe(72);
  await expect(page.getByRole('separator', { name: 'Resize sidebar' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Direct Track Merge (No Sync)', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Notify when task finishes' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(() => sidebar.evaluate(element => element.clientWidth)).toBe(72);
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  await expect.poll(() => sidebar.evaluate(element => element.clientWidth)).toBe(originalWidth);
});

test('resized sidebar restores its width after collapse', async ({ page }) => {
  const sidebar = page.getByRole('complementary', { name: 'Modules and settings' });
  await page.getByRole('separator', { name: 'Resize sidebar' }).hover();
  await page.mouse.down();
  await page.mouse.move(370, 100);
  await page.mouse.up();
  await expect.poll(() => sidebar.evaluate(element => element.clientWidth)).toBe(370);
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  await expect.poll(() => sidebar.evaluate(element => element.clientWidth)).toBe(370);
});

test('sidebar module titles wrap text and resizing does not select window text', async ({ page }) => {
  const button = page.getByRole('button', { name: 'Waveform Audio Sync & Merge' });
  const whiteSpace = await button.evaluate(el => window.getComputedStyle(el).whiteSpace);
  expect(whiteSpace).toBe('normal');

  const separator = page.getByRole('separator', { name: 'Resize sidebar' });
  const sepBox = await separator.boundingBox();
  expect(sepBox).not.toBeNull();

  await page.mouse.move(sepBox.x + 2, sepBox.y + 10);
  await page.mouse.down();

  const userSelectDuring = await page.evaluate(() => document.body.style.userSelect);
  expect(userSelectDuring).toBe('none');

  await page.mouse.move(250, 100);
  const selectedText = await page.evaluate(() => window.getSelection()?.toString() || '');
  expect(selectedText).toBe('');

  await page.mouse.up();
  const userSelectAfter = await page.evaluate(() => document.body.style.userSelect);
  expect(userSelectAfter).toBe('');
});

const tracks = [
  { id: 1, type: 'audio', codec: 'AAC', properties: { language: 'eng', track_name: 'English Audio' } },
  { id: 8, type: 'subtitles', codec: 'SubRip/SRT', properties: { language: 'ita', track_name: 'Italian subtitles', default_track: true } },
];

async function showInput(page, request) {
  await page.evaluate(request => {
    window.pywebview = { api: { resolve_input: async (...args) => { window.inputResponse = args; } } };
    window.frontend_api.ask_input(request, 'input-1');
  }, request);
}

test('track popup shows IDs and sends chosen tracks without browser prompts', async ({ page }) => {
  let nativeDialog = false;
  page.on('dialog', async dialog => { nativeDialog = true; await dialog.dismiss(); });
  await showInput(page, { prompt: 'Choose tracks to keep', kind: 'multiple', tracks });
  const popup = page.getByRole('dialog');
  await expect(popup).toContainText('ID 1');
  await expect(popup).toContainText('ID 8');
  await expect(popup).toContainText('Italian subtitles');
  await expect(popup).toContainText('ITA');
  await expect(popup).toContainText('Default');
  await page.getByRole('checkbox', { name: 'Select track ID 1', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Confirm selection' }).click();
  await expect(popup).not.toBeVisible();
  expect(await page.evaluate(() => window.inputResponse)).toEqual(['input-1', '8']);
  expect(nativeDialog).toBe(false);
});

test('single track popup supports leave unchanged and a real selected ID', async ({ page }) => {
  await showInput(page, { prompt: 'Default subtitle track', kind: 'single', tracks, allow_empty: true });
  await expect(page.getByRole('button', { name: 'Confirm selection' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Select track ID 8' }).check();
  await page.getByRole('button', { name: 'Confirm selection' }).click();
  expect(await page.evaluate(() => window.inputResponse)).toEqual(['input-1', '8']);
  await showInput(page, { prompt: 'Default subtitle track', kind: 'single', tracks, allow_empty: true });
  await page.getByRole('button', { name: 'Leave unchanged' }).click();
  expect(await page.evaluate(() => window.inputResponse)).toEqual(['input-1', '']);
});

test('confirmation uses Yes and No buttons', async ({ page }) => {
  await showInput(page, { prompt: 'Convert audio to Opus?', kind: 'confirm' });
  await page.getByRole('button', { name: 'No', exact: true }).click();
  expect(await page.evaluate(() => window.inputResponse)).toEqual(['input-1', 'n']);
});

test('stop works while a track popup is open and restores launch controls', async ({ page }) => {
  await page.evaluate(tracks => {
    window.pywebview = { api: {
      run_module: async () => {
        window.frontend_api.ask_input({ prompt: 'Choose tracks to keep', kind: 'multiple', tracks }, 'pending');
        return new Promise(resolve => { window.finishRun = resolve; });
      },
      stop_task: async () => {
        window.stopCalled = true;
        window.frontend_api.cancel_requests();
        window.finishRun({ status: 'cancelled', message: 'Task stopped. Completed files kept.' });
        return { status: 'stopping' };
      },
    } };
  }, tracks);
  await page.getByRole('button', { name: 'Launch Module' }).click();
  await expect(page.getByRole('dialog')).toContainText('Choose tracks to keep');
  await page.getByRole('dialog').getByRole('button', { name: 'Stop task' }).click();
  await expect(page.getByRole('dialog')).toContainText('Task stopped');
  expect(await page.evaluate(() => window.stopCalled)).toBe(true);
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Launch Module' })).toBeEnabled();
});

test('long track lists keep IDs and actions usable in a 1000 by 750 window', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 750 });
  const manyTracks = Array.from({ length: 10 }, (_, id) => ({
    id, type: id < 2 ? 'audio' : 'subtitles', codec: id < 2 ? 'AAC' : 'SubRip/SRT',
    properties: { language: id === 8 ? 'ita' : 'eng', track_name: `Track ${id} — ${id === 8 ? 'Italian subtitles' : 'Original source'}`, default_track: id === 8 },
  }));
  await showInput(page, { prompt: 'Choose the audio and subtitle tracks to keep', kind: 'multiple',
    tracks: manyTracks, context: 'Group 1/2 / 12 files' });
  await page.getByRole('button', { name: 'Select none' }).click();
  await page.getByRole('checkbox', { name: 'Select track ID 8', exact: true }).check();
  await expect(page.getByRole('button', { name: 'Confirm selection' })).toBeInViewport();
  await expect(page.getByRole('dialog')).toContainText('ID 8');
  await page.screenshot({ path: 'test-results/track-popup.png' });
  await page.getByRole('button', { name: 'Confirm selection' }).click();
  expect(await page.evaluate(() => window.inputResponse)).toEqual(['input-1', '8']);
});

test('global settings remain enabled and configurable across all modules, and Active Profile Configure opens General tab', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const autoAudio = page.getByRole('checkbox', { name: /Auto-sync Audio/ });
  const autoSubs = page.getByRole('checkbox', { name: /Auto-sync Subs/ });
  const maxOffset = page.getByRole('checkbox', { name: /Enable Max Offset limit/ });
  const notify = page.getByRole('checkbox', { name: 'Notify when task finishes' });
  const opusSelect = page.getByRole('combobox', { name: /Opus Audio Encoding/i });

  // In Remove & Filter Tracks: all global settings are enabled
  await expect(autoAudio).toBeEnabled();
  await expect(autoSubs).toBeEnabled();
  await expect(maxOffset).toBeEnabled();
  await expect(notify).toBeEnabled();
  await expect(opusSelect).toBeEnabled();

  // Switch to Keyboard Shortcuts tab in Settings, then close
  const settingsModal = page.getByRole('dialog', { name: 'Settings' });
  await settingsModal.getByRole('tab', { name: /Keyboard Shortcuts/i }).click();
  await expect(settingsModal.getByTestId('shortcuts-page')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(settingsModal).not.toBeVisible();

  // Click Configure on Active Profile -> MUST open on General tab (not shortcuts tab)
  await page.setViewportSize({ width: 1400, height: 850 });
  await page.getByRole('button', { name: 'Configure active profile' }).click();
  await expect(settingsModal).toBeVisible();
  await expect(settingsModal.getByRole('combobox', { name: /Opus Audio Encoding/i })).toBeVisible();

  // In Direct Track Merge (No Sync): all global settings are still enabled
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Direct Track Merge (No Sync)', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(autoAudio).toBeEnabled();
  await expect(autoSubs).toBeEnabled();
  await expect(maxOffset).toBeEnabled();
  await expect(notify).toBeEnabled();
  await expect(opusSelect).toBeEnabled();
  await page.getByRole('button', { name: 'Done' }).click();
});

test('tauri v2 invoke bridge dispatches module execution and file pickers natively', async ({ page }) => {
  await page.evaluate(() => {
    delete window.pywebview;
    window.tauriInvocations = [];
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        window.tauriInvocations.push([cmd, args]);
        if (cmd === 'pick_file') return '/media/tauri-video.mkv';
        if (cmd === 'pick_folder') return '/media/tauri-out';
        if (cmd === 'run_module') return { status: 'ok', message: 'Task completed via Tauri.' };
        return null;
      },
    };
  });
  await page.getByRole('button', { name: 'Select file for Video File or Folder', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Video File or Folder', exact: true })).toHaveValue('/media/tauri-video.mkv');
  await page.getByRole('button', { name: 'Launch Module' }).click();
  await expect(page.getByRole('alert')).toContainText('Task completed via Tauri.');
  const calls = await page.evaluate(() => window.tauriInvocations);
  expect(calls[0][0]).toBe('pick_file');
  expect(calls[1][0]).toBe('run_module');
  expect(calls[1][1].moduleName).toBe('stream_manager');
});

test('sidebar does not display the rust badge', async ({ page }) => {
  await expect(page.getByText('RUST', { exact: true })).toHaveCount(0);
  await expect(page.getByText('SyncForge', { exact: true })).toBeVisible();
});

test('stream manager shows muxing status for native mkvmerge output', async ({ page }) => {
  await page.evaluate(() => {
    window.pywebview = { api: {
      run_module: () => new Promise(resolve => { window._resolveTask = resolve; }),
    } };
  });
  await page.getByRole('button', { name: 'Launch Module' }).click();
  const subtask = page.getByTestId('subtask-label');
  await expect(subtask).toContainText('Initializing media pipeline...');

  for (const line of [
    "mkvmerge v102.0 ('Little Houses') 64-bit\n",
    "The file 'V:\\output\\.syncforge-part-test.mkv' has been opened for writing.\n",
    'Progress: 77%\n',
  ]) {
    await page.evaluate(text => window.frontend_api.append_terminal(text), line);
    await expect(subtask).toContainText('Muxing streams into Matroska container (mkvmerge)...');
  }
  await expect(page.getByTestId('file-progress-label')).toContainText('77%');
  await page.evaluate(() => window._resolveTask({ status: 'ok', message: 'Done' }));
});

test('dual progress bars display overall progress and current file progress while running', async ({ page }) => {
  await page.evaluate(() => {
    window.pywebview = {
      api: {
        run_module: () => new Promise((resolve) => {
          window._resolveTask = resolve;
        }),
        pick_file: async () => '/media/test.mkv',
        pick_folder: async () => '/media/out',
      },
    };
  });

  await page.getByRole('button', { name: 'Launch Module' }).click();
  await expect(page.getByTestId('progress-container')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Overall Progress' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Current File Progress' })).toBeVisible();

  // Test updating progress from backend
  await page.evaluate(() => {
    window.frontend_api.update_progress({
      currentFile: 'episode_05.mkv',
      fileIndex: 5,
      totalFiles: 10,
      filePercent: 60,
    });
  });

  await expect(page.getByTestId('overall-progress-label')).toContainText('File 5 of 10');
  await expect(page.getByTestId('current-file-label')).toContainText('episode_05.mkv');
  await expect(page.getByTestId('file-progress-label')).toContainText('60%');

  // Complete task and verify progress bars hide cleanly
  await page.evaluate(() => {
    if (window._resolveTask) {
      window._resolveTask({ status: 'ok', message: 'All done.' });
    }
  });
  await expect(page.getByRole('alert')).toContainText('All done.');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByTestId('progress-container')).toHaveCount(0);
});

test('QoL: output folder placeholder, clear button, show in folder, and localStorage persistence', async ({ page }) => {
  const outInput = page.getByRole('textbox', { name: 'Output Folder', exact: true });
  await expect(outInput).toHaveAttribute(
    'placeholder',
    'If not selected, output folder remains the source folder'
  );

  await page.evaluate(() => {
    window.shownPaths = [];
    window.pywebview = {
      api: {
        show_in_folder: async (p) => {
          window.shownPaths.push(p);
        },
      },
    };
  });

  const videoInput = page.getByRole('textbox', { name: 'Video File or Folder', exact: true });
  await videoInput.fill('/media/season1/ep01.mkv');
  await page.getByRole('button', { name: 'Open folder for Video File or Folder' }).click();
  expect(await page.evaluate(() => window.shownPaths)).toEqual(['/media/season1/ep01.mkv']);

  await page.getByRole('button', { name: 'Clear Video File or Folder' }).click();
  await expect(videoInput).toHaveValue('');

  // Persistence of selected module and settings across reload
  await page.getByRole('button', { name: 'Waveform Audio Sync & Merge', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Play sound on completion' }).uncheck();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.frontend_api));
  await expect(page.getByRole('heading', { name: 'Waveform Audio Sync & Merge', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Play sound on completion' })).not.toBeChecked();
});

test('QoL: matcher auto-matches episodes, reverses/resets order, and skips unchecked episodes', async ({ page }) => {
  await page.evaluate(() => {
    window.pywebview = {
      api: {
        resolve_matcher: async (...args) => {
          window.matchResponse = args;
        },
      },
    };
    window.frontend_api.ask_matcher(
      ['Show.S01E01.1080p.mkv', 'Show.S01E02.1080p.mkv', 'Show.S01E03.1080p.mkv'],
      ['Subs_Ep03.srt', 'Subs_Ep01.srt', 'Subs_Ep02.srt'],
      'qol-match'
    );
  });

  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Auto-Match Episodes' }).click();
  // Uncheck episode 2 to skip it
  await page.getByRole('checkbox', { name: 'Include target Show.S01E02.1080p.mkv' }).uncheck();
  await page.getByRole('button', { name: 'Confirm Pairing' }).click();

  expect(await page.evaluate(() => window.matchResponse)).toEqual([
    'qol-match',
    [
      ['Show.S01E01.1080p.mkv', 'Subs_Ep01.srt'],
      ['Show.S01E03.1080p.mkv', 'Subs_Ep03.srt'],
    ],
    ['Subs_Ep01.srt', 'Subs_Ep02.srt', 'Subs_Ep03.srt'],
  ]);
});

test('QoL: track search filter, language presets, and terminal log filters', async ({ page }) => {
  const sampleTracks = [
    { id: 1, type: 'audio', codec: 'AAC', properties: { language: 'jpn', track_name: 'Japanese Original' } },
    { id: 2, type: 'audio', codec: 'AC3', properties: { language: 'ita', track_name: 'Italiano' } },
    { id: 3, type: 'subtitles', codec: 'SRT', properties: { language: 'eng', track_name: 'Director Commentary SDH' } },
  ];
  await showInput(page, { prompt: 'Choose tracks to keep', kind: 'multiple', tracks: sampleTracks });

  const filterInput = page.getByPlaceholder('Filter tracks by language, name, codec, or ID...');
  await filterInput.fill('jpn');
  await expect(page.getByRole('dialog')).toContainText('ID 1');
  await expect(page.getByRole('dialog')).not.toContainText('ID 2');
  await page.getByRole('button', { name: 'Clear track filter' }).click();
  await expect(page.getByRole('dialog')).toContainText('ID 2');

  await page.getByRole('button', { name: 'No Commentary/SDH' }).click();
  await page.getByRole('button', { name: 'Confirm selection' }).click();
  expect(await page.evaluate(() => window.inputResponse)).toEqual(['input-1', '1,2']);

  // Terminal filters
  await page.getByRole('button', { name: 'Show Terminal' }).click();
  await append(page, 'Normal output line\n[WARNING] Slight drift detected\n[ERROR] Mux failed\n');
  await expect(page.getByRole('button', { name: 'Copy Logs' })).toBeVisible();
  await page.getByRole('button', { name: 'Errors', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('[ERROR] Mux failed');
  await expect(page.getByRole('log')).not.toContainText('Normal output line');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Normal output line');
});

test('QoL: drag-and-drop animation activates visual cue on textboxes and tqdm progress parsing', async ({ page }) => {
  const videoInput = page.getByRole('textbox', { name: 'Video File or Folder', exact: true });

  // Simulate window dragenter with files
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['dummy'], 'video.mkv', { type: 'video/x-matroska' }));
    const event = new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt });
    window.dispatchEvent(event);
  });

  // Verify textbox indicates drag & drop support via placeholder
  await expect(videoInput).toHaveAttribute('placeholder', 'Drop file or folder here...');

  // Simulate window dragleave
  await page.evaluate(() => {
    const event = new DragEvent('dragleave', { bubbles: true, cancelable: true });
    window.dispatchEvent(event);
  });

  await expect(videoInput).not.toHaveAttribute('placeholder', 'Drop file or folder here...');

  // Test tqdm and intermediate progress update parsing via append_terminal
  await page.evaluate(() => {
    window.pywebview = {
      api: {
        run_module: () => new Promise((resolve) => {
          window._resolveTask = resolve;
        }),
      },
    };
  });
  await page.getByRole('button', { name: 'Launch Module' }).click();
  await expect(page.getByTestId('progress-container')).toBeVisible();

  // Test tqdm regex parsing in append_terminal
  await page.evaluate(() => {
    window.frontend_api.append_terminal(' 45%|████████▍         | 450/1000 [00:04<00:05, 95.23it/s]\n');
  });
  await expect(page.getByTestId('file-progress-label')).toContainText('45%');

  await page.evaluate(() => {
    window.frontend_api.append_terminal(' 80%|████████████████  | 800/1000 [00:08<00:02, 95.23it/s]\n');
  });
  await expect(page.getByTestId('file-progress-label')).toContainText('80%');

  // Clean up
  await page.evaluate(() => {
    if (window._resolveTask) window._resolveTask({ status: 'ok', message: 'Done' });
  });
  await page.getByRole('button', { name: 'OK', exact: true }).click();
});

test('track selection keeps compact presets, group files, and language search', async ({ page }) => {
  const testTracks = [
    { id: 1, type: 'audio', codec: 'AAC', properties: { language: 'jpn', track_name: 'Japanese', default_track: true } },
    { id: 2, type: 'subtitles', codec: 'SubStationAlpha', properties: { language: 'eng', track_name: 'English' } },
    { id: 3, type: 'subtitles', codec: 'SubStationAlpha', properties: { language: 'fre', track_name: 'French' } },
    { id: 4, type: 'subtitles', codec: 'SubStationAlpha', properties: { language: 'ger', track_name: 'German' } },
    { id: 5, type: 'subtitles', codec: 'SubStationAlpha', properties: { language: 'pol', track_name: 'Polish' } },
  ];

  await showInput(page, {
    prompt: 'Choose the audio and subtitle tracks to keep',
    kind: 'multiple',
    tracks: testTracks,
    context: 'Group 1/1 • 2 files',
    files: ['/media/Show_S01E01.mkv', '/media/Show_S01E02.mkv'],
  });

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // 1. Verify audio and subtitles section headers are rendered distinctly
  await expect(dialog.getByText('Audio Tracks (1)')).toBeVisible();
  await expect(dialog.getByText('Subtitle Tracks (4)')).toBeVisible();

  // 2. Verify group files can be expanded and viewed
  await expect(dialog.getByText('Show all 2 files')).toBeVisible();
  await dialog.getByRole('button', { name: 'Show all 2 files' }).click();
  await expect(dialog).toContainText('Show_S01E01.mkv');
  await expect(dialog).toContainText('Show_S01E02.mkv');
  await dialog.getByRole('button', { name: 'Hide files in this group' }).click();

  // 3. Test "Only Default": MUST select ID 1 (default_track: true) and NOT ID 2..5
  await dialog.getByRole('button', { name: 'Only Default' }).click();
  await expect(page.getByRole('checkbox', { name: 'Select track ID 1' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Select track ID 2' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Select track ID 3' })).not.toBeChecked();

  for (const name of ['Select all', 'Select none', 'Invert selection', 'Only Default', 'System + Original', 'No Commentary/SDH']) {
    await expect(dialog.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(dialog.getByRole('button', { name: /^Only (?!Default$)/ })).toHaveCount(0);

  // Language search still allows selecting an individual English track.
  await dialog.getByRole('button', { name: 'Select none', exact: true }).click();
  await dialog.getByPlaceholder('Filter tracks by language, name, codec, or ID...').fill('English');
  await expect(page.getByRole('checkbox', { name: 'Select track ID 3' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Select track ID 2' }).check();
  await dialog.getByRole('button', { name: 'Clear track filter' }).click();
  await expect(page.getByRole('checkbox', { name: 'Select track ID 2' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Select track ID 3' })).not.toBeChecked();

  // Confirm selection
  await dialog.getByRole('button', { name: 'Confirm selection' }).click();
  expect(await page.evaluate(() => window.inputResponse)).toEqual(['input-1', '2']);
});

test('Settings window supports Opus audio encoding mode and default output directory with visible helperText', async ({ page }) => {
  // Verify default helper text on main screen when output folder is blank
  await expect(page.getByText('If not selected, output folder remains the source folder')).toBeVisible();

  // Open Settings window
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settingsModal = page.getByRole('dialog', { name: 'Settings' });
  await expect(settingsModal).toBeVisible();

  // Verify Opus audio conversion select is visible with its options
  const opusSelect = settingsModal.getByRole('combobox', { name: /Opus Audio Encoding/i });
  await expect(opusSelect).toBeVisible();
  await opusSelect.click();
  await page.getByRole('option', { name: /Always convert/i }).click();

  // Set default output folder
  const defaultOutInput = settingsModal.getByRole('textbox', { name: 'Default Output Folder' });
  await defaultOutInput.fill('/media/my_renders');

  // Close Settings dialog
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(settingsModal).not.toBeVisible();

  // Verify main screen output helperText reflects the configured default output folder
  await expect(page.getByText('Default: /media/my_renders')).toBeVisible();

  // Reopen settings and clear default output folder
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Clear default output folder' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // Verify helperText reverts back to source folder indication
  await expect(page.getByText('If not selected, output folder remains the source folder')).toBeVisible();
});

test('v3.2 QoL: Settings Keyboard Shortcuts tab and global shortcuts work', async ({ page }) => {
  // Ctrl+, opens Settings modal
  await page.keyboard.press('Control+,');
  const settingsModal = page.getByRole('dialog', { name: 'Settings' });
  await expect(settingsModal).toBeVisible();

  // Switch to Keyboard Shortcuts tab
  await settingsModal.getByRole('tab', { name: /Keyboard Shortcuts/i }).click();
  const shortcutsPage = settingsModal.getByTestId('shortcuts-page');
  await expect(shortcutsPage).toBeVisible();
  await expect(shortcutsPage).toContainText('Launch Active Module');
  await expect(shortcutsPage).toContainText('Repeat Last Run');
  await expect(shortcutsPage).toContainText('Toggle Developer Terminal');

  // Switch back to General tab and close
  await settingsModal.getByRole('tab', { name: /General/i }).click();
  await expect(settingsModal.getByRole('combobox', { name: /Opus Audio Encoding/i })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(settingsModal).not.toBeVisible();

  // Ctrl+2 switches to module 2 (Set Default & Forced Flags)
  await page.keyboard.press('Control+2');
  await expect(page.getByRole('heading', { name: 'Set Default & Forced Flags' })).toBeVisible();

  // Ctrl+L toggles Developer Console
  await page.keyboard.press('Control+l');
  await expect(page.getByRole('textbox', { name: 'Search terminal logs' })).toBeVisible();
});

test('v3.2 QoL: Non-blocking completion toast shows countdown bar and pauses when window loses focus', async ({ page }) => {
  await page.evaluate(() => {
    window.pywebview = {
      api: {
        run_module: async () => ({ status: 'ok', message: 'Batch finished!' }),
      },
    };
  });

  const targetInput = page.getByRole('textbox', { name: 'Video File or Folder', exact: true });
  await targetInput.fill('/media/show');

  // Trigger a fast module completion
  await page.getByRole('button', { name: 'Launch Module' }).click();

  const toast = page.getByTestId('completion-toast');
  await expect(toast).toBeVisible();
  await expect(toast.getByTestId('toast-countdown-bar')).toBeVisible();

  // Simulate window blur (backgrounded): timer must pause and show 'Paused'
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
  });
  await expect(toast.getByTestId('toast-timer-status')).toContainText('Paused');

  // Record current progress bar value while blurred and verify it does NOT decrease after 250ms
  const valWhileBlurred1 = await toast.getByTestId('toast-countdown-bar').getAttribute('aria-valuenow');
  await page.waitForTimeout(250);
  const valWhileBlurred2 = await toast.getByTestId('toast-countdown-bar').getAttribute('aria-valuenow');
  expect(Number(valWhileBlurred2)).toBe(Number(valWhileBlurred1));

  // Simulate window focus (foregrounded): timer resumes ticking down
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
  });
  await expect(toast.getByTestId('toast-timer-status')).not.toContainText('Paused');

  // Dismiss toast via OK
  await toast.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(toast).not.toBeVisible();
});

test('v3.2 QoL: Batch Matcher supports slot gap insertion/removal and episode diagnostics', async ({ page }) => {
  await page.evaluate(() => {
    window.pywebview = {
      api: {
        resolve_matcher: async (...args) => {
          window.matchResponse = args;
        },
      },
    };
    window.frontend_api.ask_matcher(
      ['Show_S01E01.mkv', 'Show_S01E02.mkv', 'Show_S01E03.mkv'],
      ['Source_S01E01.mkv', 'Source_S01E01_alt.mkv', 'Source_S01E03.mkv'],
      'pair-v32'
    );
  });

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Verify duplicate & missing diagnostics chips appear
  await expect(dialog.getByText('Duplicate: E01')).toBeVisible();
  await expect(dialog.getByText('Missing: E02')).toBeVisible();
  await expect(dialog.getByText('Mismatch').first()).toBeVisible();

  // Shift down at row 2 to insert an Empty Slot (Skipped)
  await dialog.getByRole('button', { name: 'Shift down from row 2' }).click();
  await expect(dialog.getByText('Empty Slot (Skipped)')).toBeVisible();

  // Remove gap at row 2
  await dialog.getByRole('button', { name: 'Remove gap at row 2' }).click();
  await expect(dialog.getByText('Empty Slot (Skipped)')).not.toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
});

test('v3.2 QoL: Track selection supports Invert selection and System + Original presets', async ({ page }) => {
  const testTracks = [
    { id: 1, type: 'audio', codec: 'AAC', properties: { language: 'jpn', track_name: 'Japanese', default_track: true, forced_track: false } },
    { id: 2, type: 'subtitles', codec: 'SubStationAlpha', properties: { language: 'eng', track_name: 'English', default_track: false, forced_track: true } },
    { id: 3, type: 'subtitles', codec: 'SubStationAlpha', properties: { language: 'spa', track_name: 'Spanish', default_track: false, forced_track: false } },
  ];

  await showInput(page, {
    prompt: 'Choose the audio and subtitle tracks to keep',
    kind: 'multiple',
    tracks: testTracks,
  });

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Default', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Forced', { exact: true })).toBeVisible();

  // Select Only Default (selects ID 1), then Invert selection (selects ID 2 and 3)
  await dialog.getByRole('button', { name: 'Only Default' }).click();
  await dialog.getByRole('button', { name: 'Invert selection' }).click();
  await expect(page.getByRole('checkbox', { name: 'Select track ID 1' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Select track ID 2' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Select track ID 3' })).toBeChecked();

  // System + Original preset
  await dialog.getByRole('button', { name: 'System + Original' }).click();
  await expect(page.getByRole('checkbox', { name: 'Select track ID 1' })).toBeChecked();

  await dialog.getByRole('button', { name: 'Confirm selection' }).click();
});

test('v3.2 QoL: Terminal search, match counter, expand toggle, Clear Logs, Recent paths, and Media Inspector', async ({ page }) => {
  await page.evaluate(() => {
    window.pywebview = {
      api: {
        run_module: async () => ({ status: 'ok', message: 'Completed!' }),
        inspect_media: async (path) => ({
          exists: true,
          is_dir: false,
          name: path.split('/').pop(),
          container: 'Matroska',
          has_attachments: true,
          tracks: [
            { id: 0, type: 'video', codec: 'HEVC', language: 'jpn', name: '', default_track: true, forced_track: false },
            { id: 1, type: 'audio', codec: 'AAC', language: 'jpn', name: 'Japanese', default_track: true, forced_track: false },
            { id: 2, type: 'audio', codec: 'AAC', language: 'eng', name: 'English', default_track: false, forced_track: false },
          ],
        }),
      },
    };
  });

  // Fill target path with an MKV file to trigger Media Inspector and save recent path on run
  const targetInput = page.getByRole('textbox', { name: 'Video File or Folder', exact: true });
  await targetInput.fill('/media/Episode_01.mkv');

  const inspector = page.getByTestId('media-inspector');
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText('Video: HEVC');
  await expect(inspector).toContainText('Audio (2): JPN, ENG');

  // Run module so '/media/Episode_01.mkv' is recorded in recent paths
  await page.getByRole('button', { name: 'Launch Module' }).click();
  await page.getByTestId('completion-toast').getByRole('button', { name: 'OK', exact: true }).click();

  // Open Recent paths dropdown
  const recentBtn = page.getByRole('button', { name: 'Recent paths for Video File or Folder' });
  await expect(recentBtn).toBeVisible();
  await recentBtn.click();
  await expect(page.getByRole('menuitem', { name: '/media/Episode_01.mkv' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Clear recent paths' }).click();

  // Open terminal and test search + expand + clear logs
  await append(page, '[INFO] Syncing Episode_01.mkv\n[WARN] Slight drift detected\n');
  await page.getByRole('button', { name: 'Show Terminal' }).click();

  const searchInput = page.getByRole('textbox', { name: 'Search terminal logs' });
  await searchInput.fill('drift');
  await expect(page.getByText('1 match')).toBeVisible();

  await page.getByRole('button', { name: 'Clear log search' }).click();
  await page.getByRole('button', { name: 'Toggle expanded terminal' }).click();
  await page.getByRole('button', { name: 'Clear Logs' }).click();
  await expect(page.getByRole('log')).toHaveText('');
});

test('v3.2 QoL: Shortcut remapping, conflict resolution dialog, edited pencil indicator, single/all reset, and wide layout', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  await expect(page.getByTestId('workspace-overview-card')).toBeVisible();

  // Open Settings -> Keyboard Shortcuts
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settingsModal = page.getByRole('dialog', { name: 'Settings' });
  await settingsModal.getByRole('tab', { name: /Keyboard Shortcuts/i }).click();

  // 1. Click "Open / Close Settings" row to open Change Shortcut capture dialog
  const openSettingsRow = settingsModal.getByTestId('shortcut-row-open_settings');
  await openSettingsRow.click();
  const captureDialog = page.getByTestId('shortcut-capture-dialog');
  await expect(captureDialog).toBeVisible();

  // Press an unused shortcut (Ctrl+K)
  await page.keyboard.press('Control+k');
  await expect(captureDialog).not.toBeVisible();

  // Verify edited indicator (pencil badge) and per-row reset button appear
  await expect(settingsModal.getByTestId('shortcut-modified-open_settings')).toBeVisible();
  await expect(settingsModal.getByTestId('reset-shortcut-open_settings')).toBeVisible();
  await expect(openSettingsRow).toContainText('K');

  // 2. Click "Toggle Developer Terminal" and press Ctrl+K (already mapped to Open / Close Settings)
  const toggleTerminalRow = settingsModal.getByTestId('shortcut-row-toggle_terminal');
  await toggleTerminalRow.click();
  await expect(captureDialog).toBeVisible();
  await page.keyboard.press('Control+k');

  // Conflict dialog must appear
  const conflictDialog = page.getByTestId('shortcut-conflict-dialog');
  await expect(conflictDialog).toBeVisible();
  await expect(conflictDialog).toContainText('Open / Close Settings');

  // Click Cancel in conflict dialog -> keeps Open / Close Settings as Ctrl+K and Toggle Developer Terminal as Ctrl+L
  await conflictDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(conflictDialog).not.toBeVisible();
  await expect(toggleTerminalRow).toContainText('L');

  // 3. Trigger conflict again and choose Reassign Shortcut
  await toggleTerminalRow.click();
  await page.keyboard.press('Control+k');
  await expect(conflictDialog).toBeVisible();
  await conflictDialog.getByRole('button', { name: 'Reassign Shortcut' }).click();
  await expect(conflictDialog).not.toBeVisible();

  // Toggle Developer Terminal now has Ctrl+K (modified), and Open / Close Settings is Unassigned (modified)
  await expect(toggleTerminalRow).toContainText('K');
  await expect(settingsModal.getByTestId('shortcut-modified-toggle_terminal')).toBeVisible();
  await expect(openSettingsRow).toContainText('Unassigned');

  // 4. Test single shortcut reset on Toggle Developer Terminal
  await settingsModal.getByTestId('reset-shortcut-toggle_terminal').click();
  await expect(settingsModal.getByTestId('shortcut-modified-toggle_terminal')).not.toBeVisible();
  await expect(toggleTerminalRow).toContainText('L');

  // 5. Test Reset All shortcuts button
  await settingsModal.getByRole('button', { name: 'Reset all shortcuts' }).click();
  await expect(settingsModal.getByTestId('shortcut-modified-open_settings')).not.toBeVisible();
  await expect(openSettingsRow).toContainText(',');

  await settingsModal.getByRole('button', { name: 'Done' }).click();
});

test('Opus bitrate, downmix settings, and Mac shortcut formatting', async ({ page }) => {
  await page.goto('/');

  // 1. Open Settings modal and verify Opus controls
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settingsModal = page.getByRole('dialog', { name: 'Settings' });
  await expect(settingsModal).toBeVisible();

  // Opus encoding dropdown
  const opusSelect = settingsModal.getByRole('combobox', { name: /Opus Audio Encoding/i });
  await expect(opusSelect).toBeVisible();
  await opusSelect.click();
  await page.getByRole('option', { name: /Always convert to Opus/i }).click();

  // Opus bitrate input
  const bitrateInput = settingsModal.getByRole('spinbutton', { name: /Opus Bitrate/i });
  await expect(bitrateInput).toBeVisible();
  await bitrateInput.fill('256');

  // Opus downmix checkbox
  const downmixCheckbox = settingsModal.getByRole('checkbox', { name: /Downmix to stereo/i });
  await expect(downmixCheckbox).toBeVisible();
  await expect(downmixCheckbox).toBeChecked();
  await downmixCheckbox.uncheck();
  await expect(downmixCheckbox).not.toBeChecked();

  // Close Settings modal
  await settingsModal.getByRole('button', { name: 'Done' }).click();
  await expect(settingsModal).not.toBeVisible();

  // 2. Verify footer chip reflects updated bitrate and downmix mode
  const footerOpusChip = page.getByText(/Opus: Always \(256k multi\)/i);
  await expect(footerOpusChip).toBeVisible();

  // 3. Test Mac shortcut formatting helper
  const isMac = process.platform === 'darwin';
  const compact = formatCompactShortcut('Ctrl+1');
  const display = formatShortcutDisplay('Ctrl+Enter');
  const split = splitShortcutKeys('Ctrl+Shift+R');

  if (isMac) {
    expect(compact).toBe('⌘1');
    expect(display).toBe('⌘+Enter');
    expect(split).toContain('⌘');
  } else {
    expect(compact).toBe('^1');
  }

  // 4. Test Sidebar responsive typography
  const sidebar = page.getByRole('complementary', { name: 'Modules and settings' });
  await expect(sidebar).toBeVisible();
  const moduleText = sidebar.getByText('Waveform Audio Sync & Merge');
  await expect(moduleText).toBeVisible();
  const fontSize = await moduleText.evaluate((el) => window.getComputedStyle(el).fontSize);
  expect(parseFloat(fontSize)).toBeGreaterThan(0);
});

test('v3.3 Workstation Layout & Clarify: Side-by-side terminal docking, Stream & Telemetry Inspector, and Sub-task CLI transparency', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  // 1. Verify Stream & Telemetry Inspector is visible in the right column
  const inspector = page.getByTestId('stream-telemetry-inspector');
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText('Stream & Telemetry Inspector');

  // 2. Dock Console to the right column on lg+ viewport
  const dockBtn = page.getByTestId('dock-terminal-toggle');
  await expect(dockBtn).toBeVisible();
  await dockBtn.click();

  const dockedContainer = page.getByTestId('docked-terminal-container');
  await expect(dockedContainer).toBeVisible();
  await expect(dockBtn).toContainText('Bottom Drawer');

  // Undock back to bottom drawer via Terminal header button
  await page.getByRole('button', { name: 'Dock terminal to bottom' }).click();
  await expect(dockedContainer).not.toBeVisible();

  // Hide terminal via Terminal header button
  await page.getByRole('button', { name: 'Hide Terminal' }).click();

  // 3. Verify Sub-task CLI transparency indicator & View live console button during running task
  await page.evaluate(() => {
    window.__runningPromise = new Promise((resolve) => {
      window.__resolveRun = resolve;
    });
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd) => {
        if (cmd === 'run_module') {
          window.frontend_api.append_terminal('[ffmpeg] Extracting audio waveform segment...\n');
          return window.__runningPromise;
        }
        return null;
      },
    };
  });

  await page.getByRole('textbox', { name: 'Video File or Folder' }).fill('/tmp/episode01.mkv');
  await page.getByRole('button', { name: 'Launch Module' }).click();

  const subtaskIndicator = page.getByTestId('subtask-indicator');
  await expect(subtaskIndicator).toBeVisible();
  await expect(page.getByTestId('subtask-label')).toContainText('Extracting audio waveform (FFmpeg)...');

  // Update log with RustFFT phase and verify sub-task label updates
  await page.evaluate(() => {
    window.frontend_api.append_terminal('[rustfft] Calculating waveform delay...\n');
  });
  await expect(page.getByTestId('subtask-label')).toContainText('Calculating FFT cross-correlation delay (RustFFT)...');

  // Click "View live console" quick action
  await page.getByTestId('view-live-console-btn').click();
  await expect(page.getByRole('button', { name: 'Hide Terminal' })).toBeVisible();

  // Finish task
  await page.evaluate(() => {
    window.__resolveRun({ status: 'ok', message: 'Done' });
  });
});

test('v3.3 Polish & Dual-Theme: Inline pre-flight validation and Dark/Light/System theme selector', async ({ page }) => {
  await page.goto('/');

  // 1. Switch to Waveform Audio Sync & Merge (requires video and sub/source)
  await page.getByRole('button', { name: /Waveform Audio Sync & Merge/i }).click();

  // Click Launch Module with empty inputs -> should show inline validation instead of modal error dialog
  await page.getByRole('button', { name: 'Launch Module' }).click();
  await expect(page.getByRole('dialog', { name: 'Task failed' })).not.toBeVisible();
  await expect(page.getByText(/Target File or Folder \(High Quality\) is required before launching/i)).toBeVisible();
  await expect(page.getByText(/Source File or Folder \(Audio\/Subs\) is required before launching/i)).toBeVisible();

  // Typing into Target File or Folder immediately clears its inline validation error
  const targetInput = page.getByRole('textbox', { name: /Target File or Folder/i });
  await targetInput.fill('/tmp/target.mkv');
  await expect(page.getByText(/Target File or Folder \(High Quality\) is required before launching/i)).not.toBeVisible();

  // 2. Test Dual-Theme switching (Dark / Light / System) in Settings
  const appRoot = page.getByTestId('app-root');
  await expect(appRoot).toHaveAttribute('data-theme-mode', 'dark');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settingsModal = page.getByRole('dialog', { name: 'Settings' });
  await expect(settingsModal).toBeVisible();

  await settingsModal.getByTestId('theme-mode-light').click();
  await expect(appRoot).toHaveAttribute('data-theme-mode', 'light');

  // Verify Anodized Slate Light background color (#F1F3F7 -> rgb(241, 243, 247))
  const rootBg = await appRoot.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(rootBg).toBe('rgb(241, 243, 247)');

  // Switch back to Dark mode
  await settingsModal.getByTestId('theme-mode-dark').click();
  await expect(appRoot).toHaveAttribute('data-theme-mode', 'dark');
  await settingsModal.getByRole('button', { name: 'Done' }).click();
});

test('v3.3 mpv Sync Preview Dialog: Preview in mpv, audio/subtitle micro-nudge, and Confirm & Mux', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    window.__mpvCalls = [];
    window.__resolvedInput = null;
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        if (cmd === 'preview_sync_mpv') {
          window.__mpvCalls.push(args);
          return 'Launched mpv sync preview';
        }
        if (cmd === 'resolve_input') {
          window.__resolvedInput = args;
          return null;
        }
        return null;
      },
    };
  });

  // Trigger SyncPreviewDialog via frontend_api.ask_sync_preview
  await page.evaluate(() => {
    window.frontend_api.ask_sync_preview('cb-mpv-1', {
      file_name: 'Episode_01.mkv',
      target_video: '/media/target/Episode_01.mkv',
      audio_file: '/media/source/Episode_01_ITA.mkv',
      sub_file: '/media/source/Episode_01.srt',
      audio_delay_ms: -120,
      sub_delay_ms: 40,
      start_time: '00:03:00',
      window_label: '00:03:00 - 00:06:00',
      confidence: 'high',
    });
  });

  const dialog = page.getByTestId('sync-preview-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('sync-preview-audio-readout')).toContainText('Audio Delay: -120 ms');
  await expect(page.getByTestId('sync-preview-sub-readout')).toContainText('Subtitle Offset: +40 ms');

  // Nudge audio by +10ms (-120 -> -110) and subtitle by -25ms (+40 -> +15)
  await page.getByTestId('nudge-audio-+10').click();
  await page.getByTestId('nudge-sub--25').click();
  await expect(page.getByTestId('sync-preview-audio-readout')).toContainText('Audio Delay: -110 ms');
  await expect(page.getByTestId('sync-preview-sub-readout')).toContainText('Subtitle Offset: +15 ms');

  // Click "Preview in mpv" and verify backend command args
  await page.getByTestId('preview-in-mpv-btn').click();
  const mpvCalls = await page.evaluate(() => window.__mpvCalls);
  expect(mpvCalls.length).toBe(1);
  expect(mpvCalls[0]).toEqual({
    target: '/media/target/Episode_01.mkv',
    audioFile: '/media/source/Episode_01_ITA.mkv',
    audioDelayMs: -110,
    subFile: '/media/source/Episode_01.srt',
    subDelayMs: 15,
    startTime: '00:03:00',
  });

  // Click "Confirm & Mux" and verify resolved payload
  await page.getByTestId('confirm-and-mux-btn').click();
  await expect(dialog).not.toBeVisible();

  const resolved = await page.evaluate(() => window.__resolvedInput);
  expect(resolved.callbackId).toBe('cb-mpv-1');
  const parsed = JSON.parse(resolved.result);
  expect(parsed).toEqual({
    action: 'confirm',
    audio_delay_ms: -110,
    sub_delay_ms: 15,
  });
});

test('OpenSubtitles API key and token settings configuration and persistence', async ({ page }) => {
  await page.goto('/');

  // 1. Open Settings modal
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settingsModal = page.getByRole('dialog', { name: 'Settings' });
  await expect(settingsModal).toBeVisible();

  // 2. Locate OpenSubtitles settings card
  const osCard = settingsModal.getByTestId('opensubtitles-settings-card');
  await expect(osCard).toBeVisible();
  await expect(osCard).toContainText('OpenSubtitles.com API Integration');

  // 3. Fill API Key
  const apiKeyInput = settingsModal.getByTestId('opensubtitles-api-key-input').locator('input');
  await expect(apiKeyInput).toBeVisible();
  await expect(apiKeyInput).toHaveAttribute('type', 'password');
  await apiKeyInput.fill('my-secret-test-key-12345');

  // 4. Toggle visibility
  const toggleVisibilityBtn = settingsModal.getByLabel('Show API key');
  await toggleVisibilityBtn.click();
  await expect(apiKeyInput).toHaveAttribute('type', 'text');

  // 5. Check clear button appears and works
  const clearKeyBtn = settingsModal.getByLabel('Clear API key');
  await expect(clearKeyBtn).toBeVisible();

  // Re-fill and close modal
  await apiKeyInput.fill('persisted-api-key-abc');
  await settingsModal.getByRole('button', { name: 'Done' }).click();
  await expect(settingsModal).not.toBeVisible();

  // 6. Verify stored in localStorage
  const savedSettings = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('syncforge_settings') || '{}')
  );
  expect(savedSettings.opensubtitles_api_key).toBe('persisted-api-key-abc');
});

test('terminal drawer is immediately visible without scrolling on non-maximized window', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto('/');

  // Show Terminal button must be visible in viewport without scrolling
  const showBtn = page.getByRole('button', { name: 'Show Terminal' });
  await expect(showBtn).toBeVisible();
  const showBtnBox = await showBtn.boundingBox();
  expect(showBtnBox).not.toBeNull();
  expect(showBtnBox.y + showBtnBox.height).toBeLessThanOrEqual(700);

  // Click Show Terminal
  await showBtn.click();

  // Terminal shell, header bar, and search input must be visible within viewport bounds
  const terminalShell = page.getByTestId('terminal-shell');
  await expect(terminalShell).toBeVisible();
  await expect.poll(async () => {
    const box = await terminalShell.boundingBox();
    return Boolean(box && box.y > 0 && box.y + box.height <= 700);
  }).toBe(true);

  const searchInput = page.getByRole('textbox', { name: 'Search terminal logs' });
  await expect(searchInput).toBeVisible();
});

test('settings sections and shortcuts categories can be expanded and collapsed', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settingsModal = page.getByRole('dialog', { name: 'Settings' });
  await expect(settingsModal).toBeVisible();

  // Initially sections are expanded
  const collapseAllBtn = page.getByRole('button', { name: 'Collapse All' });
  await expect(collapseAllBtn).toBeVisible();

  // Test Collapse All
  await collapseAllBtn.click();
  const expandAllBtn = page.getByRole('button', { name: 'Expand All' });
  await expect(expandAllBtn).toBeVisible();

  // Click on "Audio & Transcoding" to expand just this section
  await page.getByRole('button', { name: /Audio & Transcoding/i }).click();
  const opusSelect = page.getByRole('combobox');
  await expect(opusSelect).toBeVisible();

  // Switch to Keyboard Shortcuts tab
  await page.getByRole('tab', { name: 'Keyboard Shortcuts' }).click();
  const shortcutsCollapseAll = page.getByRole('button', { name: 'Collapse All' });
  await expect(shortcutsCollapseAll).toBeVisible();

  // Collapse all shortcut groups
  await shortcutsCollapseAll.click();
  const shortcutsExpandAll = page.getByRole('button', { name: 'Expand All' });
  await expect(shortcutsExpandAll).toBeVisible();
});

test('CLI Command generator dialog builds syncforge-cli command and JSON script from active module', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Waveform Audio Sync & Merge', exact: true }).click();
  await page.getByRole('textbox', { name: 'Target File or Folder (High Quality)', exact: true }).fill('/media/bdrip');
  await page.getByRole('textbox', { name: 'Source File or Folder (Audio/Subs)', exact: true }).fill('/media/webdl');
  await page.getByRole('textbox', { name: 'Output Folder', exact: true }).fill('/media/out');

  await page.getByTestId('open-cli-export-btn').click();
  const dialog = page.getByTestId('cli-export-dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Source Audio Track (--audio-track)').fill('ita');
  await dialog.getByLabel('Source Subtitle Track (--sub-track)').fill('ita');

  const cmdPreview = page.getByTestId('cli-command-preview');
  await expect(cmdPreview).toContainText('syncforge-cli run injection -v /media/bdrip -s /media/webdl -o /media/out');
  await expect(cmdPreview).toContainText('--import-audio --audio-track ita');
  await expect(cmdPreview).toContainText('--import-subs --sub-track ita -y');

  const jsonPreview = page.getByTestId('cli-json-preview');
  await expect(jsonPreview).toContainText('"module": "injection"');
  await expect(jsonPreview).toContainText('"audio_track": "ita"');

  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});





