/**
 * DTG inline form — catalog-search module (Batch 5, 2026-07-09). Moved VERBATIM from the
 * dtg-inline-form.js IIFE; lexical references became the imports below.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions).
/* global */
import { updateNewArtworkVisibility } from './artwork.js';
import { applyContact, fetchCustomerHistory, populateContactPicker, renderCustomerContextBadges, renderCustomerHistoryPill } from './crm.js';
import { renderTable, updateSubmitEnabled } from './form-core.js';
import { scheduleStateSave } from './persistence.js';
import { fetchBundle, schedulePriceUpdate } from './pricing.js';
import { API_BASE, _colorsCache, _companySearchCache, _designsCacheByCustomer, _styleSearchCache, dtgIF, state } from './state.js';
import { recomputeTaxRate } from './tax-shipping.js';
import { escapeHtml, markDirty, positionPortaledMenu } from './utils.js';

// ── F2 a11y (2026-07-09): full combobox/listbox wiring for the portaled menus.
// Menus re-render per keystroke, so roles/ids are (re)stamped after each paint
// and aria-expanded/activedescendant stay truthful through open/close/hover.
let _cbxSeq = 0;
function initComboboxAria(input, label) {
    if (!input.id) input.id = `dtg-cbx-${++_cbxSeq}`;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    if (label && !input.getAttribute('aria-label')) input.setAttribute('aria-label', label);
}
function syncComboboxAria(input, menu, activeIndex) {
    const isOpen = !!menu && document.body.contains(menu);
    input.setAttribute('aria-expanded', String(isOpen));
    if (!isOpen) {
        input.removeAttribute('aria-activedescendant');
        input.removeAttribute('aria-controls');
        return;
    }
    if (!menu.id) menu.id = `${input.id}-listbox`;
    menu.setAttribute('role', 'listbox');
    input.setAttribute('aria-controls', menu.id);
    const items = menu.querySelectorAll('.dtg-combobox-item');
    items.forEach((it, i) => {
        it.setAttribute('role', 'option');
        it.id = `${menu.id}-opt-${i}`;
        it.setAttribute('aria-selected', String(i === activeIndex));
    });
    const act = items[activeIndex];
    if (act) input.setAttribute('aria-activedescendant', act.id);
    else input.removeAttribute('aria-activedescendant');
}

// Fetch SanMar inventory for a row's style+catalogColor combo via the
// shared window.OrderFormInventory module. Idempotent; results are cached
// 5 min in the inventory module itself, so calling on every input event
// is cheap. Re-renders the table when the data lands.
export async function kickInventoryFetch(row) {
    if (!row || !row.style || !row.catalogColor) return;
    if (!window.OrderFormInventory || typeof window.OrderFormInventory.getInventoryForRow !== 'function') {
        return; // graceful — script not loaded
    }
    try {
        const result = await window.OrderFormInventory.getInventoryForRow(
            row.style, row.catalogColor
        );
        // Only update if this row is still in state (rep didn't remove it
        // while the fetch was in flight).
        const current = state.rows.find(r => r.id === row.id);
        if (current) {
            current.inventory = result || { bySize: {}, status: 'unknown' };
            renderTable();
        }
    } catch (err) {
        console.warn('[dtg-inline-form] inventory fetch failed', err);
    }
}

