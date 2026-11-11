export const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path) {
  if (!path) return API_BASE;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getActiveUserEmail() {
  try {
    const raw = localStorage.getItem('campus_cue_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      return (parsed?.email || '').trim().toLowerCase();
    }
  } catch {
    // ignore storage errors
  }
  return '';
}

export function apiFetch(path, options = {}) {
  const email = getActiveUserEmail();
  const headers = {
    ...(options.headers || {}),
  };
  if (email) {
    headers['x-user-email'] = email;
  }
  return fetch(apiUrl(path), {
    ...options,
    headers,
  });
}

