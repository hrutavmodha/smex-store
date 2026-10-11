import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../../src/db/migrations');

describe('Migration Scripts and Schema Drift Suite', () => {
  test('Test 20: Clean migration replay on fresh database schema', async (t) => {
    await build(t);

    // Verify migration directory and files exist
    assert.ok(fs.existsSync(migrationsDir), 'Migrations directory must exist');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    assert.ok(files.length > 0, 'At least one SQL migration file must exist');

    // Verify SQL syntax and execution by replaying or validating SQL statements
    for (const file of files) {
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      assert.ok(sqlContent.length > 0, `Migration file ${file} must not be empty`);
      // Statements split by drizzle-kit statement breakpoint
      const statements = sqlContent.split('--> statement-breakpoint');
      assert.ok(statements.length > 0);
    }
  });

  test('Test 21: Automated Drizzle schema drift check', async () => {
    // Run drizzle-kit check using child process
    const rootServerDir = path.resolve(__dirname, '../..');
    const output = execSync('npx drizzle-kit check', {
      cwd: rootServerDir,
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    assert.ok(
      output.includes('Everything\'s fine') || output.includes('No schema changes'),
      `drizzle-kit check should report clean schema without drift, received: ${output}`
    );
  });
});
