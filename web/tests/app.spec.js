import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.frontend_api));
});

async function append(page, text) {
  await page.evaluate(text => window.frontend_api.append_terminal(text), text);
  await expect(page.getByRole('log')).toContainText(text.trim().split('\n').at(-1));
}

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
});

test('backend rejection restores launch button and displays error', async ({ page }) => {
  await page.evaluate(() => {
    window.pywebview = { api: { run_module: async () => { throw new Error('Backend disconnected'); } } };
  });
  await page.getByRole('button', { name: 'Launch Module' }).click();
  await expect(page.getByRole('button', { name: 'Launch Module' })).toBeEnabled();
  await expect(page.getByRole('alert')).toContainText('Backend disconnected');
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
