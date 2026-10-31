// Midnight on a calendar date in a named time zone, computed on the server so the lock can't be faked.
export const TIME_ZONES = [
  ['Asia/Kolkata', 'India (IST)', 'IST'],
  ['local', 'Their own time zone', 'their local time'],
  ['Europe/London', 'UK', 'UK time'],
  ['America/New_York', 'US Eastern', 'ET'],
  ['America/Chicago', 'US Central', 'CT'],
  ['America/Los_Angeles', 'US Pacific', 'PT'],
  ['Asia/Dubai', 'Gulf (GST)', 'GST'],
  ['Asia/Singapore', 'Singapore (SGT)', 'SGT'],
  ['Australia/Sydney', 'Sydney', 'Sydney time'],
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FIXED_OFFSETS = { 'Asia/Kolkata': 330, 'Asia/Dubai': 240, 'Asia/Singapore': 480 }; // fallback if Intl lacks zone data

function tzOffset(tz, ts) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ts)).map((p) => [p.type, p.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second) - ts;
}
export function midnightIn(date, tz) {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  try {
    const first = guess - tzOffset(tz, guess);
    return guess - tzOffset(tz, first);
  } catch {
    if (FIXED_OFFSETS[tz] != null) return guess - FIXED_OFFSETS[tz] * 60_000;
    throw new Error('Unknown time zone ' + tz);
  }
}
const ordinal = (n) => n + ((n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));

/** Info the renderer needs, plus `serverAt`: the moment the server starts releasing the content. */
export function unlockInfo(unlock) {
  if (!unlock || !/^\d{4}-\d{2}-\d{2}$/.test(unlock.date || '')) return null;
  const zone = TIME_ZONES.find((z) => z[0] === unlock.tz) || TIME_ZONES[0];
  const [y, m, d] = unlock.date.split('-').map(Number);
  const local = zone[0] === 'local';
  const at = local ? null : midnightIn(unlock.date, zone[0]);
  // "Their own time zone": the earliest midnight anywhere on Earth is UTC+14. Their device counts down to its
  // own midnight; the server releases content once it's that date somewhere.
  const serverAt = local ? Date.UTC(y, m - 1, d) - 14 * 3600_000 : at;
  return { date: unlock.date, local, at, serverAt, long: `${ordinal(d)} ${MONTHS[m - 1]}`, short: `${MONTHS[m - 1]} ${d}`, zone: zone[2] };
}
