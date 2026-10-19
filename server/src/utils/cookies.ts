import type { FastifyRequest } from 'fastify';

export interface CookieSource {
  cookies?: Record<string, string | undefined>;
  headers?: {
    cookie?: string;
    [key: string]: any;
  };
}

/**
 * Safely parses a specific cookie by name from a raw Cookie header string.
 * Splits ONLY on the first '=' character to prevent truncating cookie values
 * containing base64 padding, URL-encoded parameters, or multiple '=' symbols.
 */
export function parseCookieHeader(
  cookieHeader: string | undefined,
  name: string
): string | undefined {
  if (!cookieHeader) return undefined;

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      if (key === name) {
        const val = trimmed.slice(eqIdx + 1).trim();
        try {
          return decodeURIComponent(val);
        } catch {
          return val;
        }
      }
    }
  }
  return undefined;
}

/**
 * Extracts a cookie value from a Fastify request or CookieSource object.
 * Checks pre-parsed `request.cookies` first, falling back to robust raw Cookie header parsing.
 */
export function getCookie(
  request: CookieSource | FastifyRequest,
  name: string
): string | undefined {
  if (request.cookies && request.cookies[name] !== undefined) {
    return request.cookies[name];
  }
  return parseCookieHeader(request.headers?.cookie, name);
}

/**
 * Extracts the first matching cookie value from a candidate list of cookie names.
 */
export function getAnyCookie(
  request: CookieSource | FastifyRequest,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const val = getCookie(request, name);
    if (val !== undefined) {
      return val;
    }
  }
  return undefined;
}
