import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.frontend_api));
});

async function append(page, text) {
  await page.evaluate(text => window.frontend_api.append_terminal(text), text);
  await expect(page.getByRole('log')).toContainText(text.trim().split('\n').at(-1));
}

for (const [title, id, targetLabel, sourceLabel, sourceType] of [
  ['Stream Manager', 'stream_manager', 'Video File or Folder'],
  ['Set Default & Forced', 'set_default', 'Video File or Folder'],
  ['Sync External Subtitles', 'sync_subs', 'Video File or Folder', 'Subtitle File or Folder', 'subtitles'],
  ['Sync Subs from MKV', 'sync_subs_mkv', 'Target Video File or Folder', 'Source Video File or Folder', 'video'],
  ['WaveSync Injection', 'injection', 'Target File or Folder (High Quality)', 'Source File or Folder (Audio/Subs)', 'video'],
  ['Custom Track Merge', 'custom_merge', 'File or Folder A (Base Video)', 'File or Folder B (Additional Audio/Subs)', 'video'],
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
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect.poll(() => sidebar.evaluate(element => element.clientWidth)).toBe(72);
  await expect(page.getByRole('separator', { name: 'Resize sidebar' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Custom Track Merge', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Custom Track Merge', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expand sidebar and show settings' }).click();
  await expect.poll(() => sidebar.evaluate(element => element.clientWidth)).toBe(originalWidth);
  await expect(page.getByRole('checkbox', { name: 'Notify when task finishes' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
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
