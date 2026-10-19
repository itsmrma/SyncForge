import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:4179', viewport: { width: 1200, height: 900 } },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4179',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: !process.env.CI,
  },
});
