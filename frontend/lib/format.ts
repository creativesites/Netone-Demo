/**
 * Robust date and time formatting utilities.
 * Handles Firestore Timestamp objects ({ seconds, nanoseconds } / .toDate()),
 * ISO strings, SQLite/Postgres timestamps, unix epoch numbers, and Date instances safely.
 * Never throws and never outputs "Invalid Date".
 */

export function parseDate(val: unknown): Date | null {
  if (val == null || val === '') return null;

  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // Firestore Timestamp with .toDate() method
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => unknown }).toDate === 'function') {
    const d = (val as { toDate: () => unknown }).toDate();
    if (d instanceof Date && !isNaN(d.getTime())) return d;
  }

  // Firestore raw timestamp object { seconds, nanoseconds }
  if (typeof val === 'object' && val !== null && 'seconds' in val && typeof (val as { seconds: unknown }).seconds === 'number') {
    const ts = val as { seconds: number; nanoseconds?: number };
    const ms = ts.seconds * 1000 + (ts.nanoseconds ? Math.floor(ts.nanoseconds / 1e6) : 0);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // Numeric epoch
  if (typeof val === 'number') {
    const ms = val > 1e11 ? val : val * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // String parsing
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Fix SQLite/Postgres "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SS" for Safari/standard JS
    const normalized = trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed;
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;

    // Fallback: try parsing directly
    const direct = new Date(val);
    if (!isNaN(direct.getTime())) return direct;
  }

  return null;
}

/** Format as "Aug 31, 10:44 AM" */
export function formatDateTime(val: unknown, fallback = '—'): string {
  const d = parseDate(val);
  if (!d) return fallback;
  try {
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback;
  }
}

/** Format as "Aug 31, 2026" */
export function formatDate(val: unknown, fallback = '—'): string {
  const d = parseDate(val);
  if (!d) return fallback;
  try {
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return fallback;
  }
}

/** Format as "10:44:50 AM" or "10:44 AM" */
export function formatTime(val: unknown, includeSeconds = true, fallback = '—'): string {
  const d = parseDate(val);
  if (!d) return fallback;
  try {
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
    });
  } catch {
    return fallback;
  }
}

/** Format as relative time like "Just now", "5m ago", "2h ago", "Aug 31" */
export function formatRelativeTime(val: unknown, fallback = '—'): string {
  const d = parseDate(val);
  if (!d) return fallback;

  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'Just now';

  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return 'Just now';

  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDateTime(d);
}
