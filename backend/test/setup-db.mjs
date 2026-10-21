// Creates the dedicated Postgres schema the integration tests run against and
// pushes the Prisma schema into it. Safe to run repeatedly.
//
//   node test/setup-db.mjs
//
// The production rows live in the `public` schema and are never touched: the
// tests use the `test_handoff` schema and every row they create is theirs.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import pg from 'pg';

const inDocker = existsSync('/.dockerenv');
const host = inDocker ? 'ymls-pgsql-1' : 'localhost';
const port = process.env.TEST_DB_PORT || '5432';
const user = process.env.TEST_DB_USER || 'jobvision';
const password = process.env.TEST_DB_PASSWORD || 'secret';
const database = process.env.TEST_DB_NAME || 'site_assistant';
const schema = process.env.TEST_DB_SCHEMA || 'test_handoff';

const url = `postgresql://${user}:${password}@${host}:${port}/${database}?schema=${schema}`;

const client = new pg.Client({ host, port: Number(port), user, password, database });
await client.connect();
await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
await client.end();
console.log(`Schema "${schema}" is ready.`);

const result = spawnSync(
  'npx',
  ['prisma', 'db', 'push', '--skip-generate'],
  {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
    cwd: new URL('..', import.meta.url).pathname,
  }
);

if (result.status !== 0) {
  console.error('prisma db push failed');
  process.exit(result.status || 1);
}

console.log(`Test database ready at ${url.replace('?schema=' + schema, '')} (schema "${schema}").`);