// ----- Fetchers ----------------------------------------------------------
export async function fetchStyleSearch(q) {
    const key = q.toLowerCase();
    if (_styleSearchCache.has(key)) return _styleSearchCache.get(key);
    try {
        const r = await fetch(`${API_BASE}/api/stylesearch?term=${encodeURIComponent(q)}`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        _styleSearchCache.set(key, results);
        return results;
    } catch (err) {
        console.error('[dtg-inline-form] style search failed:', err);
        return [];
    }
}

/**
 * Find the best matching color in a SanMar color list for a free-form query.
 *
 * The bot frequently emits rep-shorthand like "black" / "navy" / "athl heather"
 * but SanMar's canonical COLOR_NAME is "Jet Black" / "True Navy" / "Athletic
 * Heather". An exact-match lookup leaves `catalogColor` empty, which breaks
 * the ShopWorks push (and the inventory badge, and the swatch image).
 *
 * Strategy (first hit wins):
 *   1. Exact case-insensitive match.
 *   2. Whole-word match (\bblack\b) → prefer shortest canonical (the "plain" one).
 *   3. Substring contains (q in name) → prefer shortest.
 *   4. Reverse contains (name in q) → prefer longest (most specific).
 *   5. null — leave it, the rep can click a swatch.
 */
export function fuzzyMatchColor(colorsList, query) {
    if (!Array.isArray(colorsList) || !colorsList.length) return null;
    const q = String(query || '').trim().toLowerCase();
    if (!q) return null;
    // Handle BOTH shapes: SanMar's /api/product-colors returns
    // { COLOR_NAME, CATALOG_COLOR, COLOR_SQUARE_IMAGE } whereas the bot's
    // lookup_product_details tool returns { name, catalogColor,
    // swatchImageUrl, mainImageUrl }. fillFromQuote uses the first
    // shape; previewStyle uses the second.
    const norm = (c) => String(c.COLOR_NAME || c.colorName || c.name || '').trim();

    // 1. exact match (case-insensitive)
    const exact = colorsList.find((c) => norm(c).toLowerCase() === q);
    if (exact) return exact;

    // 2. multi-word query: score canonical colors by how many of the query's
    //    words match. "athletic heather" against ["Athletic Heather",
    //    "Black Heather", "Dark Heather Grey"] → AH=2, BH=1, DHG=1, AH wins.
    //    Fixes a bug where rep typed "athletic heather" but the matcher
    //    picked "Black Heather" because shortest-length sort came first.
    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const queryWords = (q.match(/[a-z]+/g) || []).filter((w) => w.length >= 3);
    if (queryWords.length > 1) {
        const scored = colorsList.map((c) => {
            const name = norm(c).toLowerCase();
            let hits = 0;
            for (const w of queryWords) {
                if (new RegExp('\\b' + escapeRe(w) + '\\b').test(name)) hits++;
            }
            return { c, hits, len: name.length };
        }).filter((s) => s.hits > 0);
        if (scored.length) {
            scored.sort((a, b) => (b.hits - a.hits) || (a.len - b.len));
            return scored[0].c;
        }
    }
    // Single-word query: original whole-word match, shortest wins.
    const wordRe = new RegExp('\\b' + escapeRe(q) + '\\b', 'i');
    const wordHits = colorsList.filter((c) => wordRe.test(norm(c)));
    if (wordHits.length) {
        wordHits.sort((a, b) => norm(a).length - norm(b).length);
        return wordHits[0];
    }

    // 3. substring contains — "athl heather" finds "Athletic Heather"
    const containsHits = colorsList.filter((c) => norm(c).toLowerCase().includes(q));
    if (containsHits.length) {
        containsHits.sort((a, b) => norm(a).length - norm(b).length);
        return containsHits[0];
    }

    // 4. reverse contains — "navy blue" finds "Navy"
    const reverseHits = colorsList.filter((c) => {
        const n = norm(c).toLowerCase();
        return n && q.includes(n);
    });
    if (reverseHits.length) {
        reverseHits.sort((a, b) => norm(b).length - norm(a).length);
        return reverseHits[0];
    }

    return null;
}

export async function fetchProductColors(style) {
    const sn = String(style || '').trim().toUpperCase();
    if (!sn) return { colors: [], productTitle: '' };
    if (_colorsCache.has(sn)) return _colorsCache.get(sn);
    try {
        const r = await fetch(`${API_BASE}/api/product-colors?styleNumber=${encodeURIComponent(sn)}`);
        if (r.status === 404) {
            const empty = { colors: [], productTitle: '' };
            _colorsCache.set(sn, empty);
            return empty;
        }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        const result = {
            colors: (data && data.colors) || [],
            productTitle: (data && data.productTitle) || '',
        };
        _colorsCache.set(sn, result);
        return result;
    } catch (err) {
        console.error('[dtg-inline-form] product-colors failed:', err);
        return { colors: [], productTitle: '' };
    }
}

// Search companies with progressive fallback.
//
// The backend treats the whole query as one literal substring (LIKE
// '%full query%'), so "Archterra Landscape Company" returns 0 matches
// for "Archterra Landscape Service" because of the last word. To fix
// this client-side without a backend redeploy, we retry with shorter
// prefixes when the full search returns nothing:
//
//   "Archterra Landscape Company"  →  0 matches  →  retry...
//   "Archterra Landscape"          →  1 match    →  use this
//
// Results carry a `_searchedFor` field so the dropdown can show a
// "did you mean" hint when the rep typed something longer than what
// actually matched.
export async function fetchCompanies(q) {
    const key = q.toLowerCase();
    if (_companySearchCache.has(key)) return _companySearchCache.get(key);

    const hitApi = async (query) => {
        const r = await fetch(`${API_BASE}/api/company-contacts-2026/search?q=${encodeURIComponent(query)}&limit=10`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const data = await r.json();
        return Array.isArray(data && data.companies) ? data.companies : [];
    };

    try {
        // First attempt: exact query
        let results = await hitApi(q);
        let searchedFor = q;

        // Fallback chain: progressively drop trailing tokens until we
        // find matches OR run out of tokens.
        if (results.length === 0) {
            const tokens = q.trim().split(/\s+/).filter(Boolean);
            for (let n = tokens.length - 1; n >= 1; n--) {
                const tryQuery = tokens.slice(0, n).join(' ');
                // Don't retry queries that are too short — backend rejects
                // very short queries via sanitizeSearchQuery anyway.
                if (tryQuery.length < 2) break;
                const tryResults = await hitApi(tryQuery);
                if (tryResults.length > 0) {
                    results = tryResults;
                    searchedFor = tryQuery;
                    break;
                }
            }
        }

        // Tag the results so paint() can show a hint if we fell back
        if (searchedFor !== q && results.length > 0) {
            results._fallbackFrom = q;
            results._fallbackTo = searchedFor;
        }

        _companySearchCache.set(key, results);
        return results;
    } catch (err) {
        console.error('[dtg-inline-form] company search failed:', err);
        return [];
    }
}

export function attachStyleCombobox(wrap, input, rid) {
    let menu = null;
    let timer = null;
    let lastMatches = [];
    let activeIndex = 0;
    initComboboxAria(input, 'Product style search');
    const reposition = () => { if (menu) positionPortaledMenu(menu, input); };

    function close() {
        if (menu) {
            menu.remove();
            menu = null;
            syncComboboxAria(input, null, -1);
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        }
    }
    function open() {
        if (!menu) {
            menu = document.createElement('div');
            menu.className = 'dtg-combobox-menu';
            // Portal to body so the dropdown floats above the chat
            // panel, customer pane, live pricing card, etc.
            document.body.appendChild(menu);
            positionPortaledMenu(menu, input);
            syncComboboxAria(input, menu, activeIndex);
            window.addEventListener('scroll', reposition, true);
            window.addEventListener('resize', reposition);
        }
    }
    function paint() {
        if (!menu) return;
        if (lastMatches.length === 0) {
            // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
            menu.innerHTML = `<div class="dtg-combobox-empty">${input.value ? `No matches for "${escapeHtml(input.value)}"` : 'Type 2+ characters'}</div>`;
            positionPortaledMenu(menu, input);
            syncComboboxAria(input, menu, activeIndex);
            return;
        }
        // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
        menu.innerHTML = lastMatches.slice(0, 10).map((m, i) => `
            <div class="dtg-combobox-item${i === activeIndex ? ' active' : ''}" data-idx="${i}">
                <div class="ci-primary">${escapeHtml(m.value || m.style || m.styleNumber || m.label || '')}</div>
                <div class="ci-secondary">${escapeHtml(m.label || m.PRODUCT_TITLE || '')}</div>
            </div>
        `).join('');
        menu.querySelectorAll('.dtg-combobox-item').forEach((item) => {
            // Update active class in-place on hover (no DOM regeneration)
            // so real mouse clicks reliably hit their target. See note in
            // attachCompanyCombobox.
            item.addEventListener('mouseenter', () => {
                const newIdx = parseInt(item.getAttribute('data-idx'), 10) || 0;
                if (newIdx === activeIndex) return;
                activeIndex = newIdx;
                menu.querySelectorAll('.dtg-combobox-item').forEach((it, i) => {
                    it.classList.toggle('active', i === activeIndex);
                });
                syncComboboxAria(input, menu, activeIndex);
            });
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                pick(lastMatches[parseInt(item.getAttribute('data-idx'), 10)]);
            });
        });
        positionPortaledMenu(menu, input);
        syncComboboxAria(input, menu, activeIndex);
    }
    async function search(q) {
        if (q.length < 2) { lastMatches = []; paint(); return; }
        lastMatches = await fetchStyleSearch(q);
        activeIndex = 0;
        paint();
    }
    async function pick(m) {
        if (!m) return;
        const style = String(m.value || m.style || m.styleNumber || '').toUpperCase();
        const desc = String(m.label || m.PRODUCT_TITLE || '');
        const row = state.rows.find((r) => r.id === rid);
        if (!row) return;
        row.style = style;
        row.styleUpper = style;
        row.desc = desc;
        // Reset color when style changes
        row.color = '';
        row.catalogColor = '';
        row.colorSwatch = '';
        row.colorsAvailable = [];
        row.availableSizes = [];
        markDirty();
        scheduleStateSave();
        close();
        renderTable();
        // Asynchronously: fetch colors, fetch bundle (for live price + available sizes)
        const [colorsInfo, bundle] = await Promise.all([
            fetchProductColors(style),
            fetchBundle(style),
        ]);
        row.colorsAvailable = colorsInfo.colors || [];
        if (!row.desc && colorsInfo.productTitle) row.desc = colorsInfo.productTitle;
        if (bundle && Array.isArray(bundle.sizes)) {
            row.availableSizes = bundle.sizes
                .filter((s) => Number(s.price) > 0)
                .map((s) => String(s.size).toUpperCase());
        }
        renderTable();
        schedulePriceUpdate();
    }
    input.addEventListener('input', () => {
        open();
        clearTimeout(timer);
        timer = setTimeout(() => search(input.value.trim()), 200);
    });
    input.addEventListener('focus', () => { open(); paint(); });
    input.addEventListener('keydown', (e) => {
        if (!menu) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, lastMatches.length - 1); paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); paint(); }
        else if (e.key === 'Enter') { if (lastMatches[activeIndex]) { e.preventDefault(); pick(lastMatches[activeIndex]); } }
        else if (e.key === 'Escape') { close(); }
    });
    document.addEventListener('mousedown', (e) => {
        // Menu is portaled to body, so wrap.contains() doesn't include it.
        if (menu && !wrap.contains(e.target) && !menu.contains(e.target)) close();
    });
}

