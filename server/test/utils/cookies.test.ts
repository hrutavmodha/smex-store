import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { parseCookieHeader, getCookie, getAnyCookie } from '../../src/utils/cookies.js';

describe('Server Cookie Parsing Utilities (Bug 26)', () => {
  it('correctly extracts cookie value from header string', () => {
    const header = 'sessionId=12345; smex_access_token=token_abc; theme=dark';
    assert.equal(parseCookieHeader(header, 'smex_access_token'), 'token_abc');
    assert.equal(parseCookieHeader(header, 'sessionId'), '12345');
    assert.equal(parseCookieHeader(header, 'theme'), 'dark');
    assert.equal(parseCookieHeader(header, 'non_existent'), undefined);
  });

  it('preserves cookie values containing multiple = characters without truncation', () => {
    // JWT or base64 token with padding characters
    const tokenWithEquals = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0==';
    const header = `smex_access_token=${tokenWithEquals}; other=123`;
    const parsed = parseCookieHeader(header, 'smex_access_token');
    assert.equal(parsed, tokenWithEquals);
    assert.ok(parsed?.endsWith('=='), 'Value must retain trailing == padding without truncation');
  });

  it('prefers request.cookies object if populated', () => {
    const req = {
      cookies: {
        smex_access_token: 'parsed_cookie_token',
      },
      headers: {
        cookie: 'smex_access_token=raw_header_token',
      },
    };
    assert.equal(getCookie(req, 'smex_access_token'), 'parsed_cookie_token');
  });

  it('falls back to parsing request.headers.cookie if request.cookies is missing', () => {
    const req = {
      headers: {
        cookie: 'smex_access_token=fallback_header_token==; __Host-refresh-token=ref123',
      },
    };
    assert.equal(getCookie(req, 'smex_access_token'), 'fallback_header_token==');
  });

  it('getAnyCookie returns first matching candidate', () => {
    const req = {
      headers: {
        cookie: 'smex_refresh_token=refresh_fallback_val',
      },
    };
    const val = getAnyCookie(req, '__Host-refresh-token', 'smex_refresh_token');
    assert.equal(val, 'refresh_fallback_val');
  });

  it('handles empty or malformed cookie headers gracefully', () => {
    assert.equal(parseCookieHeader(undefined, 'foo'), undefined);
    assert.equal(parseCookieHeader('', 'foo'), undefined);
    assert.equal(parseCookieHeader('malformed_no_equals; another', 'foo'), undefined);
    assert.equal(getCookie({}, 'foo'), undefined);
  });
});
