/* =====================================================
   STAFF DASHBOARD v3 — SHARED UI UTILITIES
   Pure functions used by controllers + components.
   ===================================================== */

/**
 * Annual revenue goal — single source of truth.
 * Used by sales-goal-controller (pace/projection math) and
 * team-performance-controller (per-rep goal share).
 */
export const ANNUAL_GOAL = 3_000_000;

/**
 * Escape HTML for safe innerHTML insertion.
 * Critical for any user/API string rendered via innerHTML.
 */
export function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Format a number as USD with 0 decimals.
 * `formatMoney(1234567)` → "$1,234,567"
 */
export function formatMoney(n) {
    if (n == null || isNaN(n)) return '$0';
    return '$' + Math.round(n).toLocaleString('en-US');
}

/**
 * Format a number as USD with 2 decimals (for AOV etc.).
 */
export function formatMoneyCents(n) {
    if (n == null || isNaN(n)) return '$0.00';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format a percentage. `formatPercent(0.4123)` → "41%"
 */
export function formatPercent(decimal, places = 0) {
    if (decimal == null || isNaN(decimal)) return '0%';
    return (decimal * 100).toFixed(places) + '%';
}

/**
 * Format a date as "Mon, Jan 15".
 */
export function formatShortDate(date) {
    if (!date) return '';
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Format a date as "Jan 15, 2026".
 */
export function formatLongDate(date) {
    if (!date) return '';
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format a date range: "Jan 1 - Jan 31, 2026"
 */
export function formatDateRange(start, end) {
    if (!start || !end) return '';
    const s = (start instanceof Date) ? start : new Date(start);
    const e = (end instanceof Date) ? end : new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';

    const sameYear = s.getFullYear() === e.getFullYear();
    const sameMonth = sameYear && s.getMonth() === e.getMonth();

    if (sameMonth) {
        return `${s.toLocaleDateString('en-US', { month: 'short' })} ${s.getDate()} - ${e.getDate()}, ${e.getFullYear()}`;
    }
    if (sameYear) {
        return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${e.getFullYear()}`;
    }
    return `${formatLongDate(s)} - ${formatLongDate(e)}`;
}

/**
 * Format relative time. "5m ago", "2h ago", "yesterday".
 */
export function formatRelativeTime(date) {
    if (!date) return '';
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    const now = Date.now();
    const diff = now - d.getTime();
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24)   return `${hours}h ago`;
    if (days === 1)   return 'yesterday';
    if (days < 7)     return `${days}d ago`;
    return formatLongDate(d);
}

/**
 * Days from today (positive = future, negative = past).
 */
export function daysFromToday(date) {
    if (!date) return null;
    const d = (date instanceof Date) ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86_400_000);
}

/**
 * Days remaining in current calendar year.
 */
export function daysRemainingInYear() {
    const now = new Date();
    const dec31 = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    return Math.ceil((dec31 - now) / 86_400_000);
}

/**
 * Days elapsed in current calendar year (1 on Jan 1).
 */
export function dayOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86_400_000);
}

/**
 * Build a tiny inline-SVG sparkline from an array of numbers.
 * Returns an HTML string. Designed for the revenue card.
 *
 * @param {number[]} values - any length, any range
 * @param {object} [opts]
 * @param {number} [opts.width=120]
 * @param {number} [opts.height=24]
 * @param {string} [opts.stroke='currentColor']
 * @param {string} [opts.fill='none']
 */
export function sparklineSvg(values, opts = {}) {
    const { width = 120, height = 24, stroke = 'currentColor', fill = 'none' } = opts;
    if (!Array.isArray(values) || values.length < 2) {
        return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"></svg>`;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;
    const stepX = width / (values.length - 1);
    const points = values.map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / range) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">
        <polyline points="${points}" stroke="${stroke}" fill="${fill}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

/**
 * Sleep / delay helper.
 */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Debounce — call fn only after `wait` ms of quiet.
 */
export function debounce(fn, wait = 200) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

/**
 * Render a skeleton placeholder div. Caller controls width/height via class.
 */
export function skeleton(extraClass = '') {
    return `<span class="skeleton ${extraClass}"></span>`;
}

/**
 * Create a DOM element from an HTML string. Safer than innerHTML for one-off
 * inserts because it scopes parsing to a template.
 */
export function html(strings, ...values) {
    const raw = String.raw({ raw: strings }, ...values);
    const tpl = document.createElement('template');
    tpl.innerHTML = raw.trim();
    return tpl.content.firstElementChild;
}

/**
 * Get or compute days from today to a MM-DD date in the current/next year.
 * Used for upcoming birthdays.
 */
export function daysUntilMonthDay(monthDay) {
    if (!monthDay) return null;
    const [m, d] = monthDay.split('-').map(Number);
    if (!m || !d) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let target = new Date(today.getFullYear(), m - 1, d);
    if (target < today) {
        target = new Date(today.getFullYear() + 1, m - 1, d);
    }
    return Math.round((target - today) / 86_400_000);
}
