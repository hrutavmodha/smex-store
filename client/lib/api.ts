export const TOKEN_STORAGE_KEY = 'smex_auth_token';

/**
 * Retrieve the current access token from localStorage.
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist or clear the access token in localStorage.
 */
export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota or access errors
  }
}

export interface FetchWithAuthOptions extends RequestInit {
  skipAuth?: boolean;
  skipAutoRefresh?: boolean;
}

/**
 * Authenticated fetch client that attaches Bearer tokens, includes credentials,
 * and handles automatic silent token refresh on 401 Unauthorized responses.
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: FetchWithAuthOptions = {}
): Promise<Response> {
  const { skipAuth = false, skipAutoRefresh = false, ...fetchInit } = init;
  const token = skipAuth ? null : getStoredToken();
  const headers = new Headers(fetchInit.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

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
        const refreshData = await refreshRes.json();
        if (refreshData.accessToken) {
          setStoredToken(refreshData.accessToken);
          headers.set('Authorization', `Bearer ${refreshData.accessToken}`);
          return fetch(input, {
            ...fetchInit,
            headers,
            credentials: fetchInit.credentials || 'include',
          });
        }
      } else {
        setStoredToken(null);
      }
    } catch {
      // Ignore network errors on refresh attempt
    }
  }

  return response;
}
