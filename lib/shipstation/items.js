// One metadata cache per registered ShipStation service; never re-created per request.
module.exports = function createItems({ CASPIO_PROXY_BASE, fetch }) {
    /**
     * Look up product metadata from SanMar bulk catalog — image URL + per-piece
     * weight in ounces. Used by the ShipStation push to enrich line items.
     *
     * SanMar's PIECE_WEIGHT field is in POUNDS per piece (e.g. 1.48 for PC90H
     * hoodie). We convert to ounces here so the consumer just multiplies by qty.
     *
     * Returns { imageUrl, weightOz } — either may be null if the lookup fails
     * or the field isn't populated. Caller falls back to defaults.
     *
     * Module-level cache (TTL 24h) keeps repeat lookups for the same style+color
     * fast and reduces proxy load. NWCA has ~200 active SKUs; cache stays small.
     */
    const PRODUCT_META_CACHE = new Map();
    const PRODUCT_META_TTL_MS = 24 * 60 * 60 * 1000;

    async function lookupProductMeta(styleNumber, color) {
        if (!styleNumber) return { imageUrl: null, weightOz: null };
        const key = `${styleNumber}|${color || ''}`.toLowerCase();
        const cached = PRODUCT_META_CACHE.get(key);
        if (cached && Date.now() < cached.expiresAt) {
            return { imageUrl: cached.imageUrl, weightOz: cached.weightOz };
        }

        try {
            const PROXY = CASPIO_PROXY_BASE;
            const url = `${PROXY}/api/inventory?styleNumber=${encodeURIComponent(styleNumber)}&color=${encodeURIComponent(color || '')}`;
            const resp = await fetch(url);
            if (!resp.ok) {
                PRODUCT_META_CACHE.set(key, {
                    imageUrl: null,
                    weightOz: null,
                    expiresAt: Date.now() + 60_000,
                });
                return { imageUrl: null, weightOz: null };
            }
            const data = await resp.json();
            const first = Array.isArray(data) && data.length > 0 ? data[0] : null;
            if (!first) {
                PRODUCT_META_CACHE.set(key, {
                    imageUrl: null,
                    weightOz: null,
                    expiresAt: Date.now() + 60_000,
                });
                return { imageUrl: null, weightOz: null };
            }
            // Image: prefer color-specific model shot for visual confirmation
            const imageUrl =
                first.COLOR_PRODUCT_IMAGE || first.PRODUCT_IMAGE || first.THUMBNAIL_IMAGE || null;
            // Weight: PIECE_WEIGHT is SanMar's pounds-per-piece field. Convert to oz.
            // Sanity: bound between 0 and 200 oz (12.5 lbs — heaviest garment we'd ship)
            // to catch bad data without crashing.
            const lbs = Number(first.PIECE_WEIGHT);
            const weightOz = Number.isFinite(lbs) && lbs > 0 && lbs < 12.5 ? lbs * 16 : null;

            PRODUCT_META_CACHE.set(key, {
                imageUrl,
                weightOz,
                expiresAt: Date.now() + PRODUCT_META_TTL_MS,
            });
            return { imageUrl, weightOz };
        } catch (e) {
            console.warn(`[lookupProductMeta] failed for ${styleNumber}/${color}:`, e.message);
            return { imageUrl: null, weightOz: null };
        }
    }

    /**
     * Build the ShipStation items[] array from snapshot.lineItems[] (post-import)
     * or originalSubmission.rows[] (pre-import).
     *
     * Collapses size-suffixed SKUs back into one product per (PartNumber+Color),
     * with a "Sizes: S:1, M:1, L:1, XL:1, 2XL:2..." string in options[]. Also
     * enriches each item with imageUrl (color-specific garment shot) so the
     * warehouse picker visually verifies the right product.
     *
     * This is the server-side mirror of the client-side groupLineItemsByBaseSku
     * in pages/js/invoice.js — keeps the ShipStation order looking like 3 logical
     * products instead of 8 size-suffix line items.
     */
    async function buildShipStationItems(lineItems, originalSubmission) {
        const out = [];
        const SUFFIX_RE = /_([0-9]+XL?|XS|XXS|YXS|YS|YM|YL|YXL)$/i;

        // Prefer ShopWorks lineItems if present (post-import). They're authoritative.
        if (Array.isArray(lineItems) && lineItems.length > 0) {
            const byBase = new Map(); // baseStyle|color → { name, qty, sizes:[], unitPrice, base }
            lineItems.forEach((li) => {
                const style = String(li.PartNumber || '').trim();
                const m = style.match(SUFFIX_RE);
                const baseStyle = m ? style.slice(0, m.index) : style;
                const color = String(li.PartColor || '').trim();
                const key = baseStyle + '|' + color;

                const qty = Number(li.LineQuantity) || 0;
                const unitPrice = Number(li.LineUnitPrice) || 0;
                const sizeLabel = m
                    ? m[1].toUpperCase().replace(/^([2-6]X)$/, '$1L')
                    : (function () {
                          // Base SKU — read Size01-06 columns
                          const labels = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
                          const sizes = [];
                          for (let i = 1; i <= 6; i++) {
                              const q = Number(li['Size0' + i]);
                              if (q > 0) sizes.push(`${labels[i - 1]}:${q}`);
                          }
                          return sizes.join(', ') || 'OSFA';
                      })();

                if (!byBase.has(key)) {
                    byBase.set(key, {
                        sku: baseStyle,
                        name: li.PartDescription || baseStyle,
                        color,
                        qty: 0,
                        unitPrice, // first-seen price; weighted-average could be computed but blended is fine for SS
                        sizeChunks: [],
                    });
                }
                const bucket = byBase.get(key);
                bucket.qty += qty;
                bucket.sizeChunks.push(sizeLabel + (m ? `:${qty}` : ''));
            });
            for (const v of byBase.values()) {
                out.push({
                    sku: v.sku,
                    name: v.name,
                    quantity: v.qty,
                    unitPrice: v.unitPrice,
                    options: [
                        v.color ? { name: 'Color', value: v.color } : null,
                        v.sizeChunks.length
                            ? { name: 'Sizes', value: v.sizeChunks.join(', ') }
                            : null,
                    ].filter(Boolean),
                    _colorForImage: v.color, // internal — stripped after image lookup
                });
            }
        } else {
            // Fallback — originalSubmission rows (pre-import orders).
            const rows = originalSubmission?.rows || [];
            rows.forEach((r) => {
                const sizes = r.sizes || {};
                const totalQty =
                    Object.values(sizes).reduce((s, n) => s + (Number(n) || 0), 0) ||
                    Number(r.qty) ||
                    0;
                if (!totalQty) return;
                const sizeChunks = Object.keys(sizes)
                    .filter((k) => Number(sizes[k]) > 0)
                    .map((k) => `${k.toUpperCase()}:${sizes[k]}`);
                const color = r.color || r.colorName || '';
                // For image lookup we want CATALOG_COLOR (e.g. "BrillOrng") when set,
                // since that's what the inventory endpoint expects. Fall back to
                // display color name if catalogColor isn't on the row.
                const catalogColor = r.catalogColor || color;
                out.push({
                    sku: r.style || r.styleNumber || 'MISC',
                    name: r.desc || r.description || r.style || 'Custom item',
                    quantity: totalQty,
                    unitPrice: Number(r.unitPrice) || Number(r.price) || 0,
                    options: [
                        color ? { name: 'Color', value: color } : null,
                        sizeChunks.length ? { name: 'Sizes', value: sizeChunks.join(', ') } : null,
                    ].filter(Boolean),
                    _colorForImage: catalogColor,
                });
            });
        }

        // Enrich every item with product metadata (image URL + per-piece weight)
        // from SanMar bulk catalog. Done in parallel. Warehouse pickers see the
        // actual garment in ShipStation's order view; payload includes accurate
        // weight from SanMar's authoritative PIECE_WEIGHT field. Best-effort —
        // missing fields don't block the push (the caller has a fallback weight
        // table for SKUs SanMar doesn't recognize).
        await Promise.all(
            out.map(async (item) => {
                const meta = await lookupProductMeta(item.sku, item._colorForImage);
                if (meta.imageUrl) item.imageUrl = meta.imageUrl;
                if (meta.weightOz) item._weightPerPieceOz = meta.weightOz; // consumed by caller, stripped before send
                delete item._colorForImage;
            })
        );

        return out;
    }

    return { buildShipStationItems };
};
