export { html } from 'htm/preact';

export async function api(path, { method = 'GET', body } = {}) {
  const options = { method, headers: {} };
  if (method !== 'GET') {
    options.headers = { 'Content-Type': 'application/json', 'X-Call-Desk': '1' };
    options.body = JSON.stringify(body ?? {});
  }
  const res = await fetch(path, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty or non-JSON body
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const TIERS = ['first', 'next', 'later', 'skip', 'done', 'snoozed'];

export const TIER_META = {
  first: { label: 'Call first', hint: 'Left you on seen' },
  next: { label: 'Call next', hint: 'Good chat, not called yet' },
  later: { label: 'Maybe later', hint: 'Quiet, cold or too soon' },
  skip: { label: 'Don’t call', hint: 'Not interested, personal, spam' },
  done: { label: 'Called', hint: 'Handled for now' },
  snoozed: { label: 'Snoozed', hint: 'Call-backs & reminders' },
};

export const OUTCOMES = [
  { id: 'interested', label: 'Interested', icon: 'thumbsUp', tone: 'good', key: '1' },
  { id: 'callback', label: 'Call back later', icon: 'calendar', tone: 'wait', key: '2' },
  { id: 'no_answer', label: 'No answer', icon: 'phoneMissed', tone: 'wait', key: '3' },
  { id: 'not_interested', label: 'Not interested', icon: 'thumbsDown', tone: 'bad', key: '4' },
  { id: 'wrong_number', label: 'Wrong number', icon: 'hash', tone: 'bad', key: '5' },
];
export const OUTCOME_LABEL = Object.fromEntries(OUTCOMES.map((o) => [o.id, o.label]));

const HOUR = 3600e3;
const DAY = 24 * HOUR;

function at(daysAhead, hour) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

export function callbackChoices() {
  return [
    { label: 'In 2 hours', at: Date.now() + 2 * HOUR },
    { label: 'Tomorrow morning', at: at(1, 10) },
    { label: 'In 3 days', at: at(3, 10) },
    { label: 'Next week', at: at(7, 10) },
  ];
}

export function relTime(ts, now = Date.now()) {
  if (!ts) return '';
  const diff = now - ts;
  if (diff < 0) {
    const ahead = -diff;
    if (ahead < HOUR) return `in ${Math.max(1, Math.round(ahead / 60000))} min`;
    if (ahead < DAY) return `in ${Math.round(ahead / HOUR)} h`;
    return `in ${Math.round(ahead / DAY)} days`;
  }
  if (diff < 60e3) return 'just now';
  if (diff < HOUR) return `${Math.round(diff / 60e3)} min ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} h ago`;
  if (diff < 2 * DAY) return 'yesterday';
  if (diff < 14 * DAY) return `${Math.round(diff / DAY)} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function clock(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function dayLabel(ts, now = Date.now()) {
  const d = new Date(ts);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - new Date(d).setHours(0, 0, 0, 0)) / DAY);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function dateTime(ts) {
  return new Date(ts).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function todayLong(now = new Date()) {
  return now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export const store = {
  get(key, fallback = null) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // storage unavailable (private window) — the setting just won't stick
    }
  },
};

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
