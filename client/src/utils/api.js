export const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path) {
  if (!path) return API_BASE;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

const DEVICE_ID_KEY = 'campus_cue_device_email';

function getOrCreateDeviceIdentity() {
  try {
    let existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.includes('@')) return existing;
    const rand = Math.random().toString(36).slice(2, 10);
    existing = `student-${rand}@local.campuscue`;
    localStorage.setItem(DEVICE_ID_KEY, existing);
    return existing;
  } catch {
    return 'student-session@local.campuscue';
  }
}

export function getActiveUserEmail() {
  try {
    const raw = localStorage.getItem('campus_cue_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      const email = (parsed?.email || '').trim().toLowerCase();
      if (email && email.includes('@')) return email;
    }
  } catch {
    // ignore storage errors
  }
  return getOrCreateDeviceIdentity();
}

export function apiFetch(path, options = {}) {
  const email = getActiveUserEmail();
  const headers = {
    ...(options.headers || {}),
    'x-user-email': email,
  };
  return fetch(apiUrl(path), {
    ...options,
    headers,
  });
}