export function attachColorCombobox(wrap, input, rid) {
    const row = state.rows.find((r) => r.id === rid);
    if (!row || !row.style) return;
    let menu = null;
    let activeIndex = 0;
    initComboboxAria(input, 'Garment color search');
    let matches = row.colorsAvailable || [];
    const reposition = () => { if (menu) positionPortaledMenu(menu, input); };

    function close() {
        if (menu) {
            menu.remove();
            menu = null;
            syncComboboxAria(input, null, -1);
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        }
    }
    function open() {
        if (!menu) {
            menu = document.createElement('div');
            menu.className = 'dtg-combobox-menu';
            document.body.appendChild(menu);
            positionPortaledMenu(menu, input);
            syncComboboxAria(input, menu, activeIndex);
            window.addEventListener('scroll', reposition, true);
            window.addEventListener('resize', reposition);
        }
    }
    function filter(q) {
        const qq = q.toLowerCase().trim();
        if (!qq) { matches = row.colorsAvailable || []; }
        else matches = (row.colorsAvailable || []).filter((c) =>
            String(c.COLOR_NAME || c.colorName || '').toLowerCase().includes(qq) ||
            String(c.CATALOG_COLOR || c.catalogColor || '').toLowerCase().includes(qq)
        );
        activeIndex = 0;
        paint();
    }
    function paint() {
        if (!menu) return;
        if (matches.length === 0) {
            menu.innerHTML = `<div class="dtg-combobox-empty">No colors</div>`;
            return;
        }
        // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
        menu.innerHTML = matches.slice(0, 30).map((c, i) => {
            const name = c.COLOR_NAME || c.colorName || '';
            const cat = c.CATALOG_COLOR || c.catalogColor || '';
            const swatch = c.COLOR_SQUARE_IMAGE || c.colorSwatchUrl || '';
            return `
                <div class="dtg-combobox-item${i === activeIndex ? ' active' : ''}" data-idx="${i}">
                    <div style="display:flex;align-items:center;gap:8px;">
                        ${swatch ? `<img class="ci-swatch-mini" src="${escapeHtml(swatch)}" alt="">` : ''}
                        <div>
                            <div class="ci-primary">${escapeHtml(name)}</div>
                            ${cat ? `<div class="ci-secondary">${escapeHtml(cat)}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        menu.querySelectorAll('.dtg-combobox-item').forEach((item) => {
            // Update active class in-place on hover (no DOM regeneration).
            // See note in attachCompanyCombobox.
            item.addEventListener('mouseenter', () => {
                const newIdx = parseInt(item.getAttribute('data-idx'), 10) || 0;
                if (newIdx === activeIndex) return;
                activeIndex = newIdx;
                menu.querySelectorAll('.dtg-combobox-item').forEach((it, i) => {
                    it.classList.toggle('active', i === activeIndex);
                });
                syncComboboxAria(input, menu, activeIndex);
            });
            item.addEventListener('mousedown', (e) => { e.preventDefault(); pick(matches[parseInt(item.getAttribute('data-idx'), 10)]); });
        });
        positionPortaledMenu(menu, input);
        syncComboboxAria(input, menu, activeIndex);
    }
    function pick(c) {
        if (!c) return;
        row.color = c.COLOR_NAME || c.colorName || '';
        row.catalogColor = c.CATALOG_COLOR || c.catalogColor || '';
        row.colorSwatch = c.COLOR_SQUARE_IMAGE || c.colorSwatchUrl || '';
        markDirty();
        scheduleStateSave();
        close();
        renderTable();
        schedulePriceUpdate();
        // Kick off SanMar inventory fetch — badges appear once data lands.
        kickInventoryFetch(row);
    }
    input.addEventListener('input', () => { open(); filter(input.value); });
    input.addEventListener('focus', () => { open(); filter(input.value); });
    input.addEventListener('keydown', (e) => {
        if (!menu) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, matches.length - 1); paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); paint(); }
        else if (e.key === 'Enter') { if (matches[activeIndex]) { e.preventDefault(); pick(matches[activeIndex]); } }
        else if (e.key === 'Escape') { close(); }
    });
    document.addEventListener('mousedown', (e) => {
        if (menu && !wrap.contains(e.target) && !menu.contains(e.target)) close();
    });
}

