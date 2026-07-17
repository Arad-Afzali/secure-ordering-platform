const BASE = 'http://localhost:3001';

async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
  };
  if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  if (res.status === 204) return {};
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export const API = {
  // Browse (public)
  getSizes:           () => request('GET',    '/api/sizes'),
  getMainIngredients: () => request('GET',    '/api/main-ingredients'),
  getBreads:          () => request('GET',    '/api/breads'),
  getIngredients:     () => request('GET',    '/api/ingredients'),
  getDressings:       () => request('GET',    '/api/dressings'),

  // Auth
  login:          (username, password) => request('POST',   '/api/sessions', { username, password }),
  loginTotp:      (code)               => request('POST',   '/api/login-totp', { code }),
  getCurrentUser: ()                   => request('GET',    '/api/sessions/current'),
  logout:         ()                   => request('DELETE', '/api/sessions/current'),

  // Orders
  getOrders:    ()           => request('GET',    '/api/orders'),
  createOrder:  (sandwiches) => request('POST',   '/api/orders', { sandwiches }),
  deleteOrder:  (id)         => request('DELETE', `/api/orders/${id}`),
};
