const BASE_URL = '/api/v1/admin';

const getToken = () => localStorage.getItem('admin_token');

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  ...extra,
});

const handleResponse = async (res) => {
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
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
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || 'Export failed');
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
