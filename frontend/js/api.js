/**
 * js/api.js
 * Centralised HTTP client for the Al-Seger REST API.
 * All fetch calls go through this module — consistent error handling,
 * automatic token injection, and typed endpoint methods.
 */

const API_BASE = 'http://localhost:5000/api';

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function _request(method, endpoint, { body, params, isFormData } = {}) {
  const token = Auth.getToken();

  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    );
    if (qs.toString()) url += `?${qs}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new ApiError('Network error. Please check your connection.', 0);
  }

  // Handle 401 — session expired
  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    Auth.clearSession();
    window.location.href = '/pages/admin/login.html';
    return;
  }

  // CSV export — return blob directly
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('text/csv')) {
    if (!response.ok) throw new ApiError('Export failed.', response.status);
    return response.blob();
  }

  let json;
  try { json = await response.json(); }
  catch { throw new ApiError('Invalid server response.', response.status); }

  if (!response.ok) {
    const message = json?.message || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, json?.errors);
  }

  return json;
}

class ApiError extends Error {
  constructor(message, status = 0, errors = null) {
    super(message);
    this.name    = 'ApiError';
    this.status  = status;
    this.errors  = errors;
  }
}

const get    = (e, o) => _request('GET',    e, o);
const post   = (e, o) => _request('POST',   e, o);
const put    = (e, o) => _request('PUT',    e, o);
const patch  = (e, o) => _request('PATCH',  e, o);
const del    = (e, o) => _request('DELETE', e, o);

// ── Auth endpoints ────────────────────────────────────────────────────────────

const Auth = {
  getToken:     ()      => localStorage.getItem('alseger_token'),
  getAdmin:     ()      => { try { return JSON.parse(localStorage.getItem('alseger_admin')); } catch { return null; } },
  isLoggedIn:   ()      => !!Auth.getToken(),
  clearSession: ()      => { localStorage.removeItem('alseger_token'); localStorage.removeItem('alseger_admin'); },
  saveSession:  (data)  => {
    localStorage.setItem('alseger_token', data.token);
    localStorage.setItem('alseger_admin', JSON.stringify(data.admin));
  },

  login:          (email, password) => post('/auth/login',    { body: { email, password } }),
  logout:         ()                => post('/auth/logout'),
  me:             ()                => get('/auth/me'),
  changePassword: (body)            => put('/auth/password',  { body }),
  updateProfile:  (body)            => put('/auth/profile',   { body }),
};

// ── Applicant endpoints ───────────────────────────────────────────────────────

const Applicants = {
  getAll:         (params)    => get('/applicants',             { params }),
  getOne:         (id)        => get(`/applicants/${id}`),
  getStats:       ()          => get('/applicants/stats'),
  create:         (formData)  => post('/applicants',            { body: formData, isFormData: true }),
  update:         (id, body)  => put(`/applicants/${id}`,       { body }),
  updateStatus:   (id, body)  => patch(`/applicants/${id}/status`, { body }),
  delete:         (id)        => del(`/applicants/${id}`),
  uploadDocuments:(id, fd)    => post(`/applicants/${id}/documents`, { body: fd, isFormData: true }),
  deleteDocument: (id, type)  => del(`/applicants/${id}/documents/${type}`),
};

// ── Country endpoints ─────────────────────────────────────────────────────────

const Countries = {
  getAll:    (params) => get('/countries', { params }),
  getOne:    (id)     => get(`/countries/${id}`),
  create:    (body)   => post('/countries',    { body }),
  update:    (id, b)  => put(`/countries/${id}`, { body: b }),
  delete:    (id)     => del(`/countries/${id}`),
};

// ── Settings endpoints ────────────────────────────────────────────────────────

const Settings = {
  getAll:     (group) => get('/settings', { params: group ? { group } : {} }),
  getOne:     (key)   => get(`/settings/${key}`),
  update:     (key, value) => put(`/settings/${key}`, { body: { value } }),
  bulkUpdate: (settings)   => put('/settings', { body: { settings } }),
};

// ── Report endpoints ──────────────────────────────────────────────────────────

const Reports = {
  summary:    ()       => get('/reports/summary'),
  byCountry:  ()       => get('/reports/by-country'),
  byStatus:   ()       => get('/reports/by-status'),
  byPeriod:   (months) => get('/reports/by-period', { params: { months } }),
  byGender:   ()       => get('/reports/gender'),
  byEducation:()       => get('/reports/education'),
  activity:   (p)      => get('/reports/activity', { params: p }),
  export: async (params) => {
    const blob = await get('/reports/export', { params });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `alseger-export-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ── Messages endpoints ────────────────────────────────────────────────────────

const Messages = {
  getAll:  (params)      => get('/messages',          { params }),
  getOne:  (id)          => get(`/messages/${id}`),
  create:  (body)        => post('/messages',          { body }),
  markRead:(id)          => patch(`/messages/${id}/read`),
  reply:   (id, body)    => post(`/messages/${id}/reply`, { body }),
  delete:  (id)          => del(`/messages/${id}`),
};

// ── Training endpoints ────────────────────────────────────────────────────────

const Training = {
  getAll:  ()     => get('/training'),
  create:  (body) => post('/training', { body }),
  delete:  (id)   => del(`/training/${id}`),
};

// ── Export global API object ──────────────────────────────────────────────────

window.API = {
  Auth, Applicants, Countries, Settings, Reports, Messages, Training, ApiError,
};