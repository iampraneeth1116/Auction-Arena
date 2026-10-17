// JSON client for the backend. Auth lives in httpOnly cookies the browser sends
// automatically; this file never sees a token.

let refreshInFlight = null;

// Trades the refresh cookie for a fresh access cookie. Concurrent callers share one request.
export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
        if (res.ok) return true;
        // 409: another tab rotated the token a moment ago and its new cookie is already set
        if (res.status !== 409) return false;
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      return false;
    })()
      .catch(() => false)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

const NO_REFRESH_PATHS = new Set([
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
