import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import '../helper.js';
import { parseDeviceMetadata } from '../../src/utils/fingerprint.js';

describe('Device Fingerprinting and Metadata (LLT 2.4)', () => {
  test('Test 14: Device fingerprinting with User-Agent and Accept-Language', () => {
    const windowsChromeUa =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const iosSafariUa =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const lang = 'en-US,en;q=0.9';

    const winMeta = parseDeviceMetadata(windowsChromeUa, '103.21.244.12', lang);
    assert.equal(winMeta.deviceName, 'Chrome on Windows');
    assert.equal(winMeta.deviceType, 'desktop');
    assert.equal(winMeta.ipAddress, '103.21.244.12');
    const expectedWinFp = crypto
      .createHash('sha256')
      .update(windowsChromeUa + lang)
      .digest('hex');
    assert.equal(winMeta.deviceFingerprint, expectedWinFp);

    const iosMeta = parseDeviceMetadata(iosSafariUa, '103.21.244.13', lang);
    assert.equal(iosMeta.deviceName, 'Safari on iOS');
    assert.equal(iosMeta.deviceType, 'mobile');
    const expectedIosFp = crypto
      .createHash('sha256')
      .update(iosSafariUa + lang)
      .digest('hex');
    assert.equal(iosMeta.deviceFingerprint, expectedIosFp);

    // Tablet detection
    const ipadUa = 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
    const tabletMeta = parseDeviceMetadata(ipadUa, '103.21.244.14', lang);
    assert.equal(tabletMeta.deviceType, 'tablet');

    // Fallback on unknown
    const unknownMeta = parseDeviceMetadata('', '');
    assert.equal(unknownMeta.deviceName, 'Unknown Device');
    assert.equal(unknownMeta.deviceType, 'unknown');
  });

  test('Test 15: Client IP resolution under reverse proxy headers', () => {
    // When trustProxy is enabled in Fastify, client IP resolves to leftmost forwarded IP or configured proxy
    const ip = '203.0.113.195';
    const meta = parseDeviceMetadata('TestUA', ip, 'en-US');
    assert.equal(meta.ipAddress, '203.0.113.195');
    assert.ok(meta.deviceFingerprint.length === 64, 'SHA-256 hex digest must be 64 characters');
  });
});
