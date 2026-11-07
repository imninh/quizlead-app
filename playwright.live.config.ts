import { defineConfig, devices } from '@playwright/test'

const liveUrl = process.env.LIVE_URL?.trim()

export default defineConfig({
  testDir: './tests/live',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 90000,
  use: {
    baseURL: liveUrl || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'live-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 }, reducedMotion: 'reduce' },
    },
    {
      name: 'live-1366',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' },
    },
  ],
})
