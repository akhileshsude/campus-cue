export function computeFirstName(name = '') {
  const cleanName = (name || '').trim();
  if (!cleanName) return '';
  return cleanName.split(/\s+/)[0];
}

export function computeInitials(name = '', email = '') {
  const cleanName = (name || '').trim();
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 1).toUpperCase();
    }
    const firstLetter = parts[0][0];
    const lastLetter = parts[parts.length - 1][0];
    return (firstLetter + lastLetter).toUpperCase();
  }
  const cleanEmail = (email || '').trim();
  if (cleanEmail) {
    return cleanEmail.slice(0, 1).toUpperCase();
  }
  return '';
}

export function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatGreeting(name, date = new Date()) {
  const timeGreeting = getTimeGreeting(date);
  const firstName = computeFirstName(name);
  if (!firstName) {
    return timeGreeting;
  }
  return `${timeGreeting}, ${firstName}`;
}

