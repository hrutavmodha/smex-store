import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import '../helper.js';
import {
  TransactionalEmailService,
  sentEmailsLog,
  emailService,
} from '../../src/services/email.service.js';

describe('Transactional Email Service Unit Tests', () => {
  test('sendVerificationEmail logs email and returns true', async () => {
    const service = new TransactionalEmailService();
    const result = await service.sendVerificationEmail('test@smexstore.com', 'token123');
    assert.equal(result, true);

    const logged = sentEmailsLog.find((e) => e.token === 'token123');
    assert.ok(logged);
    assert.equal(logged.to, 'test@smexstore.com');
    assert.equal(logged.type, 'verification');
  });

  test('sendPasswordResetEmail logs email and returns true', async () => {
    const service = new TransactionalEmailService();
    const result = await service.sendPasswordResetEmail('reset@smexstore.com', 'token456');
    assert.equal(result, true);

    const logged = sentEmailsLog.find((e) => e.token === 'token456');
    assert.ok(logged);
    assert.equal(logged.to, 'reset@smexstore.com');
    assert.equal(logged.type, 'password_reset');
  });

  test('TransactionalEmailService handles Resend instance creation and default export', async () => {
    const serviceWithKey = new TransactionalEmailService('re_test_key_123');
    assert.ok(serviceWithKey);
    assert.ok(emailService);
  });
});
