import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      // Placeholder only: unit/HTTP-shape tests never open a database connection.
      DATABASE_URL: 'postgresql://test:test@localhost:5432/kickstead_test',
      CLIENT_URL: 'http://localhost:5173',
      SUPABASE_URL: 'https://test-project.supabase.co',
      ADMIN_EMAILS: 'admin@test.dev, Boss@Test.dev',
    },
  },
});
