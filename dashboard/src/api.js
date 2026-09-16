const API_BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const token = localStorage.getItem('sa_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

export const api = {
  auth: {
    login: (email, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (email, password, name) => request('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
    me: () => request('/api/auth/me'),
  },
  widgets: {
    list: () => request('/api/widgets'),
    create: (name, config) => request('/api/widgets', { method: 'POST', body: JSON.stringify({ name, config }) }),
    get: (id) => request(`/api/widgets/${id}`),
    update: (id, data) => request(`/api/widgets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/widgets/${id}`, { method: 'DELETE' }),
  },
  knowledge: {
    list: (widgetId) => request(`/api/widgets/${widgetId}/knowledge`),
    create: (widgetId, data) => request(`/api/widgets/${widgetId}/knowledge`, { method: 'POST', body: JSON.stringify(data) }),
    update: (widgetId, id, data) => request(`/api/widgets/${widgetId}/knowledge/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (widgetId, id) => request(`/api/widgets/${widgetId}/knowledge/${id}`, { method: 'DELETE' }),
  },
  analytics: {
    get: (widgetId, period) => request(`/api/widgets/${widgetId}/analytics?period=${period || '7d'}`),
  },
};
