// Pure, DOM-free formatting and presentation helpers for the ServerLens UI.
// Extracted in 13.0 so they can be unit tested directly with node:test without
// a browser runtime. No module-level DOM access happens here.

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char];
  });
}

export function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No timestamp';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

export function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

export function pressureClass(value = 0) {
  if (value >= 90) return 'is-critical';
  if (value >= 75) return 'is-warn';
  return 'is-stable';
}

export function labelForStatus(status) {
  return String(status ?? 'unknown').replace(/-/g, ' ');
}
