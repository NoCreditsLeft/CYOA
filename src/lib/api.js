// Thin client for our /api/* endpoints. Attaches session token automatically.

const TOKEN_KEY = 'cyoa.session.token';

export const session = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = session.get();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export const api = {
  verifySignature: (wallet, message, signature) =>
    request('/api/auth/verify', { method: 'POST', body: { wallet, message, signature } }),
  me: () => request('/api/auth/me'),

  listCanon: () => request('/api/canon'),
  addBreadcrumb: (text) => request('/api/canon/breadcrumb', { method: 'POST', body: { text } }),
  deleteCanon: (id) => request(`/api/canon?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
