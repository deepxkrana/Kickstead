import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const schema = path.join(repoRoot, 'database/prisma/schema.prisma');
const prismaBin = path.join(repoRoot, 'node_modules/.bin/prisma');

/** Applies all migrations to the local test database once per test run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set');
  const host = new URL(url).host;
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };

  // Run Prisma from an empty temp folder outside the repo so it cannot load backend/.env or
  // database/.env (which point at Supabase). Then confirm the target before migrating anyway.
  const cwd = mkdtempSync(path.join(tmpdir(), 'kickstead-test-migrate-'));
  try {
    // `migrate status` exits non-zero while migrations are pending, so read its output regardless.
    const status = spawnSync(prismaBin, ['migrate', 'status', '--schema', schema], { cwd, env, encoding: 'utf8' });
    const output = `${status.stdout}${status.stderr}`;
    if (output.includes('Environment variables loaded')) {
      throw new Error('Refusing to migrate: Prisma loaded a .env file during test setup.');
    }
    if (!output.includes(`at "${host}"`)) {
      throw new Error(`Refusing to migrate: Prisma did not target the test database (${host}).\n${output}`);
    }

    execFileSync(prismaBin, ['migrate', 'deploy', '--schema', schema], {
      cwd,
      env,
      stdio: ['ignore', 'ignore', 'inherit'],
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
