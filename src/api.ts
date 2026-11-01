export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
let csrf: { token: string; headerName: string } | undefined;
export async function token() {
  const response = await fetch('/api/csrf', { credentials: 'same-origin' });
  if (!response.ok) throw new Error('Connexion au serveur impossible.');
  csrf = await response.json();
  return csrf!;
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    const current = csrf ?? await token(); headers[current.headerName] = current.token;
    headers['Content-Type'] = body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json';
  }
  const response = await fetch('/api' + path, { method, credentials: 'same-origin', headers,
    body: body === undefined ? undefined : body instanceof URLSearchParams ? body.toString() : JSON.stringify(body) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== '/connexion' && path !== '/session') window.dispatchEvent(new Event('session-expired'));
    throw new ApiError(response.status, data.message || `La demande a échoué (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export async function login(login: string, password: string) {
  await token();
  await api('/connexion', 'POST', new URLSearchParams({ username: login, password }));
  await token();
}
export async function logout() { await api('/deconnexion', 'POST'); csrf = undefined; }
