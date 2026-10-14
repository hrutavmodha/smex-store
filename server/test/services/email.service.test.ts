import { test, describe, vi } from 'vitest';
import assert from 'node:assert/strict';
import '../helper.js';
import {
  TransactionalEmailService,
  emailService,
} from '../../src/services/email.service.js';

describe('Transactional Email Service Unit Tests', () => {
  test('sendVerificationEmail dispatches email and returns true', async () => {
    const service = new TransactionalEmailService('re_test_key_123');
    const sendSpy = vi
      .spyOn((service as any).resendClient.emails, 'send')
      .mockResolvedValue({ data: { id: 'email_1' }, error: null } as any);

    const result = await service.sendVerificationEmail('test@smexstore.com', 'token123');
    assert.equal(result, true);
    assert.equal(sendSpy.mock.calls.length, 1);
    assert.equal(sendSpy.mock.calls[0][0].to, 'test@smexstore.com');
    assert.ok(sendSpy.mock.calls[0][0].html.includes('token123'));
  });

  test('sendPasswordResetEmail dispatches email and returns true', async () => {
    const service = new TransactionalEmailService('re_test_key_123');
    const sendSpy = vi
      .spyOn((service as any).resendClient.emails, 'send')
      .mockResolvedValue({ data: { id: 'email_2' }, error: null } as any);

    const result = await service.sendPasswordResetEmail('reset@smexstore.com', 'token456');
    assert.equal(result, true);
    assert.equal(sendSpy.mock.calls.length, 1);
    assert.equal(sendSpy.mock.calls[0][0].to, 'reset@smexstore.com');
    assert.ok(sendSpy.mock.calls[0][0].html.includes('token456'));
  });

  test('TransactionalEmailService handles graceful fallback when apiKey not provided', async () => {
    const service = new TransactionalEmailService();
    const result = await service.sendVerificationEmail('test@smexstore.com', 'token_noop');
    assert.equal(result, true);
    assert.ok(emailService);
  });
});
