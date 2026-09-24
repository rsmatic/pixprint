export const STATUSES = [
  { key: 'new', label: 'New request', color: 'blue' },
  { key: 'scheduled', label: 'Scheduled', color: 'indigo' },
  { key: 'received', label: 'Unit received', color: 'cyan' },
  { key: 'diagnosing', label: 'Diagnosing', color: 'purple' },
  { key: 'awaiting_approval', label: 'Awaiting approval', color: 'amber' },
  { key: 'approved', label: 'Approved', color: 'teal' },
  { key: 'in_repair', label: 'In repair', color: 'orange' },
  { key: 'waiting_parts', label: 'Waiting parts', color: 'rose' },
  { key: 'ready', label: 'Ready for pickup', color: 'green' },
  { key: 'completed', label: 'Completed', color: 'gray' },
  { key: 'cancelled', label: 'Cancelled', color: 'slate' },
];
export const STATUS = Object.fromEntries(STATUSES.map((s) => [s.key, s]));
export const OPEN_STATUSES = STATUSES.filter((s) => !['completed', 'cancelled'].includes(s.key)).map((s) => s.key);

export const TYPES = { repair: 'Repair', maintenance: 'Maintenance', installation: 'Installation', inspection: 'Inspection' };
export const MODES = { drop_off: 'Drop-off at shop', on_site: 'On-site service', pickup: 'Pickup & return' };
export const PRIORITIES = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
export const ROLES = { admin: 'Admin', staff: 'Front desk', technician: 'Technician' };
export const TIME_SLOTS = { morning: 'Morning (8am–12pm)', afternoon: 'Afternoon (1pm–5pm)', any: 'Any time' };

export const PRINTER_BRANDS = [
  'Brother', 'Canon', 'Epson', 'HP', 'Kyocera', 'Konica Minolta', 'Lexmark', 'Ricoh', 'Samsung', 'Sharp', 'Toshiba', 'Xerox', 'Zebra',
];

export const COMMON_ISSUES = [
  'Paper jam',
  'Not printing / blank pages',
  'Streaks or faded print',
  'Error code on display',
  'Ink / toner not recognized',
  'Not connecting (Wi-Fi / USB / network)',
  'Noisy / grinding sound',
  'Scanner not working',
  'Preventive maintenance / cleaning',
];

// SQLite datetime('now') is UTC without a zone: "YYYY-MM-DD HH:MM:SS"
export function parseDate(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return new Date(s.replace(' ', 'T') + 'Z');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00');
  return new Date(s);
}

export const fmtDate = (s) =>
  s ? parseDate(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export const fmtDateTime = (s) =>
  s
    ? parseDate(s).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

export const fmtTime = (s) => (s ? parseDate(s).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');

export function fmtSchedule(start, end) {
  if (!start) return 'Not scheduled';
  const d = parseDate(start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${d}, ${fmtTime(start)}${end ? ` – ${fmtTime(end)}` : ''}`;
}

export function timeAgo(s) {
  const diff = (Date.now() - parseDate(s).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(s);
}

export function money(n, currency = 'PHP') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'PHP' }).format(n || 0);
  } catch {
    return `${currency} ${(n || 0).toFixed(2)}`;
  }
}

// "YYYY-MM-DDTHH:mm" in local time, for datetime-local inputs
export function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const toLocalDate = (d) => toLocalInput(d).slice(0, 10);

export function trackUrl(token, baseUrl) {
  const base = (baseUrl || window.location.origin + import.meta.env.BASE_URL).replace(/\/$/, '');
  return `${base}/track/${token}`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback for non-secure contexts (e.g. LAN IP over http)
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
