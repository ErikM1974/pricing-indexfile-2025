/**
 * Caspio Date Utils — single source of truth for parsing Caspio timestamps.
 *
 * THE BUG THIS FIXES (2026-04-30):
 * Caspio's REST API returns timestamps WITHOUT a timezone marker (no `Z`,
 * no `±HH:MM`). Two flavors land here:
 *   1. Auto-populated columns (e.g. Requested_At): filled by the Caspio
 *      server clock, which is on Pacific time.
 *   2. Backend-written columns (e.g. Sent_To_Supacolor_At, Created_At):
 *      Node writes `new Date().toISOString()` (UTC w/ Z), but Caspio stores
 *      values in its server timezone (Pacific) and returns the bare
 *      wall-clock string on read.
 *
 * Both flavors land here as naive Pacific wall-clock strings. The previous
 * idiom across the codebase was `new Date(s + 'Z')` — append Z and parse as
 * UTC — which was wrong by exactly the PDT/PST offset (7–8 h). Every
 * "X hours ago" badge on every dashboard was off.
 *
 * THIS HELPER:
 *   - Detects naive Caspio strings and resolves them as America/Los_Angeles
 *     wall-clock time, computing the correct UTC offset for that instant
 *     via Intl.DateTimeFormat (handles DST automatically).
 *   - Passes through strings that already carry an explicit timezone marker.
 *   - Returns a Date object, or null on bad input.
 *
 * USE EVERYWHERE you parse a Caspio timestamp for display. Do NOT roll your
 * own `+ 'Z'` append — it's the bug.
 */
(function (global) {
    'use strict';

    var CASPIO_SERVER_TZ = 'America/Los_Angeles';

    function parse(dateStr) {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
        if (typeof dateStr !== 'string') {
            var d = new Date(dateStr);
            return isNaN(d.getTime()) ? null : d;
        }
        var s = dateStr.trim();
        if (!s) return null;
        // Already has explicit timezone (Z or ±HH:MM / ±HHMM) — parse as-is.
        if (/(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
            var d2 = new Date(s);
            return isNaN(d2.getTime()) ? null : d2;
        }
        // Naive Caspio timestamp = Pacific wall-clock. Resolve by computing
        // the correct UTC offset for that instant.
        var probe = new Date(s + 'Z');
        if (isNaN(probe.getTime())) return null;
        try {
            var parts = new Intl.DateTimeFormat('en-US', {
                timeZone: CASPIO_SERVER_TZ,
                timeZoneName: 'longOffset'
            }).formatToParts(probe);
            var tz = parts.find(function (p) { return p.type === 'timeZoneName'; });
            var m = tz && tz.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
            if (!m) return probe;
            var sign = m[1];
            var hh = m[2].length === 1 ? '0' + m[2] : m[2];
            var mm = (m[3] || '00');
            var resolved = new Date(s + sign + hh + ':' + mm);
            return isNaN(resolved.getTime()) ? null : resolved;
        } catch (e) {
            // Intl unsupported — better to return the probe than nothing.
            return probe;
        }
    }

    function formatDateTime(dateStr, opts) {
        var d = parse(dateStr);
        if (!d) return (opts && opts.fallback) || '—';
        return d.toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    }

    function formatDate(dateStr, opts) {
        var d = parse(dateStr);
        if (!d) return (opts && opts.fallback) || '—';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    /**
     * "X ago" relative time. Returns "" for missing/invalid input so callers
     * can substitute their own placeholder.
     */
    function formatAge(dateStr) {
        var d = parse(dateStr);
        if (!d) return '';
        var diffMs = Date.now() - d.getTime();
        if (diffMs < 60000) return 'just now';
        var minutes = Math.floor(diffMs / 60000);
        if (minutes < 60) return minutes + 'm ago';
        var hours = Math.floor(diffMs / 3600000);
        if (hours < 24) return hours + 'h ago';
        var days = Math.floor(diffMs / 86400000);
        return days === 1 ? '1 day ago' : days + ' days ago';
    }

    global.CaspioDate = {
        parse: parse,
        formatDateTime: formatDateTime,
        formatDate: formatDate,
        formatAge: formatAge
    };

})(window);