export async function fetchDesignsForCustomer(customerId) {
    if (!customerId) return [];
    const key = String(customerId);
    if (_designsCacheByCustomer.has(key)) return _designsCacheByCustomer.get(key);
    try {
        const url = `${API_BASE}/api/dtg-designs/by-customer/${encodeURIComponent(key)}?limit=200`;
        const r = await fetch(url);
        if (!r.ok) {
            console.warn('[dtg-inline-form] DTG designs fetch failed:', r.status);
            _designsCacheByCustomer.set(key, []);
            return [];
        }
        const j = await r.json();
        const designs = Array.isArray(j.designs) ? j.designs : [];
        _designsCacheByCustomer.set(key, designs);
        return designs;
    } catch (err) {
        console.warn('[dtg-inline-form] DTG designs fetch error:', err.message);
        _designsCacheByCustomer.set(key, []);
        return [];
    }
}

// Open the design lightbox with a given image URL + caption.
// The lightbox is mounted at form-render time (see render()) and lives
// outside the .dtg-form-wrap so its position:fixed z-index isn't trapped
// by any sticky parent. Body scroll lock prevents background scrolling.
export function openDesignLightbox(src, caption) {
    const lb = document.getElementById('dtgThumbLightbox');
    const img = document.getElementById('dtgThumbLightboxImg');
    const title = document.getElementById('dtgThumbLightboxTitle');
    if (!lb || !img) return;
    img.src = src;
    img.alt = caption || 'Design preview';
    if (title) title.textContent = caption || '';
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
}

