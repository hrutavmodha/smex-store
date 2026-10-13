import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import '../helper.js';
import { hashPassword, verifyPassword } from '../../src/utils/crypto.js';

describe('Password Security and Cryptographic Primitives (LLT 2.1)', () => {
  test('Test 1: Argon2id parameter compliance and hash generation', async () => {
    const plain = 'ValidPassword123';
    const hash = await hashPassword(plain);

    // Verify it is an Argon2id v=19 hash with memory cost 65536, time 3, parallelism 4
    assert.match(hash, /^\$argon2id\$v=19\$m=65536/);
    assert.ok(hash.includes('p=4') && hash.includes('t=3'), 'Hash must contain parallelism 4 and timeCost 3');
  });

  test('Test 2: Password verification success on correct credentials', async () => {
    const plain = 'ValidPassword123';
    const hash = await hashPassword(plain);
    const isValid = await verifyPassword(hash, plain);
    assert.equal(isValid, true);
  });

  test('Test 3: Password verification rejection on incorrect credentials', async () => {
    const plain = 'ValidPassword123';
    const hash = await hashPassword(plain);
    const isValid = await verifyPassword(hash, 'WrongPassword999');
    assert.equal(isValid, false);

    // Also test malformed hash returns false without uncaught exception
    const malformedValid = await verifyPassword('invalid$hash$string', plain);
    assert.equal(malformedValid, false);
  });
});
