// JSON client for the backend. Auth lives in httpOnly cookies the browser sends
// automatically; this file never sees a token.

let refreshInFlight = null;

// Trades the refresh cookie for a fresh access cookie. Concurrent callers share one request.
// Resolves to 'ok', 'invalid' (the session has ended: sign in again) or 'unreachable' (no
// usable answer, e.g. the network is still coming back: worth trying again).
export function renewSession() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
        if (res.ok) return 'ok';
        if (res.status === 401) return 'invalid';
        // 409: another tab rotated the token a moment ago and its new cookie is already set
        if (res.status !== 409) return 'unreachable';
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      return 'unreachable';
    })()
      .catch(() => 'unreachable')
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

const refreshSession = async () => (await renewSession()) === 'ok';

const NO_REFRESH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/guest',
  '/api/auth/refresh',
  '/api/auth/logout',
]);

export async function api(path, { method = 'GET', body } = {}) {
  const send = () => fetch(path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let res = await send();
  // The access cookie only lasts 15 minutes: refresh once and retry
  if (res.status === 401 && !NO_REFRESH_PATHS.has(path) && await refreshSession()) {
    res = await send();
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.error || 'Something went wrong. Please try again.');
    error.status = res.status;
    error.code = data?.code;
    throw error;
  }
  return data;
}