export function closeDesignLightbox() {
    const lb = document.getElementById('dtgThumbLightbox');
    const img = document.getElementById('dtgThumbLightboxImg');
    if (!lb) return;
    lb.hidden = true;
    if (img) img.removeAttribute('src');
    document.body.style.overflow = '';
}

// Update the inline thumbnail anchor next to the Design # input. Called
// whenever a design is picked, the design # is typed, or the customer
// changes. Hidden when no matching design is loaded.
export function syncDesignThumbnail() {
    const anchor = document.getElementById('dtgDesignThumbAnchor');
    const img = document.getElementById('dtgDesignThumbImg');
    if (!anchor || !img) return;

    const designNum = String(state.customer.designNumber || '').trim();
    if (!designNum || !dtgIF._designComboboxCustomerId) {
        anchor.hidden = true;
        img.removeAttribute('src');
        return;
    }
    const designs = _designsCacheByCustomer.get(String(dtgIF._designComboboxCustomerId)) || [];
    const match = designs.find((d) => d.idDesign === designNum);
    if (match && match.thumbnailUrl) {
        img.src = match.thumbnailUrl;
        img.alt = match.designName || `Design ${designNum}`;
        anchor.href = match.thumbnailUrl;
        anchor.title = `${match.designName || 'Design ' + designNum} — click to enlarge`;
        anchor.hidden = false;
    } else {
        anchor.hidden = true;
        img.removeAttribute('src');
    }
}

// F3 split (2026-07-09): the design-menu template + item wiring, moved VERBATIM
// out of attachDesignCombobox's paint(); closure state rides `cbx` and index
// changes flow back through cbx.onHover/onPick.
function paintDesignMenuItems(cbx) {
        if (cbx.filtered.length === 0) {
            if (cbx.designs.length === 0) {
                cbx.menu.innerHTML = `<div class="dtg-combobox-empty">No DTG cbx.designs on file for this customer — type a # manually or mark TBD</div>`;
            } else {
                cbx.menu.innerHTML = `<div class="dtg-combobox-empty">No cbx.designs match "${escapeHtml(cbx.q)}"</div>`;
            }
            return;
        }
        // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
        cbx.menu.innerHTML = cbx.filtered.slice(0, 30).map((d, i) => {
            const thumb = d.thumbnailUrl
                ? `<img class="dtg-design-row-thumb" src="${escapeHtml(d.thumbnailUrl)}" alt="" loading="lazy">`
                : `<div class="dtg-design-row-thumb dtg-design-row-thumb--blank"><i class="fas fa-image"></i></div>`;
            const meta = [];
            if (d.locationCount > 1) meta.push(`${d.locationCount} locations`);
            if (d.isVariation) meta.push('variation');
            if (!d.designComplete) meta.push('in progress');
            return `
                <div class="dtg-combobox-item dtg-design-row${i === cbx.activeIndex ? ' active' : ''}" data-idx="${i}">
                    ${thumb}
                    <div class="dtg-design-row-text">
                        <div class="ci-primary"><strong>${escapeHtml(d.idDesign)}</strong> — ${escapeHtml(d.designName || '(no name)')}</div>
                        <div class="ci-secondary">${meta.length ? meta.join(' · ') : (d.dateCreated || '')}</div>
                    </div>
                </div>
            `;
        }).join('');
        cbx.menu.querySelectorAll('.dtg-combobox-item').forEach((item, idx) => {
            item.addEventListener('mouseenter', () => { cbx.activeIndex = idx; cbx.onHover(idx); });
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const i = parseInt(item.getAttribute('data-idx'), 10) || 0;
                cbx.onPick(cbx.filtered[i]);
            });
        });
        // Re-position after content change — cbx.menu height varies with row count.
        positionPortaledMenu(cbx.menu, cbx.input);
        syncComboboxAria(cbx.input, cbx.menu, cbx.activeIndex);
}

