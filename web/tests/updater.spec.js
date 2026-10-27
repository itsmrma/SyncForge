import { test, expect } from '@playwright/test';

async function launch(page, options = {}) {
  await page.addInitScript(options => {
    window.updateChecks = 0;
    window.updateInstalls = 0;
    window.savedSettings = [];
    window.pywebview = { api: {
      updater_info: async () => ({ supported: options.supported !== false, platform: options.platform || 'windows', version: '3.5.3' }),
      load_settings: async () => ({ auto_update: options.auto !== false }),
      save_settings: async value => { window.savedSettings.push(value); },
      download_update: async progress => {
        window.updateChecks++;
        if (options.fail) throw new Error('Network unavailable');
        if (options.current) return null;
        window.updateProgress = progress;
        return await new Promise(resolve => { window.finishDownload = () => resolve({ version: '3.5.4', notes: 'Update test release notes' }); });
      },
      install_update: async () => {
        window.updateInstalls++;
        if (options.installFail) throw new Error('Installer could not start');
      },
      run_module: async () => await new Promise(resolve => { window.finishTask = () => resolve({ status: 'ok', message: 'Task completed.' }); }),
    } };
  }, options);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.frontend_api));
}

async function settings(page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const section = page.getByTestId('update-settings');
  await section.scrollIntoViewIfNeeded();
  return section;
}

test('background download survives settings closing and only installs on request', async ({ page }) => {
  await launch(page);
  await expect.poll(() => page.evaluate(() => window.updateChecks)).toBe(1);
  const section = await settings(page);
  await expect(section.getByRole('status')).toHaveText('Checking for updates...');
  await page.evaluate(() => window.updateProgress({ downloaded: 50, total: 100 }));
  await expect(section.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.evaluate(() => window.finishDownload());
  await expect(page.getByRole('button', { name: 'View update' })).toBeVisible();
  await page.getByRole('button', { name: 'View update' }).click();
  await expect(section.getByRole('button', { name: 'Restart to install' })).toBeInViewport();
  await section.getByText('Release notes', { exact: true }).click();
  await expect(section).toContainText('Update test release notes');
  expect(await page.evaluate(() => window.updateInstalls)).toBe(0);
  await section.getByRole('button', { name: 'Restart to install' }).click();
  await expect.poll(() => page.evaluate(() => window.updateInstalls)).toBe(1);
});

test('saved opt-out prevents startup download and manual checking remains available', async ({ page }) => {
  await launch(page, { auto: false, current: true });
  const section = await settings(page);
  await expect(section.getByRole('checkbox')).not.toBeChecked();
  expect(await page.evaluate(() => window.updateChecks)).toBe(0);
  expect(await page.evaluate(() => window.savedSettings.every(value => value.auto_update === false))).toBe(true);
  await section.getByRole('button', { name: 'Check for updates' }).click();
  await expect(section.getByRole('status')).toHaveText('You are using the latest version.');
  expect(await page.evaluate(() => window.updateChecks)).toBe(1);
  await section.getByRole('checkbox').check();
  await expect.poll(() => page.evaluate(() => window.updateChecks)).toBe(2);
});

test('periodic checks discover a later update while the app stays open', async ({ page }) => {
  await page.clock.install();
  await launch(page, { current: true });
  await page.clock.runFor(100);
  await expect.poll(() => page.evaluate(() => window.updateChecks)).toBe(1);
  await page.clock.fastForward(4 * 60 * 60 * 1000);
  await expect.poll(() => page.evaluate(() => window.updateChecks)).toBe(2);
});

test('download errors can be retried without offering installation', async ({ page }) => {
  await launch(page, { fail: true });
  const section = await settings(page);
  await expect(section.getByRole('alert')).toContainText('Network unavailable');
  await expect(section.getByRole('button', { name: 'Restart to install' })).toHaveCount(0);
  await section.getByRole('button', { name: 'Retry update' }).click();
  expect(await page.evaluate(() => window.updateChecks)).toBe(2);
});

test('installer errors retain the verified download for a retry', async ({ page }) => {
  await launch(page, { installFail: true });
  await page.waitForFunction(() => Boolean(window.finishDownload));
  await page.evaluate(() => window.finishDownload());
  const section = await settings(page);
  await section.getByRole('button', { name: 'Restart to install' }).click();
  await expect(section.getByRole('alert')).toContainText('Installer could not start');
  await expect(section.getByRole('button', { name: 'Restart to install' })).toBeEnabled();
  expect(await page.evaluate(() => window.updateChecks)).toBe(1);
});

test('restart is disabled until a media task finishes', async ({ page }) => {
  await launch(page);
  await page.waitForFunction(() => Boolean(window.finishDownload));
  await page.evaluate(() => window.finishDownload());
  await page.getByRole('button', { name: 'Launch Module', exact: true }).click();
  await page.waitForFunction(() => Boolean(window.finishTask));
  const section = await settings(page);
  await expect(section.getByRole('button', { name: 'Restart to install' })).toBeDisabled();
  await expect(section).toContainText('Wait for the current media task');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.evaluate(() => window.finishTask());
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await settings(page);
  await expect(section.getByRole('button', { name: 'Restart to install' })).toBeEnabled();
});

for (const platform of ['windows', 'linux', 'macos']) {
  test(`${platform} unsupported/portable build offers manual releases only`, async ({ page }) => {
    await launch(page, { supported: false, platform });
    const section = await settings(page);
    await expect(section.getByRole('link', { name: 'Open releases' })).toHaveAttribute('href', 'https://github.com/itsmrma/SyncForge/releases/latest');
    await expect(section.getByRole('checkbox')).toHaveCount(0);
    expect(await page.evaluate(() => window.updateChecks)).toBe(0);
    await expect(section).toContainText(platform === 'windows' ? 'Windows installer' : platform === 'linux' ? 'Linux AppImage' : 'SyncForge.app');
  });
}

for (const platform of ['linux', 'macos']) {
  test(`${platform} release supports automatic download and explicit restart`, async ({ page }) => {
    await launch(page, { platform });
    await expect.poll(() => page.evaluate(() => window.updateChecks)).toBe(1);
    await page.waitForFunction(() => Boolean(window.finishDownload));
    await page.evaluate(() => window.finishDownload());
    await page.getByRole('button', { name: 'View update' }).click();
    const section = page.getByTestId('update-settings');
    await expect(section.getByRole('checkbox')).toBeChecked();
    await expect(section.getByRole('button', { name: 'Restart to install' })).toBeInViewport();
    expect(await page.evaluate(() => window.updateInstalls)).toBe(0);
    await section.getByRole('button', { name: 'Restart to install' }).click();
    await expect.poll(() => page.evaluate(() => window.updateInstalls)).toBe(1);
  });
}

test('unknown download length shows indeterminate progress', async ({ page }) => {
  await launch(page);
  await page.waitForFunction(() => Boolean(window.updateProgress));
  await page.evaluate(() => window.updateProgress({ downloaded: 1024, total: null }));
  const section = await settings(page);
  await expect(section.getByRole('status')).toHaveText('Downloading update...');
  await expect(section.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
});
