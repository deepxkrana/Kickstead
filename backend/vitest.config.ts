import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

if (!process.env.TEST_DATABASE_URL && existsSync('.env.test')) {
  process.loadEnvFile('.env.test');
}

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/kickstead_test';

// Hard guard: tests truncate every table, so they must never run against Supabase.
if (/supabase\.(co|com)/i.test(testDatabaseUrl)) {
  throw new Error('TEST_DATABASE_URL points at Supabase. Tests only run against a local database.');
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/setup/globalSetup.ts'],
    // Database tests share one database and reset it between tests, so files run one at a time.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
      reporter: ['text-summary', 'text'],
    },
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
      CLIENT_URL: 'http://localhost:5173',
      SUPABASE_URL: 'https://test-project.supabase.co',
      ADMIN_EMAILS: 'admin@test.dev, Boss@Test.dev',
    },
  },
});