// Combobox machinery for the Design # field. Opens a dropdown of the
// current customer's DTG designs (DesignType=45) on focus; clicking a
// row fills the input + shows the thumbnail inline. Mirrors the
// attachCompanyCombobox pattern below.
export function attachDesignCombobox(wrap, input) {
    let menu = null;
    let designs = [];
    let activeIndex = 0;
    initComboboxAria(input, 'Design number search');
    const reposition = () => { if (menu) positionPortaledMenu(menu, input); };

    function close() {
        if (menu) {
            menu.remove();
            menu = null;
            syncComboboxAria(input, null, -1);
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        }
    }
    function open() {
        if (!menu) {
            menu = document.createElement('div');
            menu.className = 'dtg-combobox-menu dtg-design-menu';
            // Portal to body so the menu floats ABOVE the sticky form
            // column's scroll context (matches style/color combobox pattern).
            // Without this the menu gets clipped by the form's overflow:auto.
            document.body.appendChild(menu);
            positionPortaledMenu(menu, input);
            syncComboboxAria(input, menu, activeIndex);
            window.addEventListener('scroll', reposition, true);
            window.addEventListener('resize', reposition);
        }
    }
    function filterByQuery(q) {
        const qq = q.toLowerCase().trim();
        if (!qq) return designs;
        return designs.filter((d) =>
            String(d.idDesign).toLowerCase().includes(qq) ||
            String(d.designName || '').toLowerCase().includes(qq)
        );
    }
    function paint(q) {
        if (!menu) return;
        if (!dtgIF._designComboboxCustomerId) {
            menu.innerHTML = `<div class="dtg-combobox-empty">Pick a customer first to load DTG designs</div>`;
            return;
        }
        const filtered = filterByQuery(q || '');
        paintDesignMenuItems({ menu, input, q, designs, filtered, activeIndex,
            onHover: (i) => { activeIndex = i; },
            onPick: pick });
    }
    function pick(d) {
        if (!d) return;
        input.value = d.idDesign;
        state.customer.designNumber = d.idDesign;
        markDirty();
        scheduleStateSave();
        close();
        syncDesignThumbnail();
        // Hide/show the new-artwork upload block based on whether an
        // existing design # is now set (Erik 2026-05-20).
        if (typeof updateNewArtworkVisibility === 'function') updateNewArtworkVisibility();
        updateSubmitEnabled();
    }
    async function refresh() {
        if (!dtgIF._designComboboxCustomerId) {
            designs = [];
            if (menu) paint('');
            return;
        }
        designs = await fetchDesignsForCustomer(dtgIF._designComboboxCustomerId);
        // Update placeholder based on what we found
        if (designs.length === 0) {
            input.placeholder = 'No DTG designs on file — type a # manually or mark TBD';
        } else {
            input.placeholder = `Pick from ${designs.length} DTG design${designs.length === 1 ? '' : 's'} or type a # manually`;
        }
        if (menu) paint(input.value);
        syncDesignThumbnail();
    }

    // Wire events
    input.addEventListener('focus', async () => {
        open();
        paint(input.value);
        // If we haven't loaded yet for this customer, kick a load
        if (dtgIF._designComboboxCustomerId && designs.length === 0 && !_designsCacheByCustomer.has(String(dtgIF._designComboboxCustomerId))) {
            await refresh();
        }
    });
    input.addEventListener('input', () => {
        // The rep is typing — could be filtering or entering a custom #
        state.customer.designNumber = input.value;
        markDirty();
        scheduleStateSave();
        if (menu) paint(input.value);
        syncDesignThumbnail();
        // Hide/show upload block on design # change (Erik 2026-05-20).
        if (typeof updateNewArtworkVisibility === 'function') updateNewArtworkVisibility();
        updateSubmitEnabled();
    });
    input.addEventListener('blur', () => {
        // Defer close so mousedown on a menu item still fires pick()
        setTimeout(close, 150);
    });
    input.addEventListener('keydown', (e) => {
        const filtered = filterByQuery(input.value);
        if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, filtered.length - 1); paint(input.value); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); paint(input.value); }
        else if (e.key === 'Enter') {
            if (filtered[activeIndex]) { e.preventDefault(); pick(filtered[activeIndex]); }
        } else if (e.key === 'Escape') { close(); }
    });

    // Expose a refresh hook so the company picker can trigger reload
    // when a new customer is chosen.
    wrap.__refreshDesigns = refresh;
}

// Called by attachCompanyCombobox.pick() whenever a customer is selected
// (or by previewCustomer() when a chat tool fills the customer pane).
// Re-points the design picker at the new customer and clears the input
// if the previously-typed design # doesn't belong to the new customer.
export async function refreshDesignComboboxForNewCustomer() {
    const cid = state.customer.companyId || state.customer.id;
    const newId = (cid != null && String(cid).trim() !== '') ? String(cid).trim() : null;
    if (newId === dtgIF._designComboboxCustomerId) return; // no change
    dtgIF._designComboboxCustomerId = newId;
    const wrap = document.getElementById('dtgDesignCombo');
    if (wrap && typeof wrap.__refreshDesigns === 'function') {
        await wrap.__refreshDesigns();
    }
    syncDesignThumbnail();
}

