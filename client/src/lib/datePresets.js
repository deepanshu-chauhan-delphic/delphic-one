/**
 * Map filter bar date presets to ISO date_from / date_to (YYYY-MM-DD).
 */
export function rangeForPreset(preset, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === 'last_month') {
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0);
    return { date_from: iso(from), date_to: iso(to) };
  }
  if (preset === 'this_quarter') {
    const q = Math.floor(m / 3) * 3;
    const from = new Date(y, q, 1);
    const to = new Date(y, q + 3, 0);
    return { date_from: iso(from), date_to: iso(to) };
  }
  if (preset === 'last_quarter') {
    const q = Math.floor(m / 3) * 3 - 3;
    const from = new Date(y, q, 1);
    const to = new Date(y, q + 3, 0);
    return { date_from: iso(from), date_to: iso(to) };
  }
  if (preset === 'ytd') {
    return { date_from: iso(new Date(y, 0, 1)), date_to: iso(now) };
  }
  // this_month (default)
  const from = new Date(y, m, 1);
  const to = new Date(y, m + 1, 0);
  return { date_from: iso(from), date_to: iso(to) };
}
