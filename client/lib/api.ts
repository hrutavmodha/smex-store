export const TOKEN_STORAGE_KEY = 'smex_auth_token';

/**
 * Stored token helper functions are retained for backward compatibility,
 * but authentication relies exclusively on HTTP-only cookies.
 */
export function getStoredToken(): string | null {
  return null;
}

/**
 * Persist or clear the access token (no-op since cookies are used).
 */
export function setStoredToken(_token: string | null): void {
  void _token;
  // No-op: Auth tokens are managed exclusively via HTTP-only cookies
}

/**
 * Resolves the appropriate base URL for API requests.
 * In the browser, returns NEXT_PUBLIC_API_URL if configured,
 * otherwise an empty string to use same-origin relative URLs (/api/...).
 * In SSR / Node, uses the internal service address (INTERNAL_API_URL).
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || '';
  }

  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
}

/**
 * Resolves the appropriate WebSocket URL for real-time channels.
 * Uses NEXT_PUBLIC_WS_URL if set; otherwise resolves dynamically
 * to the current window host (wss: on HTTPS, ws: on HTTP).
 */
export function getWebSocketUrl(): string {
  if (typeof window !== 'undefined') {
    if (process.env.NEXT_PUBLIC_WS_URL) {
      return process.env.NEXT_PUBLIC_WS_URL;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  return process.env.NEXT_PUBLIC_WS_URL || '';
}

export interface FetchWithAuthOptions extends RequestInit {
  skipAuth?: boolean;
  skipAutoRefresh?: boolean;
}

/**
 * Authenticated fetch client that relies strictly on HTTP-only cookies,
 * includes credentials ('include'), and handles automatic silent token refresh
 * on 401 Unauthorized responses.
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: FetchWithAuthOptions = {}
): Promise<Response> {
  const { skipAuth = false, skipAutoRefresh = false, ...fetchInit } = init;
  void skipAuth;
  const headers = new Headers(fetchInit.headers || {});

  const response = await fetch(input, {
    ...fetchInit,
    headers,
    credentials: fetchInit.credentials || 'include',
  });

  const urlStr = typeof input === 'string' ? input : input.toString();

  // If 401 received on a protected resource, attempt silent token refresh via HTTP-only cookie
  if (
    response.status === 401 &&
    !skipAutoRefresh &&
    !urlStr.includes('/api/v1/auth/refresh') &&
    !urlStr.includes('/api/v1/auth/login') &&
    !urlStr.includes('/api/v1/auth/logout')
  ) {
    try {
      const refreshRes = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (refreshRes.ok) {
        return fetch(input, {
          ...fetchInit,
          headers,
          credentials: fetchInit.credentials || 'include',
        });
      }
    } catch {
      // Ignore network errors on refresh attempt
    }
  }

  return response;
}