// F3 split (2026-07-09): the company-menu template + item wiring, moved VERBATIM
// out of attachCompanyCombobox's paint(); closure state rides `cbx` (in-place
// hover toggle preserved — see the 2026-05-20 real-mouse-click note inside).
function paintCompanyMenuItems(cbx) {
        if (cbx.matches.length === 0) {
            // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
            cbx.menu.innerHTML = `<div class="dtg-combobox-empty">${cbx.input.value.length >= 2 ? `No cbx.matches for "${escapeHtml(cbx.input.value)}"` : 'Type 2+ characters'}</div>`;
            positionPortaledMenu(cbx.menu, cbx.input);
            syncComboboxAria(cbx.input, cbx.menu, cbx.activeIndex);
            return;
        }
        // "Did you mean" hint — appears when the rep typed something
        // longer than what actually matched (e.g. typed "Archterra
        // Landscape Company" but only "Archterra Landscape" found hits).
        const fallbackHint = (cbx.matches._fallbackFrom && cbx.matches._fallbackTo)
            ? `<div class="dtg-combobox-hint">
                   Showing cbx.matches for <strong>"${escapeHtml(cbx.matches._fallbackTo)}"</strong>
                   — your search <em>"${escapeHtml(cbx.matches._fallbackFrom)}"</em> had no exact hits
               </div>`
            : '';
        // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
        cbx.menu.innerHTML = fallbackHint + cbx.matches.slice(0, 10).map((c, i) => {
            const loc = [c.City, c.State].filter(Boolean).join(', ');
            const contactCount = (c.contacts || []).length;
            return `
                <div class="dtg-combobox-item${i === cbx.activeIndex ? ' active' : ''}" data-idx="${i}">
                    <div class="ci-primary">${escapeHtml(c.Company_Name || '')}</div>
                    <div class="ci-secondary">${escapeHtml(loc || '—')}${contactCount > 0 ? ` · ${contactCount} contact${contactCount === 1 ? '' : 's'}` : ' · no email contacts'}</div>
                </div>
            `;
        }).join('');
        cbx.menu.querySelectorAll('.dtg-combobox-item').forEach((item) => {
            // Hover: update active class IN PLACE, don't re-render the cbx.menu.
            // (Re-rendering on every mouseenter destroys the DOM under the
            // user's cursor and intermittently kills the click — Erik's
            // real-mouse-click selection bug, 2026-05-20.)
            item.addEventListener('mouseenter', () => {
                const newIdx = parseInt(item.getAttribute('data-idx'), 10) || 0;
                if (newIdx === cbx.activeIndex) return;
                cbx.activeIndex = newIdx;
                cbx.onHover(newIdx);
                cbx.menu.querySelectorAll('.dtg-combobox-item').forEach((it, i) => {
                    it.classList.toggle('active', i === cbx.activeIndex);
                });
                syncComboboxAria(cbx.input, cbx.menu, cbx.activeIndex);
            });
            item.addEventListener('mousedown', (e) => { e.preventDefault(); cbx.onPick(cbx.matches[parseInt(item.getAttribute('data-idx'), 10)]); });
        });
        // Re-position after content change — cbx.menu height can shrink/grow.
        positionPortaledMenu(cbx.menu, cbx.input);
        syncComboboxAria(cbx.input, cbx.menu, cbx.activeIndex);
}

// F3 split (2026-07-09): company-level address capture + ship-to pre-fill,
// moved VERBATIM out of attachCompanyCombobox's pick(). `c` is the company
// record from /api/company-contacts-2026/search.
function applyCompanyAddressPrefill(c) {
    // Capture company-level address fields BEFORE applyContact runs —
    // the per-contact records from the search endpoint don't carry
    // address data, only the company bucket does. These drive both
    // billing state (info.state on push) AND the ship-to pre-fill.
    const newBillingState = (c.State || '').toString().toUpperCase().slice(0, 2);
    state.customer.state = newBillingState;
    state.customer.city = (c.City || '').toString();
    // Pre-fill ship-to from company address ONLY if rep hasn't started
    // typing one in (don't clobber an in-progress drop-ship address).
    if (!state.shipping.address1) {
        state.shipping.address1 = (c.Address || '').toString();
        state.shipping.city = (c.City || '').toString();
        state.shipping.state = newBillingState;
        state.shipping.zip = (c.Zip || '').toString();
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        setVal('dtgShipAddress1', state.shipping.address1);
        setVal('dtgShipCity', state.shipping.city);
        setVal('dtgShipState', state.shipping.state);
        setVal('dtgShipZip', state.shipping.zip);
    }
}

