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
 * In the browser, returns an empty string to use same-origin relative URLs (/api/...)
 * unless an external NEXT_PUBLIC_API_URL is explicitly targeted.
 * In SSR / Node, falls back to the backend service address.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (envUrl && (!envUrl.includes('localhost') || isLocalhost)) {
      return envUrl;
    }
    return '';
  }

  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'
  );
}

/**
 * Resolves the appropriate WebSocket URL for real-time channels.
 * Intelligently switches between same-origin / reverse proxy,
 * LAN IP dev server, and local dev fallback.
 */
export function getWebSocketUrl(): string {
  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    // If accessing dev server via LAN IP from a mobile phone (e.g. 192.168.x.x:3000):
    if (!isLocalhost && window.location.port === '3000') {
      return `ws://${window.location.hostname}:3001`;
    }

    const envWsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (envWsUrl && (!envWsUrl.includes('localhost') || isLocalhost)) {
      return envWsUrl;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  return process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
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
