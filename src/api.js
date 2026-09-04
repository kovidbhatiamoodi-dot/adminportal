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

// File downloads come back as CSV/XLSX, not JSON, so `handleResponse` cannot
// read them — but a *failed* download still returns the usual JSON error body,
// which is the part worth surfacing. Shared so every export reports failures
// the same way instead of dumping "Failed to fetch" on the user.
const fetchBlob = async (url) => {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message || 'Export failed');
    }
    throw new Error(`Export failed (${res.status}) — backend may not be running`);
  }
  return res.blob();
};

// The filters the compi endpoints accept. Kept in one place because the list,
// the stats and both exports must agree on them — an export that quietly
// ignored a filter would hand someone a file that does not match their screen.
const COMPI_FILTER_KEYS = ['search', 'city', 'competition', 'status'];

const compiFilterParams = (filters = {}) => {
  const params = new URLSearchParams();
  for (const key of COMPI_FILTER_KEYS) {
    if (filters[key]) params.set(key, filters[key]);
  }
  return params;
};

// Same idea as COMPI_FILTER_KEYS, for the PR portal applications: the list,
// the stats and the export must agree on the filters or the CSV stops matching
// the screen it was exported from.
const PR_FILTER_KEYS = ['search', 'status', 'college'];

const prFilterParams = (filters = {}) => {
  const params = new URLSearchParams();
  for (const key of PR_FILTER_KEYS) {
    if (filters[key]) params.set(key, filters[key]);
  }
  return params;
};

export const api = {
  login: (username, password) =>
    fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ username, password }),
    }).then(handleResponse),

  // Session bootstrap. Every signed-in role can call this — /stats cannot be
  // used for the purpose because it is admin-only, so a coordinator would be
  // signed straight back out on reload.
  getMe: () =>
    fetch(`${BASE_URL}/me`, { headers: headers() }).then(handleResponse),

  getStats: () =>
    fetch(`${BASE_URL}/stats`, { headers: headers() }).then(handleResponse),

  getRegistrationAnalytics: (days = 30) =>
    fetch(`${BASE_URL}/registration-analytics?days=${encodeURIComponent(days)}`, {
      headers: headers(),
    }).then(handleResponse),

  getRegistrationsByDate: (date) =>
    fetch(`${BASE_URL}/registrations-by-date?date=${encodeURIComponent(date)}`, {
      headers: headers(),
    }).then(handleResponse),

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

  getUserPointsLog: (userId) =>
    fetch(`${BASE_URL}/users/${userId}/points-log`, { headers: headers() }).then(handleResponse),

  exportAllUsers: () => fetchBlob(`${BASE_URL}/users/export`),

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

  getTasks: () =>
    fetch(`${BASE_URL}/tasks`, { headers: headers() }).then(handleResponse),

  getTaskGenres: () =>
    fetch(`${BASE_URL}/tasks/genres`, { headers: headers() }).then(handleResponse),

  createTask: (task) =>
    fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(task),
    }).then(handleResponse),

  updateTask: (taskId, task) =>
    fetch(`${BASE_URL}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(task),
    }).then(handleResponse),

  deleteTask: (taskId) =>
    fetch(`${BASE_URL}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: headers(),
    }).then(handleResponse),

  getTaskSubmissions: (page = 1, status = '') =>
    fetch(`${BASE_URL}/task-submissions?page=${page}&limit=20&status=${status}`, {
      headers: headers(),
    }).then(handleResponse),

  updateTaskSubmissionStatus: (submissionId, status) =>
    fetch(`${BASE_URL}/task-submissions/${submissionId}/status`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ status }),
    }).then(handleResponse),

  getPrCandidates: (page = 1, status = 'pending') =>
    fetch(`${BASE_URL}/pr-candidates?page=${page}&limit=20&status=${status}`, {
      headers: headers(),
    }).then(handleResponse),

  updatePrStatus: (userId, status) =>
    fetch(`${BASE_URL}/pr-candidates/${userId}/status`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ status }),
    }).then(handleResponse),

  // ── PR portal applications (superadmin + admin) ───────────────────────
  // 403 for coordinator and compi. Distinct from getPrCandidates above: that is
  // the earned-promotion review queue, this is the students who applied through
  // the /pr portal themselves.
  // Same filters on all three, so the tiles and the CSV describe the rows the
  // list is showing.
  getPrApplications: (page = 1, filters = {}) => {
    const params = prFilterParams(filters);
    params.set('page', page);
    params.set('limit', 50);
    return fetch(`${BASE_URL}/pr-applications?${params}`, {
      headers: headers(),
    }).then(handleResponse);
  },

  getPrApplicationStats: (filters = {}) => {
    const qs = prFilterParams(filters).toString();
    return fetch(`${BASE_URL}/pr-applications/stats${qs ? `?${qs}` : ''}`, {
      headers: headers(),
    }).then(handleResponse);
  },

  exportPrApplications: (filters = {}) =>
    fetchBlob(`${BASE_URL}/pr-applications/export?${prFilterParams(filters)}`),

  // ── Multicity competitions (compi role only) ──────────────────────────
  // These 403 for admin and coordinator tokens by design — the multicity
  // registrations belong to a different team. See admin.routes.js.
  // Takes the same filters as getCompiRegistrations, because the stats describe
  // the rows that call returns. Sending no filters asks for fest-wide totals.
  getCompiStats: (filters = {}) => {
    const qs = compiFilterParams(filters).toString();
    return fetch(`${BASE_URL}/compi/stats${qs ? `?${qs}` : ''}`, {
      headers: headers(),
    }).then(handleResponse);
  },

  getCompiRegistrations: (page = 1, filters = {}) => {
    const params = compiFilterParams(filters);
    params.set('page', page);
    params.set('limit', 50);
    return fetch(`${BASE_URL}/compi/registrations?${params}`, {
      headers: headers(),
    }).then(handleResponse);
  },

  // Returns a blob rather than JSON: the CSV is built server-side so the
  // browser never holds every registration in memory to format it.
  exportCompiRegistrations: (filters = {}) =>
    fetchBlob(`${BASE_URL}/compi/registrations/export?${compiFilterParams(filters)}`),

  // Same data, competition-wise: an .xlsx workbook with a summary sheet and one
  // sheet per competition. Built server-side for the same reason as the CSV —
  // and because splitting it here would mean shipping a spreadsheet library to
  // the browser to do what the backend can already do in one pass.
  exportCompiRegistrationsExcel: (filters = {}) =>
    fetchBlob(`${BASE_URL}/compi/registrations/export-excel?${compiFilterParams(filters)}`),
};
