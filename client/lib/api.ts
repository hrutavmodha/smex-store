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
