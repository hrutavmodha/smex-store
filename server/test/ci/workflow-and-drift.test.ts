import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { execSync } from 'node:child_process';

describe('Continuous Integration & Schema Drift Suite (LLT 2.1)', () => {
  test('Test 1: GitHub Actions CI workflow schema & trigger validation', () => {
    const repoRoot = path.resolve(import.meta.dirname, '../../..');
    const ciPath = path.resolve(repoRoot, '.github/workflows/ci.yml');
    assert.ok(fs.existsSync(ciPath), '.github/workflows/ci.yml must exist');

    const fileContent = fs.readFileSync(ciPath, 'utf8');
    const doc = YAML.parse(fileContent);

    // Validate triggers
    assert.ok(doc.on, 'Triggers section must be defined');
    assert.ok(doc.on.push?.branches?.includes('main'), 'Must trigger on push to main');
    assert.ok(doc.on.pull_request?.branches?.includes('main'), 'Must trigger on pull_request to main');

    // Validate parallel matrix jobs
    const jobs = doc.jobs;
    assert.ok(jobs, 'Jobs must be defined');
    assert.ok(jobs.lint, 'Job "lint" must be defined');
    assert.ok(jobs.typecheck, 'Job "typecheck" must be defined');
    assert.ok(jobs['test-server'], 'Job "test-server" must be defined');
    assert.ok(jobs['test-client'], 'Job "test-client" must be defined');
    assert.ok(jobs['schema-drift'], 'Job "schema-drift" must be defined');
    assert.ok(jobs.build, 'Job "build" must be defined');

    // Verify build job depends on all upstream verification jobs
    const buildNeeds = jobs.build.needs;
    assert.ok(Array.isArray(buildNeeds), 'Build job must have upstream dependencies');
    assert.ok(buildNeeds.includes('lint'));
    assert.ok(buildNeeds.includes('typecheck'));
    assert.ok(buildNeeds.includes('test-server'));
    assert.ok(buildNeeds.includes('test-client'));
    assert.ok(buildNeeds.includes('schema-drift'));

    // Verify test-server service containers
    assert.ok(jobs['test-server'].services?.postgres, 'Postgres service container must be defined');
    assert.ok(jobs['test-server'].services?.redis, 'Redis service container must be defined');
  });

  test('Test 2: Drizzle schema drift check execution', () => {
    // Verify that drizzle-kit check runs cleanly against existing migrations and schema
    try {
      const repoRoot = path.resolve(import.meta.dirname, '../../..');
      const serverDir = path.resolve(repoRoot, 'server');
      const output = execSync('npx drizzle-kit check', {
        cwd: serverDir,
        encoding: 'utf8',
        stdio: 'pipe',
      });
      // Zero drift
      assert.ok(true, 'drizzle-kit check succeeded with zero schema drift');
    } catch (err: any) {
      // If error output indicates drift or failure
      assert.fail(`Schema drift check failed: ${err.message || err.stdout || err.stderr}`);
    }
  });
});