export function attachCompanyCombobox(wrap, input) {
    let menu = null;
    let timer = null;
    let matches = [];
    let activeIndex = 0;
    initComboboxAria(input, 'Customer company search');
    const reposition = () => { if (menu) positionPortaledMenu(menu, input); };

    function close() {
        if (menu) {
            menu.remove();
            menu = null;
            syncComboboxAria(input, null, -1);
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        }
    }
    function open() {
        if (!menu) {
            menu = document.createElement('div');
            menu.className = 'dtg-combobox-menu';
            // Portal to body — was previously appended to `wrap`, which
            // got clipped by the sticky form column's overflow:auto and
            // landed in the wrong place on screen. Matches the style/color
            // combobox pattern. Fixes the 2026-05-19 bug where the
            // customer dropdown appeared below the form panel.
            document.body.appendChild(menu);
            positionPortaledMenu(menu, input);
            syncComboboxAria(input, menu, activeIndex);
            window.addEventListener('scroll', reposition, true);
            window.addEventListener('resize', reposition);
        }
    }
    function paint() {
        if (!menu) return;
        paintCompanyMenuItems({ menu, input, matches, activeIndex,
            onHover: (i) => { activeIndex = i; },
            onPick: pick });
    }
    async function search(q) {
        if (q.length < 2) { matches = []; paint(); return; }
        matches = await fetchCompanies(q);
        activeIndex = 0;
        paint();
    }
    function pick(c) {
        if (!c) return;
        state.customer.company = c.Company_Name || '';
        state.customer.companyId = c.id_Customer != null ? String(c.id_Customer) : '';
        state.customer.contacts = c.contacts || [];
        // Curated CRM context (Erik 2026-05-23) — fields the proxy now
        // returns on /api/company-contacts-2026/search response.
        state.customer.customerWarning = String(c.Customer_Warning || '').trim();
        state.customer.isTaxExempt = c.Is_Tax_Exempt === true || c.Is_Tax_Exempt === 1 || c.Is_Tax_Exempt === '1';
        state.customer.taxExemptNumber = String(c.Tax_Exempt_Number || '').trim();
        state.customer.paymentTerms = String(
            c.Preferred_Terms_FromOrders || c.Payment_Terms || c.CustTerms || ''
        ).trim();
        state.customer.accountTier = String(c.Account_Tier || '').trim();
        renderCustomerContextBadges();
        applyCompanyAddressPrefill(c);
        input.value = c.Company_Name || '';
        // Auto-pick first emailable contact (rep can switch via the picker)
        const firstContact = (c.contacts || []).find((ct) => ct.Email || ct.ContactNumbersEmail);
        if (firstContact) {
            applyContact(firstContact);
        }
        // [2026-06-08] Re-derive tax on EVERY customer pick (not just billing-state changes): catches
        // tax-exempt customers (→ 0%) the moment they're selected + exempt↔taxable transitions, plus the
        // original out-of-state-on-pick case. recomputeTaxRate is cheap pre-ship-to (it skips the DOR lookup).
        recomputeTaxRate();

        // Fire-and-forget customer history fetch (Phase 1 info-only pill).
        // Renders in the background ~400ms later — doesn't block any
        // contact-info auto-fill above. Failure → pill stays hidden.
        if (state.customer.companyId) {
            // Show "loading" state immediately so rep knows it's coming
            const pill = document.getElementById('dtgHistoryPill');
            const summary = document.getElementById('dtgHistoryPillSummary');
            if (pill && summary) {
                pill.hidden = false;
                summary.textContent = 'Looking up past orders…';
            }
            fetchCustomerHistory(state.customer.companyId)
                .then(profile => renderCustomerHistoryPill(profile))
                .catch(() => {
                    // Defensive — hide pill if anything goes wrong
                    if (pill) pill.hidden = true;
                });
        }
        // Populate the contact dropdown so the rep can switch to a different
        // contact at this company (e.g. Aaberg's has Craig Edward / Accounting /
        // Alexx Bacon; auto-pick lands on Craig, but rep can switch to Alexx).
        populateContactPicker(c.contacts || []);
        // Reflect in companyId field if it's blank
        const cidInput = document.getElementById('dtgCompanyId');
        if (cidInput && !cidInput.value) cidInput.value = state.customer.companyId;
        markDirty();
        scheduleStateSave();
        close();
        // Re-point the Design # picker at the new customer.
        refreshDesignComboboxForNewCustomer();
        updateSubmitEnabled();
    }
    input.addEventListener('input', () => {
        open();
        clearTimeout(timer);
        timer = setTimeout(() => search(input.value.trim()), 200);
    });
    input.addEventListener('focus', () => { open(); paint(); });
    input.addEventListener('keydown', (e) => {
        if (!menu) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, matches.length - 1); paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); paint(); }
        else if (e.key === 'Enter') { if (matches[activeIndex]) { e.preventDefault(); pick(matches[activeIndex]); } }
        else if (e.key === 'Escape') { close(); }
    });
    document.addEventListener('mousedown', (e) => {
        // Menu is portaled to <body>, so wrap.contains() doesn't include it.
        // Without the !menu.contains() guard, clicking a result row triggers
        // close() before the row's own mousedown handler fires pick() —
        // visible symptom: dropdown closes but nothing gets selected.
        // Matches the existing guard pattern in attachStyleCombobox + attachColorCombobox.
        if (menu && !wrap.contains(e.target) && !menu.contains(e.target)) close();
    });
}

// ====== NEW-ARTWORK UPLOAD (Erik 2026-05-20) ===========================
// Rep can upload artwork files for orders that don't have an existing
// ShopWorks Design # yet. Files are uploaded to Caspio's artwork folder
// (POST /api/files/upload) → hosted URL flows through submit body into
// ManageOrders → ShopWorks auto-creates new design with metadata + image.
//
// Adapted from the proven 3-Day Tees pattern (pages/js/3-day-tees.js:773).
// ========================================================================
