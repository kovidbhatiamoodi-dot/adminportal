const getAdminApiBaseUrl = () => {
  const explicitBaseUrl =
    import.meta.env.VITE_ADMIN_API_URL?.trim() ||
    import.meta.env.VITE_BACKEND_URL?.trim();

  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, '');
  }

  return import.meta.env.DEV
    ? 'http://localhost:5056'
    : 'https://ultronbrain.moodi.org';
};

const API_BASE_URL = getAdminApiBaseUrl();
const BASE_URL = API_BASE_URL ? `${API_BASE_URL}/api/v1/admin` : '/api/v1/admin';

const getToken = () => localStorage.getItem('admin_token');

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  ...extra,
});

const handleResponse = async (res) => {
  const contentType = res.headers.get('content-type') || '';

  // If the server returned HTML (e.g. Vite proxy error page, Express 404 HTML),
  // do NOT try to parse it as JSON — give a clean error instead.
  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      // Try to get the status text for context
      throw new Error(
        res.status === 0
          ? 'Cannot reach backend — make sure the server is running on port 5056'
          : `Server returned ${res.status} (${res.statusText || 'non-JSON response'}) — backend may not be running`
      );
    }
    // Unlikely but handle 2xx non-JSON gracefully
    return null;
  }

  // Safe JSON parse
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error('Server returned an invalid response — backend may not be running');
  }

  if (!res.ok) throw new Error(json.message || `Request failed (${res.status})`);
  return json.data;
};

export const api = {
  login: (username, password) =>
    fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ username, password }),
    }).then(handleResponse),

  getStats: () =>
    fetch(`${BASE_URL}/stats`, { headers: headers() }).then(handleResponse),

  getUsers: (page = 1, limit = 50, search = '') =>
    fetch(`${BASE_URL}/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
      headers: headers(),
    }).then(handleResponse),

  updatePoints: (userId, points) =>
    fetch(`${BASE_URL}/users/${userId}/points`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ points }),
    }).then(handleResponse),

  exportAllUsers: async () => {
    const res = await fetch(`${BASE_URL}/users/export`, { headers: headers() });
    if (!res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'Export failed');
      }
      throw new Error(`Export failed (${res.status}) — backend may not be running`);
    }
    return res.blob();
  },

  getPendingThreads: (page = 1) =>
    fetch(`${BASE_URL}/threads/pending?page=${page}&limit=20`, {
      headers: headers(),
    }).then(handleResponse),

  getAllThreads: (page = 1, status = '') =>
    fetch(`${BASE_URL}/threads?page=${page}&limit=20&status=${status}`, {
      headers: headers(),
    }).then(handleResponse),

  updateThreadStatus: (threadId, status) =>
    fetch(`${BASE_URL}/threads/${threadId}/status`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ status }),
    }).then(handleResponse),
};
