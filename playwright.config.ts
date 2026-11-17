import { defineConfig, devices } from '@playwright/test'

// Port 3000 is the live server. E2E uses its own port and a throwaway DB.
const PORT = 3103
const DB_FILE = 'e2e.db'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Fresh DB each run (prisma resolves file: paths relative to prisma/).
    command: `rm -f prisma/${DB_FILE} prisma/${DB_FILE}-journal && npx prisma db push --skip-generate && npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: `file:./${DB_FILE}`,
      SMARTBRIEF_PASSWORD: '',
      ANTHROPIC_API_KEY: '',
    },
  },
})
