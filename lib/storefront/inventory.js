// Storefront inventory: one cache/state owner per application instance.
module.exports = function create(ctx) {
    const { TDT_PROXY, fetch } = ctx;

    // ── Custom Tees live stock gate (2026-06-10) ────────────────────────────────
    // Confirms every requested color+size quantity against live stock AFTER the
    // authoritative reprice and BEFORE the Stripe session exists. Source is
    // RUSH-AWARE (Erik 2026-06-10): Milton local stock only matters when the
    // 3-day clock can't wait for replenishment — SanMar delivers to us next-day,
    // so STANDARD 7-10-business-day orders gate on SanMar even for PC54.
    //   PC54 + RUSH   → Milton warehouse (/api/manageorders/pc54-inventory — the
    //                   same feed the page polls; ?refresh=true busts its cache)
    //   everything else (incl. PC54 standard)
    //                 → SanMar PromoStandards (/api/sanmar/inventory/:style;
    //                   partColor IS the CATALOG_COLOR mainframe code, totalQty
    //                   already summed across warehouses; proxy caches ~5 min)
    // FAIL-OPEN by design (Erik): an inventory API hiccup logs a warning and
    // stamps stockChecked:false on the order — it NEVER blocks a sale. Only a
    // CONFIRMED shortage 409s, and confirmation always re-fetches fresh first so
    // a stale 60s cache can't turn away an order that's actually in stock.

    const CTS_STOCK_TTL_MS = 60 * 1000;

    const _ctsStockCache = new Map();

    // 'STYLE|source' → { at, value: { colors:Set, bySize:Map } }

    async function fetchJsonTimeout(url, ms) {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), ms);
        try {
            const r = await fetch(url, { signal: ctl.signal });
            if (!r.ok) throw new Error(`HTTP ${r.status} from ${url.split('?')[0]}`);
            return await r.json();
        } finally {
            clearTimeout(t);
        }
    }

    // → { colors: Set<COLOR>, bySize: Map<'COLOR|SIZE', qty> } (keys uppercased).
    // `rush` picks the source: Milton only gates PC54 RUSH orders; standard
    // orders (PC54 included) gate on SanMar — we restock from them next-day.
    async function getCtsStock(styleNumber, fresh, rush) {
        const style = String(styleNumber || '').toUpperCase();
        const useMilton = rush === true && style === 'PC54';
        const cacheKey = `${style}|${useMilton ? 'milton' : 'sanmar'}`;
        const hit = _ctsStockCache.get(cacheKey);
        if (!fresh && hit && Date.now() - hit.at < CTS_STOCK_TTL_MS) return hit.value;

        const colors = new Set();
        const bySize = new Map();
        if (useMilton) {
            const j = await fetchJsonTimeout(
                `${TDT_PROXY}/api/manageorders/pc54-inventory${fresh ? '?refresh=true' : ''}`,
                5000
            );
            Object.entries((j && j.colors) || {}).forEach(([color, c]) => {
                colors.add(color.toUpperCase());
                Object.entries((c && c.sizes) || {}).forEach(([size, qty]) => {
                    bySize.set(`${color}|${size}`.toUpperCase(), parseInt(qty, 10) || 0);
                });
            });
        } else {
            const j = await fetchJsonTimeout(
                `${TDT_PROXY}/api/sanmar/inventory/${encodeURIComponent(style)}`,
                5000
            );
            ((j && j.inventory) || []).forEach((p) => {
                if (!p || !p.color || !p.size) return;
                const key = `${p.color}|${p.size}`.toUpperCase();
                colors.add(String(p.color).toUpperCase());
                bySize.set(key, (bySize.get(key) || 0) + (parseInt(p.totalQty, 10) || 0));
            });
        }
        if (!bySize.size) throw new Error(`stock feed returned no rows for ${style}`);
        const value = { colors, bySize };
        _ctsStockCache.set(cacheKey, { at: Date.now(), value });
        return value;
    }

    // Server-sanitized cleanConfigs vs a stock snapshot → [{catalogColor,
    // displayColor, size, want, have}]. A color the feed doesn't name at all is
    // skipped (fail-open — a naming mismatch must never read as "sold out").
    function ctsStockConflicts(cleanConfigs, stock) {
        const conflicts = [];
        Object.values(cleanConfigs || {}).forEach((c) => {
            const colorKey = String(c.catalogColor).toUpperCase();
            if (!stock.colors.has(colorKey)) return;
            Object.entries(c.sizeBreakdown || {}).forEach(([size, sd]) => {
                const want = sd.quantity;
                const have = stock.bySize.get(`${colorKey}|${size.toUpperCase()}`) || 0;
                if (want > have) {
                    conflicts.push({
                        catalogColor: c.catalogColor,
                        displayColor: c.displayColor,
                        size,
                        want,
                        have,
                    });
                }
            });
        });
        return conflicts;
    }

    // Caps stock conflicts — C402 lesson (2026-06-11): SanMar cap inventory
    // carries STALE SIZED partIds (e.g. style 112 returns 5 'XL' + 5 'SM' rows
    // at 0 qty next to the real OSFA rows), so per-size comparison would read a
    // fully-stocked color as sold out. Aggregate live qty by CATALOG_COLOR and
    // compare against the color's total wanted quantity. A color the feed
    // doesn't name at all is skipped (fail-open — naming mismatch must never
    // read as "sold out"), same as ctsStockConflicts.
    function capsStockConflicts(cleanConfigs, stock) {
        const byColor = new Map();
        stock.bySize.forEach((qty, key) => {
            const color = key.slice(0, key.lastIndexOf('|'));
            byColor.set(color, (byColor.get(color) || 0) + qty);
        });
        const conflicts = [];
        Object.values(cleanConfigs || {}).forEach((c) => {
            const colorKey = String(c.catalogColor).toUpperCase();
            if (!stock.colors.has(colorKey)) return;
            let want = 0;
            Object.values(c.sizeBreakdown || {}).forEach((sd) => {
                want += (sd && sd.quantity) || 0;
            });
            const have = byColor.get(colorKey) || 0;
            if (want > have) {
                conflicts.push({
                    catalogColor: c.catalogColor,
                    displayColor: c.displayColor,
                    size: 'OSFA',
                    want,
                    have,
                });
            }
        });
        return conflicts;
    }

    return { capsStockConflicts, ctsStockConflicts, getCtsStock };
};
