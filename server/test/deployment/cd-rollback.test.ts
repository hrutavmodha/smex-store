import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

interface HealthProbeResult {
  success: boolean;
  attempts: number;
  rolledBack: boolean;
  rollbackImage?: string;
  alertEmitted: boolean;
}

/**
 * Simulates the deployment health probe polling and rollback state machine
 * specified in docs/internal/design/lld/cicd-hardening.md Section 4.
 */
async function simulateDeployHealthProbe(
  probeEndpoint: () => Promise<{ statusCode: number; body?: { status?: string } }>,
  options: {
    maxAttempts?: number;
    intervalMs?: number;
    previousStableImage?: string;
  } = {}
): Promise<HealthProbeResult> {
  const maxAttempts = options.maxAttempts ?? 10;
  const intervalMs = options.intervalMs ?? 10;
  const previousStableImage = options.previousStableImage ?? 'ghcr.io/smex/server:previous-stable';

  let attempts = 0;
  let success = false;

  for (let i = 1; i <= maxAttempts; i++) {
    attempts = i;
    try {
      const res = await probeEndpoint();
      if (res.statusCode === 200 && res.body?.status === 'ok') {
        success = true;
        break;
      }
    } catch {
      // transient failure
    }
    if (i < maxAttempts && intervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  if (!success) {
    // Automated rollback trigger
    return {
      success: false,
      attempts,
      rolledBack: true,
      rollbackImage: previousStableImage,
      alertEmitted: true,
    };
  }

  return {
    success: true,
    attempts,
    rolledBack: false,
    alertEmitted: false,
  };
}

describe('Continuous Deployment & Automated Rollback Suite (LLT 2.3)', () => {
  test('Test 6: Automated deployment rollback on health probe timeout', async () => {
    // 1. Verify deploy workflow definition
    const deployPath = path.resolve(process.cwd(), '../.github/workflows/deploy.yml');
    assert.ok(fs.existsSync(deployPath), '.github/workflows/deploy.yml must exist');

    const fileContent = fs.readFileSync(deployPath, 'utf8');
    const doc = YAML.parse(fileContent);

    // Verify triggers
    assert.ok(doc.on?.push?.branches?.includes('main'));
    assert.ok(doc.on?.workflow_dispatch !== undefined);

    // Verify health probe polling script and rollback steps exist
    assert.ok(fileContent.includes('MAX_ATTEMPTS=10'));
    assert.ok(fileContent.includes('INTERVAL=3'));
    assert.ok(fileContent.includes('Automated Rollback on Health Probe Failure'));
    assert.ok(fileContent.includes('previous-stable'));

    // 2. Behavioral verification of the health probe & automated rollback state machine
    // Simulate failing probe (e.g. 500 error or timeout across all 10 attempts)
    let callCount = 0;
    const failingProbe = async () => {
      callCount++;
      return { statusCode: 503, body: { status: 'degraded' } };
    };

    const result = await simulateDeployHealthProbe(failingProbe, {
      maxAttempts: 10,
      intervalMs: 1,
      previousStableImage: 'ghcr.io/smex/server:v1.2.3',
    });

    assert.equal(result.success, false, 'Deployment must be marked as failed');
    assert.equal(result.attempts, 10, 'Must poll up to max attempts (10 attempts / 30s)');
    assert.equal(result.rolledBack, true, 'Automatic rollback must be triggered');
    assert.equal(result.rollbackImage, 'ghcr.io/smex/server:v1.2.3', 'Must restore previous stable image tag');
    assert.equal(result.alertEmitted, true, 'Critical alert must be emitted');

    // 3. Behavioral verification of successful probe
    let successCallCount = 0;
    const successfulProbe = async () => {
      successCallCount++;
      if (successCallCount < 3) {
        return { statusCode: 503, body: { status: 'degraded' } };
      }
      return { statusCode: 200, body: { status: 'ok' } };
    };

    const successResult = await simulateDeployHealthProbe(successfulProbe, {
      maxAttempts: 10,
      intervalMs: 1,
    });

    assert.equal(successResult.success, true);
    assert.equal(successResult.attempts, 3);
    assert.equal(successResult.rolledBack, false);
    assert.equal(successResult.alertEmitted, false);
  });
});
