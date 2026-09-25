import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  webServer: [
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } },
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174 --strictPort', url: 'http://127.0.0.1:4174', env: { VITE_SUPABASE_URL: 'https://fixture.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-anon-key' } },
  ],
})
