/**
 * Pure calendar helpers — native Date only, no date library (matches the codebase).
 * Weeks are Monday-start.
 */

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function sameDay(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
  );
}

export function firstOfMonth(d) {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), 1);
}

export function addMonths(d, n) {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth() + n, 1);
}

/** Monday-based weekday index (Mon=0 … Sun=6). */
function mondayIndex(date) {
  return (date.getDay() + 6) % 7;
}

/** 6×7 matrix of { date, inMonth, isToday } starting on the Monday on/before the 1st. */
export function buildMonthMatrix(anchor) {
  const first = firstOfMonth(anchor);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - mondayIndex(first));
  const today = new Date();

  const weeks = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < 6; w += 1) {
    const row = [];
    for (let d = 0; d < 7; d += 1) {
      row.push({
        date: new Date(cursor),
        inMonth: cursor.getMonth() === first.getMonth(),
        isToday: sameDay(cursor, today),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

export function ymd(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Map<yyyy-mm-dd, event[]> with each day's events sorted by start time. */
export function groupEventsByDay(events) {
  const map = new Map();
  for (const ev of events || []) {
    if (!ev.scheduled_at) continue;
    const key = ymd(ev.scheduled_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ev);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  }
  return map;
}

export function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function formatTimeRange(start, durationMin) {
  if (!start) return '';
  const s = formatTime(start);
  if (!durationMin) return s;
  const end = new Date(new Date(start).getTime() + durationMin * 60000);
  return `${s}–${formatTime(end)}`;
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function monthLabel(anchor) {
  return new Date(anchor).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
