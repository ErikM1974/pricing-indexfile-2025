/* =====================================================
   QUOTE MANAGEMENT DASHBOARD -- page logic
   Extracted from an inline <script> in quote-management.html
   (Rule 3: no inline code) on 2026-07-05. Loaded at end of
   <body>, after staff-auth-helper, caspio-date-utils,
   app.config and sanmar-inbound-today -- same order as before.
   ===================================================== */
// ============================================================
// QUOTE MANAGEMENT DASHBOARD
// Created: 2026-01-13 (Phase 5 - Quote builder feature parity)
// ============================================================

// Never-Break Rule #6 — proxy URL comes from APP_CONFIG, not a hardcode.
// Guarded fallback keeps the dashboard working if app.config.js fails to load.
const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
    || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

// State
let allQuotes = [];
// Inbound SanMar shipment status per work order (woId → {state,shipped,po,...}
// or null once fetched-but-no-PO). Populated by one batched call after load.
const inboundStatusMap = new Map();
let filteredQuotes = [];          // tab-filtered set rendered in the table
let baseFilteredQuotes = [];      // status/date/search-filtered, PRE-tab — stats + tab counts read this so they stay stable across tabs
let currentPage = 1;
const ITEMS_PER_PAGE = 25;
let currentUserEmail = null;
// Active / Completed / All tab (Erik 2026-06-15). "Completed" = fully
// shipped + invoiced + paid in ShopWorks (derived from the snapshot).
let currentTab = 'active';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async function() {
    console.log('[QuoteManagement] Initializing...');

    // Get logged-in user info
    initUserDisplay();

    // Establish the Express session (httpOnly cookie) so the server-side
    // delete gate can identify this user. The dashboard login already
    // authenticated via Caspio (sessionStorage); this mirrors what
    // staff-login.html does. Best-effort + awaited so the cookie is set
    // before any delete; the page works regardless.
    await establishCrmSession();

    // Load quotes
    await loadQuotes();

    // Setup event listeners
    setupEventListeners();

    console.log('[QuoteManagement] Ready');
});

function initUserDisplay() {
    const userDisplay = document.getElementById('user-display');

    if (typeof StaffAuthHelper !== 'undefined' && StaffAuthHelper.isLoggedIn()) {
        const name = StaffAuthHelper.getLoggedInStaffName();
        currentUserEmail = StaffAuthHelper.getLoggedInStaffEmail();
        userDisplay.textContent = name || 'Staff User';
    } else {
        // Try sessionStorage directly
        const name = sessionStorage.getItem('nwca_user_name');
        currentUserEmail = sessionStorage.getItem('nwca_user_email');
        userDisplay.textContent = name || 'Guest';
    }
}

// Establish the server session used for server-side delete enforcement.
// Same POST staff-login.html makes; idempotent. Non-CRM staff get a 403
// (they just can't delete) — logged, never fatal. Identity is the
// already-Caspio-authenticated sessionStorage name/email.
async function establishCrmSession() {
    const name = (typeof StaffAuthHelper !== 'undefined' && StaffAuthHelper.getLoggedInStaffName())
        || sessionStorage.getItem('nwca_user_name');
    const email = currentUserEmail || sessionStorage.getItem('nwca_user_email') || '';
    if (!name) return; // not logged in — nothing to establish
    try {
        const resp = await fetch('/api/crm-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ name, email }),
        });
        if (resp.ok) {
            console.log('[QuoteManagement] CRM session established for', name);
        } else {
            console.warn(`[QuoteManagement] CRM session not established (HTTP ${resp.status}) — server-side delete will require it`);
        }
    } catch (e) {
        console.warn('[QuoteManagement] CRM session establish failed:', e.message);
    }
}

function setupEventListeners() {
    const searchEl = document.getElementById('filter-search');
    // Enter key triggers the search.
    searchEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            applyFilters();
        }
    });
    // Clearing the field (empty value) re-applies so results reset without
    // needing to click Search again.
    searchEl.addEventListener('input', function(e) {
        if (e.target.value.trim() === '') {
            applyFilters();
        }
    });
}

async function loadQuotes() {
    showLoading(true);

    try {
        // Fetch quotes from API
        const response = await fetch(`${API_BASE}/api/quote_sessions`);
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        allQuotes = data.Result || data || [];

        console.log(`[QuoteManagement] Loaded ${allQuotes.length} quotes`);

        // Apply initial filters
        applyFilters();

        // One batched SanMar inbound-status lookup for all loaded WOs
        // (fire-and-forget; re-renders the table when it returns).
        fetchInboundStatuses();

    } catch (error) {
        console.error('[QuoteManagement] Error loading quotes:', error);
        showError('Failed to load quotes. Please try refreshing.');
    }
}

// On-demand ShopWorks reconciliation (Erik 2026-06-15).
// Calls the SAME endpoint the hourly Heroku Scheduler cron drives
// (caspio-pricing-proxy/scripts/sync-quote-sessions-from-shopworks.js
// → POST /api/quote-sessions/bulk-sync-from-shopworks). For every
// Processed/pushed quote in the window it re-pulls ManageOrders state
// and writes back ShopWorks order #, status, production milestones, and
// the salesperson (order.CustomerServiceRep). Exposed as a button so
// staff can refresh on demand — and so the dashboard is not blind if the
// scheduler is paused. Same-origin relative URL → the pricing-index app
// (NOT the proxy), which owns these sync endpoints.
async function syncFromShopWorks() {
    const btn = document.getElementById('btn-sync-sw');
    if (!btn || btn.disabled) return;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Syncing…';
    try {
        const resp = await fetch('/api/quote-sessions/bulk-sync-from-shopworks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // olderThanMin:5 is the endpoint floor — forces a refresh of
            // anything not synced in the last 5 min. daysBack:90 covers
            // the widest dashboard date filter. full:true bypasses the
            // hourly cron's age-based backoff so the manual button always
            // syncs the whole window (and runs the purge pass).
            body: JSON.stringify({ daysBack: 90, olderThanMin: 5, full: true }),
        });
        const result = await resp.json().catch(() => ({}));
        if (!resp.ok || !result.success) {
            throw new Error(result.error || `HTTP ${resp.status}`);
        }
        showToast(`✓ ShopWorks sync: ${result.imported || 0} imported · ${result.pending || 0} pending · ${result.deleted || 0} cancelled · ${result.errors || 0} errors`);
        // Reload so order #, status, progress, and salesperson reflect the
        // freshly-written ShopWorks_* columns.
        await loadQuotes();
    } catch (err) {
        // Erik's #1 rule — surface the failure, never fail silently.
        console.error('[QuoteManagement] syncFromShopWorks failed:', err);
        alert(`ShopWorks sync failed:\n${err.message}\n\nIf this keeps happening, check the pricing-index app logs (the same reconciliation also runs hourly via the caspio-pricing-proxy scheduler).`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

// Manual on-demand inbound refresh (Erik 2026-06-16). The Inbound dot
// normally reads the once-a-day SYNCED SanMar status (batch-status), which
// lags a same-day shipment because SanMar's order-status feed and its
// shipment feed are different services. This button asks the LIVE shipment
// feed directly (the same source the /quote page uses) for the visible
// orders that aren't already showing Shipped, and updates their dot +
// tracking on the spot. Bounded (≤25 POs, 4 concurrent) so it stays fast;
// a live read only — it doesn't write the synced table, so it reflects the
// truth the moment you ask rather than waiting for the daily sync.
// Manual on-demand inbound refresh (Erik 2026-06-16). Triggers the proxy's
// bounded catch-up via a SAME-ORIGIN pricing-index endpoint (which holds the
// CRM secret the browser doesn't): it pulls the live SanMar shipment feed for
// recent open orders and PERSISTS any tracking into the synced table. We then
// re-pull inbound status with refresh=true, so the dots show the now-persisted
// "Shipped" + tracking — and, unlike a display-only refresh, it STICKS across
// page reloads (the synced batch-status is the source on every load).
async function refreshInboundLive() {
    const btn = document.getElementById('btn-refresh-inbound');
    if (!btn || btn.disabled) return;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-dolly fa-spin"></i> Refreshing…';
    try {
        // 1. Ingest orders that fell BETWEEN scheduled syncs (Erik 2026-06-26):
        //    ones that raced placed→shipped→Complete in one hop, so the daily
        //    allOpen/lastUpdate passes never saw them — absent from the synced
        //    table entirely (no PO, no tracking anywhere). The catch-up runs ASYNC
        //    on the server (invoice + lastUpdate discovery + per-PO SOAP would trip
        //    Heroku's 30s limit synchronously), so we kick it off (202) then POLL
        //    its status here. Non-fatal: any hiccup just skips to the shipment pull.
        let ingested = 0, ingestErr = null;
        try {
            const kick = await fetch('/api/sanmar-orders/sync-recent-completed', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days: 7 }),
            });
            const kres = await kick.json().catch(() => ({}));
            if (!kick.ok || !kres.success) throw new Error(kres.error || `HTTP ${kick.status}`);
            // Poll until the background job finishes (client-side, so no 30s limit) —
            // ~30s cap; if still running we proceed and it keeps ingesting server-side.
            for (let i = 0; i < 12; i++) {
                await new Promise(r => setTimeout(r, 2500));
                const s = await fetch('/api/sanmar-orders/sync-recent-completed-status').then(r => r.json()).catch(() => ({}));
                if (s && s.success && !s.running) {
                    const lr = s.lastResult || {};
                    if (lr.error) ingestErr = lr.error; else ingested = lr.ingested || 0;
                    break;
                }
                if (s && s.progress) btn.innerHTML = `<i class="fas fa-dolly fa-spin"></i> Ingesting ${s.progress.ingested || 0}/${s.progress.pending || '…'}…`;
            }
        } catch (e) { ingestErr = e.message; }

        // 2. Pull live tracking for in-table open orders (original behavior).
        btn.innerHTML = '<i class="fas fa-dolly fa-spin"></i> Refreshing…';
        const resp = await fetch('/api/sanmar-orders/sync-shipments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: 15 }),
        });
        const result = await resp.json().catch(() => ({}));
        if (!resp.ok || !result.success) throw new Error(result.error || `HTTP ${resp.status}`);
        await fetchInboundStatuses({ force: true }); // re-pull, bypassing the status cache
        const added = result.shipmentsAdded || 0;
        showToast(`✓ Inbound synced from SanMar: ${ingested} new order(s) ingested, +${added} now Shipped${result.remaining ? ` — ${result.remaining} still pending, click again` : ''}.${ingestErr ? ` [catch-up: ${ingestErr}]` : ''}`);
    } catch (err) {
        // Erik's #1 rule — surface the failure, never fail silently.
        console.error('[QuoteManagement] refreshInboundLive failed:', err);
        alert(`Inbound refresh failed:\n${err.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

function applyFilters() {
    // Get filter values
    const statusFilter = document.getElementById('filter-status').value;
    const dateFilter = document.getElementById('filter-date').value;
    const searchFilter = document.getElementById('filter-search').value.toLowerCase().trim();

    // Calculate date cutoff
    let dateCutoff = null;
    if (dateFilter !== 'all') {
        dateCutoff = new Date();
        dateCutoff.setDate(dateCutoff.getDate() - parseInt(dateFilter));
    }

    // Base set = status + date + search (PRE-tab). Stats and the tab
    // counts read this so they stay stable no matter which tab is open.
    baseFilteredQuotes = allQuotes.filter(quote => {
        // Status filter
        if (statusFilter && quote.Status !== statusFilter) {
            return false;
        }

        // Date filter
        if (dateCutoff) {
            const createdDate = new Date(quote.CreatedAt);
            if (createdDate < dateCutoff) {
                return false;
            }
        }

        // Search filter
        if (searchFilter) {
            const searchFields = [
                quote.QuoteID || '',
                quote.CustomerName || '',
                quote.CustomerEmail || '',
                quote.CompanyName || ''
            ].join(' ').toLowerCase();

            if (!searchFields.includes(searchFilter)) {
                return false;
            }
        }

        return true;
    });

    // Stats + tab counts from the pre-tab base.
    updateStats();
    updateTabCounts();

    // Apply the Active/Completed/All tab to get the rendered set.
    filteredQuotes = baseFilteredQuotes.filter(quote => {
        if (currentTab === 'completed') return isCompletedQuote(quote);
        if (currentTab === 'active') return !isCompletedQuote(quote);
        return true; // 'all'
    });

    // Sort by created date (newest first)
    filteredQuotes.sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));

    // Reset to first page
    currentPage = 1;

    // Render table
    renderTable();
}

// Counts shown on the tabs, from the pre-tab base set.
function updateTabCounts() {
    const completed = baseFilteredQuotes.filter(isCompletedQuote).length;
    const all = baseFilteredQuotes.length;
    const active = all - completed;
    const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = `(${n})`; };
    set('tab-count-active', active);
    set('tab-count-completed', completed);
    set('tab-count-all', all);
}

// Tab switch. Active defaults to the last-30-days window; Completed/All
// widen to All Time so finished orders don't fall out of view (the date
// dropdown updates visibly so it's not hidden magic).
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.qm-tab').forEach(btn => {
        btn.classList.toggle('qm-tab--active', btn.dataset.tab === tab);
    });
    const dateEl = document.getElementById('filter-date');
    if (dateEl) dateEl.value = (tab === 'active') ? '30' : 'all';
    applyFilters();
}

// Get the "effective" amount for a quote: SW cur_TotalInvoice when
// the snapshot has it, else fall back to the quote-contract TotalAmount.
// Used in both row render and stats sum so dashboard amounts mirror
// ShopWorks just like the quote-view and invoice pages do. (Erik
// 2026-05-22 — full SW-as-source-of-truth consistency.)
//
// 2026-05-28: explicit null/undefined check before Number() — without
// it, Number(null) === 0 made unsynced rows render as $0.00 instead
// of falling back to the original quote total.
function getEffectiveAmount(quote) {
    // Only overlay for Processed quotes with a synced snapshot.
    if (quote.Status === 'Processed' && quote.ShopWorks_Snapshot) {
        try {
            const snap = JSON.parse(quote.ShopWorks_Snapshot);
            const raw = snap?.order?.cur_TotalInvoice;
            if (raw != null && raw !== '') {
                const swTotal = Number(raw);
                if (Number.isFinite(swTotal)) return swTotal;
            }
        } catch (_) { /* fall through to quote total */ }
    }
    // TotalAmount is the PRE-TAX subtotal (storefront orders since
    // 2026-06-12; builders always). Add TaxAmount for the grand total so
    // the Amount column shows the all-in figure pre-ShopWorks-sync. Old
    // rows have TaxAmount 0/null → (TotalAmount + 0) is unchanged.
    return (parseFloat(quote.TotalAmount) || 0) + (parseFloat(quote.TaxAmount) || 0);
}

// 5-milestone workflow progress for the Progress column (Erik
// 2026-05-28). Mirrors the same milestones shown on the quote
// detail page so staff can scan the dashboard and see where
// each order is. Data comes from the SW snapshot order.sts_*
// fields; rows without a snapshot show a single em-dash placeholder.
// "Purchase Received" is a composite AND of sts_Purchased and
// sts_Received (received implies purchased, but AND-ing guards
// against ShopWorks data inconsistency).
const MILESTONE_ICONS = [
    { label: 'Purchase Received', icon: 'fa-box',           fields: ['sts_Purchased', 'sts_Received'] },
    { label: 'Produced',          icon: 'fa-cog',           fields: ['sts_Produced'] },
    { label: 'Shipped',           icon: 'fa-truck',         fields: ['sts_Shipped'] },
    { label: 'Invoiced',          icon: 'fa-file-invoice',  fields: ['sts_Invoiced'] },
    { label: 'Paid',              icon: 'fa-dollar-sign',   fields: ['sts_Paid'] },
];

function isStatusYes(raw) {
    if (raw == null || raw === '') return false;
    const s = String(raw).trim().toLowerCase();
    if (s === 'yes' || s === 'y' || s === 'true' || s === '1') return true;
    const n = Number(raw);
    return !Number.isNaN(n) && n > 0;
}

// ── ShopWorks status mapping (Erik 2026-06-16) ────────────────────────
// Mirror the OnSite order screen EXACTLY. Per
// memory/MANAGEORDERS_CRM_CAPABILITY_REFERENCE.md the codes are
// 0=No, 1=Yes, .5=Partial, 8=N/A, 222=N/A. ShopWorks shows Yes / No / n/a
// per milestone (a Customer Pickup order reads Ship: n/a, Prod: n/a), so the
// pill mirrors that state — never a forced Yes/No. KEEP IN SYNC with
// pages/js/quote-view.js _mapSwStatus / _combineSwStatus.
function mapSwStatus(raw) {
    if (raw == null || String(raw).trim() === '') return { state: 'unknown', label: '—' };
    const s = String(raw).trim().toLowerCase();
    if (s === '1' || s === 'yes' || s === 'y' || s === 'true')  return { state: 'yes',     label: 'Yes' };
    if (s === '0' || s === 'no'  || s === 'n' || s === 'false') return { state: 'no',      label: 'No' };
    if (s === '.5' || s === '0.5' || s === 'partial')           return { state: 'partial', label: 'Partial' };
    if (s === '8' || s === '222' || s === 'n/a' || s === 'na')  return { state: 'na',      label: 'n/a' };
    return { state: 'na', label: 'n/a' };
}
function combineSwStatus(parts) {
    const states = parts.map(p => p.state);
    if (states.includes('no'))          return { state: 'no',      label: 'No' };
    if (states.includes('partial'))     return { state: 'partial', label: 'Partial' };
    if (states.every(s => s === 'yes')) return { state: 'yes',     label: 'Yes' };
    if (states.includes('na'))          return { state: 'na',      label: 'n/a' };
    return { state: 'unknown', label: '—' };
}

// A quote is COMPLETED when its ShopWorks order is shipped + invoiced +
// paid (Erik 2026-06-15). Mirrors ShopWorks states (Erik 2026-06-16): a
// Customer Pickup order has Ship=n/a, which must NOT block completion — so
// "shipped" counts as satisfied when its state is Yes OR n/a. Anything
// without a snapshot (open/unsynced) is NOT completed → stays in Active.
// Memoized ShopWorks_Snapshot parse (2026-07-04): six per-row helpers each
// JSON.parse'd the same multi-KB snapshot on every render. Parse once, cache
// on the row object (quote.__snap), and every helper reads the cache. Returns
// {} on missing/malformed so callers can read .order without re-guarding.
function snapOf(quote) {
    if (!quote) return {};
    return quote.__snap ??= (() => {
        try { return quote.ShopWorks_Snapshot ? (JSON.parse(quote.ShopWorks_Snapshot) || {}) : {}; }
        catch (e) { return {}; }
    })();
}

function isCompletedQuote(quote) {
    if (!quote || !quote.ShopWorks_Snapshot) return false;
    const order = snapOf(quote).order || {};
    // Paid=n/a must ALSO not block: a $0 order (e.g. OF-0049/50/51) shows
    // Paid=n/a but is fully shipped+invoiced → it's done. Invoiced stays a
    // strict Yes (the financial close) so an all-n/a order can't falsely
    // complete. (Erik 2026-06-16)
    const ship = mapSwStatus(order.sts_Shipped).state;
    const paid = mapSwStatus(order.sts_Paid).state;
    return (ship === 'yes' || ship === 'na')
        && mapSwStatus(order.sts_Invoiced).state === 'yes'
        && (paid === 'yes' || paid === 'na');
}

// ── Inbound vendor (SanMar) shipment indicator (2026-06-15) ──
// The work order # for a quote (ShopWorks_Order_Number, or the snapshot's
// id_Order fallback). Null for quotes not yet in ShopWorks.
function getWoId(quote) {
    let wo = Number(quote.ShopWorks_Order_Number) || 0;
    if (!wo && quote.ShopWorks_Snapshot) {
        wo = Number(snapOf(quote)?.order?.id_Order) || 0;
    }
    return wo || null;
}

// ShopWorks order-number cross-check on the row (Erik 2026-06-25). Once an
// order is imported into ShopWorks it has a WO/order number (== ShopWorks
// order #, e.g. WO #142292), which the quote-detail page shows. Surface that
// same number on the LIST row, under the Quote ID, so staff can confirm an
// order landed in ShopWorks without drilling in. Status-independent: the
// "In ShopWorks #NNNNN" status badge only renders for Processed rows, so an
// Accepted/Open quote that's already in ShopWorks (e.g. a DTG storefront
// order) would otherwise never show its #. Hidden until a number exists.
function renderShopWorksRef(quote) {
    const wo = getWoId(quote);
    if (!wo) return '';
    return `<div class="sw-ref" title="In ShopWorks — order #${wo}"><i class="fas fa-check-circle"></i> SW #${wo}</div>`;
}

// Online deposit chip (Storefront Checkout Phase 1, 2026-07-05). Reads the
// deposit terms block + payments[] the server keeps in the quote's Notes JSON
// (written by enable-deposit + the Stripe webhook). Returns '' for quotes with
// no deposit activity — the vast majority — so the status column stays clean.
function renderDepositChip(quote) {
    if (!quote || !quote.Notes) return '';
    let notes;
    try { notes = JSON.parse(quote.Notes); } catch (_) { return ''; }
    if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return '';
    const payments = Array.isArray(notes.payments) ? notes.payments : [];
    const dep = notes.deposit;
    const depositPaid = payments.find(p => p && p.kind === 'deposit');
    const balancePaid = payments.find(p => p && p.kind === 'balance');
    const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;
    if (balancePaid) {
        return `<span class="status-badge deposit-chip deposit-chip--paid" title="Paid in full online via Stripe (deposit + balance).">
                    <i class="fas fa-dollar-sign"></i> Paid in full
                </span>`;
    }
    if (depositPaid) {
        // DEPOSIT-PCT=100 → zero balance = paid in full (Erik 2026-07-05).
        if (dep && Number(dep.balanceAmount) === 0) {
            return `<span class="status-badge deposit-chip deposit-chip--paid" title="Paid in full online via Stripe — ${usd(depositPaid.amount)}.">
                        <i class="fas fa-dollar-sign"></i> Paid in full
                    </span>`;
        }
        const bal = dep && isFinite(Number(dep.balanceAmount)) ? ` · bal ${usd(dep.balanceAmount)}` : '';
        return `<span class="status-badge deposit-chip deposit-chip--paid" title="Deposit paid online via Stripe — ${usd(depositPaid.amount)}${dep ? ` of ${usd(dep.grandTotal)}` : ''}. Balance due after proof approval.">
                    <i class="fas fa-dollar-sign"></i> Deposit paid${bal}
                </span>`;
    }
    if (dep && dep.enabled) {
        const label = Number(dep.depositPct) >= 100 ? 'Payment link live' : 'Deposit link live';
        return `<span class="status-badge deposit-chip deposit-chip--live" title="Pay link is live on the quote page — ${usd(dep.depositAmount)}${Number(dep.depositPct) >= 100 ? ' (full order total)' : ` (${Number(dep.depositPct) || 0}% of ${usd(dep.grandTotal)})`}. Waiting on the customer.">
                    <i class="fas fa-link"></i> ${label}
                </span>`;
    }
    return '';
}

// One-line inbound indicator. Reads inboundStatusMap (populated async by
// fetchInboundStatuses); never triggers its own SanMar call.
function renderInboundIndicator(quote) {
    const wo = getWoId(quote);
    if (!wo) return '<span class="inbound-na" title="Not in ShopWorks yet">—</span>';
    const info = inboundStatusMap.get(String(wo));
    if (info === undefined) return `<span class="inbound-pending" title="Checking SanMar…">·</span>`;
    if (info === 'unavailable') return `<span class="inbound-na" title="SanMar status unavailable — refresh to retry">status unavailable</span>`;
    if (info === null) return '<span class="inbound-na" title="No SanMar PO linked">—</span>';
    const LABEL = { shipped: 'Shipped', partial: 'Partially shipped', complete: 'Complete', confirmed: 'Ordered — not shipped', canceled: 'Canceled', unknown: (info.status || 'Unknown') };
    const cls = info.shipped ? (info.state === 'partial' ? 'inbound-partial' : 'inbound-shipped')
              : (info.state === 'canceled' ? 'inbound-canceled' : 'inbound-confirmed');
    // "dolly" (inbound/receiving) — visually distinct from the outbound
    // Progress "Shipped" truck so a SanMar blanks delivery is never misread
    // as the customer's order shipping out (Erik 2026-06-16).
    const title = `Inbound blanks · SanMar PO ${info.po || '?'} · ${LABEL[info.state] || info.status || ''}${info.trackingNumber ? ' · ' + info.trackingNumber : ''}`;
    const icon = '<i class="fas fa-dolly"></i>';
    // Only emit a real link when the tracking URL is a well-formed http(s)
    // URL — trackingUrl comes from the SanMar batch-status API, so treat it
    // as untrusted and always escapeHtml it (never interpolate raw). A blank
    // or non-http value renders as a plain (non-link) pill.
    const safeTrackUrl = (info.shipped && /^https?:\/\//i.test(String(info.trackingUrl || '')))
        ? escapeHtml(info.trackingUrl) : '';
    const base = safeTrackUrl
        ? `<a class="inbound-pill ${cls}" href="${safeTrackUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation();" title="${escapeHtml(title)}">${icon}</a>`
        : `<span class="inbound-pill ${cls}" title="${escapeHtml(title)}">${icon}</span>`;
    // SanMar backorder / hold alert (from order-status issues). Erik 2026-06-24.
    let alert = '';
    if (info.issue && (info.issue.backorder || info.issue.hold)) {
        const isBo = info.issue.backorder;
        const aTitle = `SanMar ${isBo ? 'BACKORDER' : 'HOLD'}${info.issue.label ? ' · ' + info.issue.label : ''}`;
        alert = ` <span class="inbound-alert ${isBo ? 'inbound-backorder' : 'inbound-hold'}" title="${escapeHtml(aTitle)}"><i class="fas fa-triangle-exclamation"></i> ${isBo ? 'Backorder' : 'Hold'}</span>`;
    }
    return base + alert;
}

// ONE batched call for all loaded work orders we haven't checked yet.
// SYNCED data via the proxy (no per-row SOAP). Non-fatal on failure.
async function fetchInboundStatuses({ force = false } = {}) {
    const allWo = [...new Set((allQuotes || []).map(getWoId).filter(Boolean).map(String))];
    // Normal load: only fetch WOs we haven't checked. force=true (after a
    // manual sync): re-fetch ALL and bust the proxy's synced-status cache.
    const woIds = force ? allWo : allWo.filter(wo => !inboundStatusMap.has(wo));
    if (woIds.length === 0) return;
    try {
        const resp = await fetch(`${API_BASE}/api/sanmar-orders/batch-status?woIds=${encodeURIComponent(woIds.join(','))}${force ? '&refresh=true' : ''}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json().catch(() => ({}));
        woIds.forEach(wo => inboundStatusMap.set(wo, (data && data[wo]) ? data[wo] : null));
        renderTable(); // re-render so indicators appear
    } catch (err) {
        // Never leave the pending spinner spinning forever (Erik #1 rule —
        // show a real state, not a fake "still checking"). Mark the WOs we
        // tried as unavailable so their pills flip to a neutral label; a
        // manual sync (force=true) re-fetches them.
        console.error('[QuoteManagement] Inbound batch-status failed:', err);
        woIds.forEach(wo => inboundStatusMap.set(wo, 'unavailable'));
        renderTable();
    }
}

function renderMilestonePills(quote) {
    if (!quote.ShopWorks_Snapshot) {
        return `<span class="milestone-na" title="ShopWorks not yet synced">—</span>`;
    }
    // Memoized parse (snapOf). A malformed snapshot caches to {} → order = {} →
    // the pills below all render as neutral "na" dashes, same visible outcome as
    // the old dedicated parse-error dash.
    const order = snapOf(quote).order || {};

    // Each pill mirrors the ShopWorks milestone state exactly (Erik
    // 2026-06-16): Yes / No / Partial / n/a / "—". Composite "Purchase
    // Received" = Purchased + Received. KEEP IN SYNC with quote-view.js.
    const pills = MILESTONE_ICONS.map(({ label, icon, fields }) => {
        const st = fields.length > 1
            ? combineSwStatus(fields.map(f => mapSwStatus(order[f])))
            : mapSwStatus(order[fields[0]]);
        // Pill tone: yes→done(green), no→pending, else the raw state
        // (partial→amber, na/unknown→neutral). Tooltip shows exact state.
        const tone = st.state === 'yes' ? 'done' : (st.state === 'no' ? 'pending' : st.state);
        return `<span class="milestone-pill milestone-pill--${tone}" title="${escapeHtml(label)}: ${escapeHtml(st.label)}">
                    <i class="fas ${icon}"></i>
                </span>`;
    }).join('');
    return `<div class="milestone-pills">${pills}</div>`;
}

// Salesperson column (Erik 2026-06-15). The authoritative salesperson is
// the ShopWorks order owner — order.CustomerServiceRep on the synced
// snapshot (e.g. "Erik Mickelson"). That only exists once the order has
// been pulled back from ManageOrders, so fall back to the quote-time
// SalesRepName for rows not yet synced. Storefront orders carry no
// quote-time rep, so they show "—" until the ShopWorks snapshot lands —
// which is itself the tell that the ShopWorks sync hasn't run for that row.
// Display the rep's FIRST name only to save width (Erik 2026-06-17 — made
// room for the Due column); the full name stays in the hover tooltip.
function firstNameOf(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
function getSalespersonInfo(quote) {
    // 1. ShopWorks snapshot — source of truth. (memoized parse via snapOf)
    if (quote.ShopWorks_Snapshot) {
        const rep = snapOf(quote)?.order?.CustomerServiceRep;
        if (rep && String(rep).trim()) {
            return {
                html: escapeHtml(firstNameOf(rep)),
                tooltip: `${String(rep).trim()} — From ShopWorks (Customer Service Rep on WO #${quote.ShopWorks_Order_Number || '?'})`,
            };
        }
    }
    // 2. Quote-time rep (builder quotes capture this; storefront orders don't).
    if (quote.SalesRepName && String(quote.SalesRepName).trim()) {
        return {
            html: escapeHtml(firstNameOf(quote.SalesRepName)),
            tooltip: `${String(quote.SalesRepName).trim()} — From the quote (ShopWorks not yet synced)`,
        };
    }
    // 3. Nothing yet.
    return {
        html: '<span class="milestone-na">—</span>',
        tooltip: 'No salesperson yet — ShopWorks order not synced',
    };
}

// Due (Requested Ship) date for the Due column (Erik 2026-06-17). This is the
// ONLY due-type date ManageOrders exposes (snapshot.order.date_RequestedToShip).
// ShopWorks's operator-set drop-dead date is NOT in the MO /v1 Orders schema,
// so it is intentionally OMITTED (confirmed against the schema — Erik 2026-06-17).
function getDueInfo(quote) {
    let due = null;
    if (quote.ShopWorks_Snapshot) {
        due = (snapOf(quote).order || {}).date_RequestedToShip || null;
    }
    return due || quote.ReqShipDate || quote.DateOrderRequestedToShip || null;
}
// MO dates arrive as 'YYYY-MM-DDT00:00:00.000Z' — a CALENDAR date stamped at
// UTC midnight. Parse the Y-M-D parts as a LOCAL date so it renders the exact
// day ShopWorks shows (a plain new Date() would shift it a day back in
// Pacific — the off-by-one bug). Returns null on no/garbage input.
function calDate(s) {
    const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function renderDueCell(quote) {
    const dueD = calDate(getDueInfo(quote));
    if (!dueD) return '<span class="milestone-na" title="No requested ship date synced from ShopWorks yet">—</span>';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((dueD - today) / 86400000);
    let cls = 'due-normal', rel = `in ${days}d`;
    if (days < 0) { cls = 'due-overdue'; rel = `${-days}d overdue`; }
    else if (days === 0) { cls = 'due-soon'; rel = 'due today'; }
    else if (days <= 3) { cls = 'due-soon'; }
    const fmt = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `<div class="due-date ${cls}" title="Requested ship date (from ShopWorks)">${fmt(dueD)}</div>`
         + `<div class="date-relative">${rel}</div>`;
}

// Tooltip explaining where the displayed amount came from. Hover on
// the Amount cell shows "From ShopWorks: $X" for synced Processed
// rows, "From quote: $X" otherwise — so staff can spot stale syncs.
function getAmountTooltip(quote) {
    if (quote.Status === 'Processed' && quote.ShopWorks_Snapshot) {
        try {
            const snap = JSON.parse(quote.ShopWorks_Snapshot);
            const raw = snap?.order?.cur_TotalInvoice;
            if (raw != null && raw !== '' && Number.isFinite(Number(raw))) {
                return `From ShopWorks invoice total (WO #${quote.ShopWorks_Order_Number || '?'})`;
            }
        } catch (_) { /* fall through */ }
    }
    return 'From quote total (ShopWorks not yet synced)';
}

// D (Erik 2026-05-22): per-row ShipStation state for the dashboard
// queue view. Returns one of: 'hidden', 'waiting', 'ready', 'sent',
// 'shipped'. Production coordinator scans the dashboard, sees at a
// glance which orders are ready to ship and clicks the 🚢 button
// (or sees tracking# if already shipped).
//
// States:
//   'hidden'  — not Processed, no snapshot, OR pickup (no label needed)
//   'waiting' — Processed + snapshot exists, but sts_Produced != 1
//   'ready'   — sts_Produced == 1, no ShipStation_Order_ID yet
//   'sent'    — ShipStation_Order_ID is set (awaiting label buy)
//   'shipped' — TrackingNumber is set (label bought)
function getShipStationState(quote) {
    if (quote.Status !== 'Processed') return { state: 'hidden' };
    if (!quote.ShopWorks_Snapshot)     return { state: 'hidden' };
    let snap;
    try { snap = JSON.parse(quote.ShopWorks_Snapshot); }
    catch (_) { return { state: 'hidden' }; }
    const order = snap?.order || {};

    // Detect pickup. Source priority:
    //   1. quote.ShipMethod column (when populated — newer submits)
    //   2. snapshot.pushed.ShippingAddresses[0].ShipMethod (post-MO sync)
    //   3. originalSubmission.ship.method (from Notes JSON — always present)
    const pushedShip = (snap?.pushed?.ShippingAddresses || [])[0];
    let method = String(quote.ShipMethod || pushedShip?.ShipMethod || '').toLowerCase();
    if (!method && quote.Notes) {
        try {
            const notes = JSON.parse(quote.Notes);
            method = String(notes?.ship?.method || '').toLowerCase();
        } catch (_) { /* ignore malformed Notes */ }
    }
    if (method.includes('pickup') || method.includes('willcall')) {
        return { state: 'hidden' };
    }
    if (quote.TrackingNumber) {
        return {
            state: 'shipped',
            trackingNumber: quote.TrackingNumber,
            trackingUrl: quote.TrackingURL,
            carrier: quote.TrackingCarrier,
        };
    }
    if (quote.ShipStation_Order_ID) {
        return { state: 'sent', shipstationId: quote.ShipStation_Order_ID };
    }
    const swProduced = Number(order?.sts_Produced);
    if (swProduced !== 1) {
        return { state: 'waiting', stsProduced: order?.sts_Produced };
    }
    return { state: 'ready' };
}

function renderShipStationButton(quote) {
    const s = getShipStationState(quote);
    if (s.state === 'hidden') return '';
    if (s.state === 'waiting') {
        return `<button class="action-btn" disabled
                        onclick="event.stopPropagation();"
                        style="opacity:0.4;cursor:not-allowed;"
                        title="Waiting for production (sts_Produced=${s.stsProduced ?? 'unknown'}). Enables once SW marks decoration complete.">
                    <span style="font-size:14px;">🕐</span>
                </button>`;
    }
    if (s.state === 'sent') {
        return `<button class="action-btn" disabled
                        onclick="event.stopPropagation();"
                        style="opacity:0.6;cursor:not-allowed;background:#f3f4f6;"
                        title="In ShipStation #${s.shipstationId}. Warehouse will buy the label in ShipStation; tracking will appear here once shipped.">
                    <span style="font-size:14px;">✓</span>
                </button>`;
    }
    if (s.state === 'shipped') {
        // Untrusted tracking URL/number from ShipStation — escape everything
        // and only emit an <a href> for a real http(s) URL (else a plain button).
        const hasUrl = /^https?:\/\//i.test(String(s.trackingUrl || ''));
        const title = `Shipped via ${escapeHtml(s.carrier || 'carrier')} · Tracking: ${escapeHtml(s.trackingNumber || '')}`;
        return hasUrl
            ? `<a class="action-btn" href="${escapeHtml(s.trackingUrl)}" target="_blank" rel="noopener"
                   onclick="event.stopPropagation();"
                   style="text-decoration:none;color:#166534;background:#dcfce7;"
                   title="${title}">
                    <span style="font-size:14px;">📦</span>
                </a>`
            : `<span class="action-btn"
                   onclick="event.stopPropagation();"
                   style="text-decoration:none;color:#166534;background:#dcfce7;cursor:default;"
                   title="${title}">
                    <span style="font-size:14px;">📦</span>
                </span>`;
    }
    // ready
    return `<button class="action-btn"
                    onclick="event.stopPropagation(); sendToShipStation('${quote.QuoteID}', ${quote.PK_ID})"
                    style="color:#0369a1;"
                    title="Send to ShipStation. Warehouse will rate + buy the label there.">
                <span style="font-size:14px;">🚢</span>
            </button>`;
}

// Click handler — POST to send-to-shipstation, then refresh
async function sendToShipStation(quoteId, pkId) {
    if (!confirm(`Send ${quoteId} to ShipStation? Warehouse will rate + buy the label there.`)) return;
    try {
        const resp = await fetch(`/api/quote-sessions/${encodeURIComponent(quoteId)}/send-to-shipstation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const result = await resp.json().catch(() => ({}));
        if (!resp.ok || !result.success) {
            throw new Error(result.error || `HTTP ${resp.status}`);
        }
        showToast(`✓ ${quoteId} sent to ShipStation #${result.shipstationOrderId || '?'}`);
        // Refresh just this row's data — reload all quotes so the snapshot
        // + ShipStation_Order_ID are current.
        await loadQuotes();
    } catch (err) {
        console.error('[QuoteManagement] sendToShipStation failed:', err);
        alert(`Failed to send ${quoteId} to ShipStation:\n${err.message}`);
    }
}

function updateStats() {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // "Active" rolls up: Open (draft) + Processed (pushed to ShopWorks
    // successfully + currently in production). Both represent live
    // money in the pipeline. Failed pushes are tracked separately so
    // staff can spot them and intervene.
    let activeCount = 0;
    let acceptedCount = 0;
    let expiringCount = 0;
    let cancelledCount = 0;
    let failedCount = 0;
    let totalValue = 0;

    baseFilteredQuotes.forEach(quote => {
        if (quote.Status === 'Cancelled_in_ShopWorks') {
            // Cancelled — counted separately and EXCLUDED from totals.
            cancelledCount++;
            return;
        }
        if (quote.Status === 'Processed - ShopWorks Failed' ||
            quote.Status === 'Payment Confirmed - ShopWorks Failed') {
            // Push failed — needs rep attention. Count, but include
            // in Total Value because the dollar is still in flight.
            // 'Payment Confirmed - ShopWorks Failed' is the URGENT
            // variant: customer was already charged but the order
            // never landed in ShopWorks → manual entry required.
            failedCount++;
            totalValue += getEffectiveAmount(quote);
            return;
        }

        if (quote.Status === 'Open' || quote.Status === 'Active' || quote.Status === 'Processed' || quote.Status === 'Pending Payment' || quote.Status === 'Payment Confirmed') {
            // In-flight money — rolled into Active:
            //   • Pending Payment — 3-Day Tees order awaiting card
            //     processing in ShopWorks.
            //   • Payment Confirmed — payment received, ShopWorks
            //     order hasn't been created yet (transient).
            // Completed orders (shipped+invoiced+paid) are DONE, not
            // active — they live in the Completed tab and are excluded
            // from the Active count (Erik 2026-06-15).
            if (!isCompletedQuote(quote)) {
                activeCount++;
                // Check if expiring within 7 days (Open only — Processed
                // orders don't expire, they're already submitted).
                if (quote.Status === 'Open' && quote.ExpiresAt) {
                    const expiresDate = new Date(quote.ExpiresAt);
                    if (expiresDate <= sevenDaysFromNow) {
                        expiringCount++;
                    }
                }
            }
        } else if (quote.Status === 'Accepted') {
            acceptedCount++;
        }

        totalValue += getEffectiveAmount(quote);
    });

    document.getElementById('stat-active').textContent = activeCount;
    document.getElementById('stat-accepted').textContent = acceptedCount;
    document.getElementById('stat-expiring').textContent = expiringCount;
    const cancelledEl = document.getElementById('stat-cancelled');
    if (cancelledEl) cancelledEl.textContent = cancelledCount;
    const failedEl = document.getElementById('stat-failed');
    if (failedEl) failedEl.textContent = failedCount;
    document.getElementById('stat-total').textContent = formatCurrency(totalValue);
}

function renderTable() {
    const tbody = document.getElementById('quotes-tbody');
    const tableEl = document.getElementById('quotes-table');
    const emptyEl = document.getElementById('table-empty');
    const countEl = document.getElementById('table-count');
    const paginationEl = document.getElementById('pagination');

    showLoading(false);

    if (filteredQuotes.length === 0) {
        tableEl.style.display = 'none';
        emptyEl.style.display = 'block';
        paginationEl.style.display = 'none';
        countEl.textContent = '0 quotes';
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(filteredQuotes.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, filteredQuotes.length);
    const pageQuotes = filteredQuotes.slice(startIdx, endIdx);

    // Update count
    countEl.textContent = `${filteredQuotes.length} quote${filteredQuotes.length !== 1 ? 's' : ''}`;

    // Render rows
    tbody.innerHTML = pageQuotes.map(quote => {
        const statusClass = getStatusClass(quote);
        const userCanDelete = canDeleteQuote(quote);
        const expiresInfo = getExpiresInfo(quote);
        const salespersonInfo = getSalespersonInfo(quote);
        const isCancelled = quote.Status === 'Cancelled_in_ShopWorks';
        const isProcessed = quote.Status === 'Processed';
        const isFailed = quote.Status === 'Processed - ShopWorks Failed';
        const isPendingPayment = quote.Status === 'Pending Payment';
        const isPaymentConfirmed = quote.Status === 'Payment Confirmed';
        const isChargedNoSWOrder = quote.Status === 'Payment Confirmed - ShopWorks Failed';

        // Status cell branches:
        //   • Cancelled — red badge (no dropdown; order is gone in SW)
        //   • Processed — green "In ShopWorks" badge (system-managed
        //     state — flips automatically post-submit, no manual edit)
        //   • Push Failed — amber warning badge (needs rep attention)
        //   • Charged · No SW Order — red URGENT badge (money in, no
        //     ShopWorks order — manual entry required)
        //   • Pending Payment — amber "Awaiting Payment" badge (3-Day
        //     Tees order, card processed in ShopWorks)
        //   • Payment Confirmed — teal "Payment Received" badge
        //     (payment in, ShopWorks order not yet created)
        //   • Otherwise — editable dropdown (Open/Lost/Accepted/Expired)
        let statusCellHtml;
        if (isCancelled) {
            statusCellHtml = `<span class="status-badge status-cancelled" title="Order was deleted in ShopWorks. Will be permanently purged after 30 days.">
                                  <i class="fas fa-ban"></i> Cancelled (SW)
                               </span>`;
        } else if (isProcessed) {
            // A2 (2026-05-22): the indexed column is the primary source,
            // but some rows have a synced snapshot WITHOUT the column
            // backfilled (legacy gap — /v1/getorderno never resolved
            // their WO# so sync-from-shopworks couldn't write the
            // column). Parse the snapshot as a fallback so those rows
            // still show "#NNNNN". /full now backfills opportunistically,
            // so this branch becomes mostly dormant over time.
            let woId = quote.ShopWorks_Order_Number || 0;
            if (!woId && quote.ShopWorks_Snapshot) {
                try {
                    const snap = JSON.parse(quote.ShopWorks_Snapshot);
                    woId = Number(snap?.order?.id_Order) || 0;
                } catch (_) { /* malformed snapshot — leave woId at 0 */ }
            }
            const woNum = woId ? ` #${woId}` : '';
            statusCellHtml = `<span class="status-badge status-processed" title="Order successfully pushed to ShopWorks${woNum ? ` (WO${woNum})` : ''}. System-managed state — syncs hourly.">
                                  <i class="fas fa-check-circle"></i> In ShopWorks${woNum}
                               </span>`;
        } else if (isChargedNoSWOrder) {
            statusCellHtml = `<span class="status-badge status-charged-no-sw" title="URGENT — payment was processed but the order didn't land in ShopWorks. Customer has been charged. Manually enter the order in ShopWorks, then mark this quote as Processed.">
                                  <i class="fas fa-exclamation-triangle"></i> Charged · No SW Order
                               </span>`;
        } else if (isFailed) {
            statusCellHtml = `<span class="status-badge status-failed" title="Push to ShopWorks failed. Open the quote and click Refresh to retry, or contact dev to inspect the proxy logs.">
                                  <i class="fas fa-exclamation-triangle"></i> Push Failed
                               </span>`;
        } else if (isPendingPayment) {
            statusCellHtml = `<span class="status-badge status-pending-payment" title="3-Day Tees order — credit card is processed in ShopWorks. Status updates once the order is completed there.">
                                  <i class="fas fa-credit-card"></i> Awaiting Payment
                               </span>`;
        } else if (isPaymentConfirmed) {
            statusCellHtml = `<span class="status-badge status-payment-confirmed" title="3-Day Tees order — payment received, ShopWorks order hasn't been created yet. Should advance to In ShopWorks shortly.">
                                  <i class="fas fa-check-circle"></i> Payment Received
                               </span>`;
        } else if (quote.PushedToShopWorks) {
            // P2-1 (audit 2026-06-06): a pushed order whose Status hasn't yet flipped to Processed
            // (the hourly sync runs AFTER SW imports) would otherwise render the editable dropdown,
            // letting a rep mark a LIVE ShopWorks order "Lost". Show a read-only locked badge.
            statusCellHtml = `<span class="status-badge status-processed" title="Pushed to ShopWorks — locked. Status syncs from ShopWorks hourly.">
                                  <i class="fas fa-lock"></i> In ShopWorks
                               </span>`;
        } else {
            statusCellHtml = `<select class="status-dropdown status-${(quote.Status || 'Open').toLowerCase()}"
                                      data-pk-id="${quote.PK_ID}"
                                      data-quote-id="${quote.QuoteID}"
                                      onclick="event.stopPropagation();"
                                      onchange="updateQuoteStatus(this)">
                                  <option value="Open" ${quote.Status === 'Open' ? 'selected' : ''}>Open</option>
                                  <option value="Accepted" ${quote.Status === 'Accepted' ? 'selected' : ''} disabled title="Set automatically when the customer accepts the quote — not manually selectable">Accepted</option>
                                  <option value="Lost" ${quote.Status === 'Lost' ? 'selected' : ''}>Lost</option>
                                  <option value="Expired" ${quote.Status === 'Expired' ? 'selected' : ''} disabled title="Set automatically when the quote passes its expiration date — not manually selectable">Expired</option>
                               </select>`;
        }

        // Retention countdown — ShopWorks_Last_Synced is the
        // cancelled-at timestamp. Purge happens at +30 days. Use
        // CaspioDate.parse to correctly resolve the naive Pacific
        // timestamp; raw Date.parse would shift by ~7-8 h depending
        // on DST → countdown off by 1 day (the "Purges in 31 days"
        // bug from the previous deploy).
        const retentionInfo = isCancelled && quote.ShopWorks_Last_Synced
            ? (() => {
                const cancelledDate = (window.CaspioDate && window.CaspioDate.parse)
                    ? window.CaspioDate.parse(quote.ShopWorks_Last_Synced)
                    : new Date(quote.ShopWorks_Last_Synced);
                if (!cancelledDate || isNaN(cancelledDate.getTime())) return '';
                const purgeMs = cancelledDate.getTime() + 30 * 24 * 60 * 60 * 1000;
                const daysLeft = Math.max(0, Math.ceil((purgeMs - Date.now()) / 86400000));
                return `<div class="date-relative" style="color:#b91c1c">Purges in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</div>`;
              })()
            : '';

        return `
            <tr class="${isCancelled ? 'quote-row--cancelled' : ''}" onclick="viewQuote('${quote.QuoteID}')">
                <td class="checkbox-col" onclick="event.stopPropagation();">
                    <input type="checkbox" class="quote-checkbox"
                           data-pk-id="${quote.PK_ID}"
                           data-quote-id="${quote.QuoteID}"
                           data-status="${quote.Status || 'Open'}"
                           ${userCanDelete ? '' : 'disabled title="You can only delete your own quotes"'}
                           onchange="updateCheckboxSelection()">
                </td>
                <td>
                    <span class="quote-id">${quote.QuoteID || '-'}</span>
                    ${renderShopWorksRef(quote)}
                </td>
                <td>
                    <div class="customer-name">${escapeHtml(quote.CustomerName || '-')}</div>
                    <div class="customer-email">${escapeHtml(quote.CustomerEmail || '')}</div>
                </td>
                <td class="salesperson-cell" title="${escapeHtml(salespersonInfo.tooltip)}">${salespersonInfo.html}</td>
                <td>${quote.TotalQuantity || 0}</td>
                <td class="quote-amount" title="${getAmountTooltip(quote)}">${formatCurrency(getEffectiveAmount(quote))}</td>
                <td>${statusCellHtml}${renderDepositChip(quote)}</td>
                <td>${renderMilestonePills(quote)}</td>
                <td class="inbound-cell" onclick="event.stopPropagation();">${renderInboundIndicator(quote)}</td>
                <td class="due-cell">${renderDueCell(quote)}</td>
                <td>
                    <div class="date-cell">${formatDate(quote.CreatedAt)}</div>
                    ${retentionInfo || (expiresInfo ? `<div class="date-relative">${expiresInfo}</div>` : '')}
                </td>
                <td>
                    ${(() => {
                        // Phase 11.3.5 (Erik 2026-05-24): one-way sync rule —
                        // once a quote is in ShopWorks, ALL revisions happen
                        // there and flow back via snapshot. Editing here
                        // would diverge from SW silently. Lock the Edit
                        // button for any state where the order is live in
                        // (or has been touched by) SW.
                        const lockedStatuses = new Set([
                            'Processed',
                            'Cancelled_in_ShopWorks',
                            'Payment Confirmed',
                            'Payment Confirmed - ShopWorks Failed',
                            'Pending Payment',
                        ]);
                        // Also lock once pushed to ShopWorks even if Status
                        // hasn't flipped — EMB/SCP/DTF set PushedToShopWorks
                        // but can leave Status='Open'. (2026-06-01)
                        const isEditLocked = lockedStatuses.has(quote.Status) || !!quote.PushedToShopWorks;
                        if (isEditLocked) {
                            return `<button class="action-btn action-btn--locked"
                                            disabled
                                            title="In ShopWorks — edit there. Changes here would not sync back.">
                                        <i class="fas fa-lock"></i>
                                    </button>`;
                        }
                        return `<button class="action-btn" onclick="event.stopPropagation(); editQuote('${quote.QuoteID}')" title="Edit Quote">
                                    <i class="fas fa-edit"></i>
                                </button>`;
                    })()}
                    <button class="action-btn" onclick="event.stopPropagation(); viewQuote('${quote.QuoteID}')" title="View Quote">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn" onclick="event.stopPropagation(); copyQuoteLink('${quote.QuoteID}')" title="Copy Link">
                        <i class="fas fa-link"></i>
                    </button>
                    ${renderDuplicateButton(quote)}
                    ${renderResendEmailButton(quote)}
                    <button class="action-btn action-audit" onclick="event.stopPropagation(); viewAudit('${quote.QuoteID}')" title="Pricing Audit">
                        <i class="fas fa-chart-bar"></i>
                    </button>
                    ${renderShipStationButton(quote)}
                    ${userCanDelete
                        ? `<button class="action-btn action-delete" onclick="event.stopPropagation(); deleteQuote(${quote.PK_ID}, '${escapeJsAttr(quote.QuoteID)}', '${escapeJsAttr(quote.Status || 'Open')}')" title="Delete Quote">
                        <i class="fas fa-trash"></i>
                    </button>`
                        : `<button class="action-btn action-btn--locked" disabled onclick="event.stopPropagation();" title="Only the quote owner or Erik can delete this quote">
                        <i class="fas fa-trash"></i>
                    </button>`}
                </td>
            </tr>
        `;
    }).join('');

    // Show table
    tableEl.style.display = 'table';
    emptyEl.style.display = 'none';

    // Update pagination
    if (totalPages > 1) {
        paginationEl.style.display = 'flex';
        document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
        document.getElementById('btn-prev').disabled = currentPage === 1;
        document.getElementById('btn-next').disabled = currentPage === totalPages;
    } else {
        paginationEl.style.display = 'none';
    }
}

function getStatusClass(quote) {
    if (quote.Status === 'Accepted') return 'accepted';
    if (quote.Status === 'Expired') return 'expired';
    if (quote.Status === 'Lost') return 'lost';
    if (quote.Status === 'Open' || quote.Status === 'Active') {
        // Check if expiring soon
        if (quote.ExpiresAt) {
            const expiresDate = new Date(quote.ExpiresAt);
            const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            if (expiresDate <= sevenDaysFromNow) {
                return 'expiring-soon';
            }
        }
        return 'open';
    }
    return '';
}

// Update quote status via API
async function updateQuoteStatus(selectEl) {
    const pkId = selectEl.dataset.pkId;
    const quoteId = selectEl.dataset.quoteId;
    const newStatus = selectEl.value;
    const oldClass = selectEl.className.match(/status-\w+/)?.[0] || '';

    // Update visual immediately
    selectEl.className = selectEl.className.replace(/status-\w+/, `status-${newStatus.toLowerCase()}`);

    try {
        const response = await fetch(`${API_BASE}/api/quote_sessions/${pkId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Status: newStatus })
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        // Update local data
        const quote = allQuotes.find(q => q.PK_ID == pkId);
        if (quote) {
            quote.Status = newStatus;
        }

        showToast(`Quote ${quoteId} marked as ${newStatus}`);
        updateStats(); // Refresh stats

    } catch (error) {
        console.error('[QuoteManagement] Failed to update status:', error);
        showToast('Failed to update status. Please try again.');
        // Revert visual
        selectEl.value = selectEl.querySelector('option[selected]')?.value || 'Open';
        selectEl.className = selectEl.className.replace(/status-\w+/, oldClass);
    }
}

function getExpiresInfo(quote) {
    if ((quote.Status !== 'Active' && quote.Status !== 'Open') || !quote.ExpiresAt) return null;

    const expiresDate = new Date(quote.ExpiresAt);
    const now = new Date();
    const daysUntil = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntil <= 0) return 'Expired';
    if (daysUntil === 1) return 'Expires tomorrow';
    if (daysUntil <= 7) return `Expires in ${daysUntil} days`;
    return null;
}

// Navigation
function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredQuotes.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Actions
function viewQuote(quoteId) {
    // Open quote view page
    window.open(`/quote/${quoteId}`, '_blank');
}

function editQuote(quoteId) {
    // Phase 11.3.5 (Erik 2026-05-24): defense-in-depth guard against
    // editing a quote that's been pushed to ShopWorks. The Edit button
    // in renderTable() is already disabled for these statuses, but
    // belt-and-braces in case someone calls editQuote() programmatically.
    const lockedStatuses = new Set([
        'Processed',
        'Cancelled_in_ShopWorks',
        'Payment Confirmed',
        'Payment Confirmed - ShopWorks Failed',
        'Pending Payment',
    ]);
    const quote = (allQuotes || []).find(q => q.QuoteID === quoteId);
    if (quote && (lockedStatuses.has(quote.Status) || quote.PushedToShopWorks)) {
        alert(
            `${quoteId} is in ShopWorks (status: ${quote.Status}).\n\n` +
            `Per the one-way sync rule, edits must happen in ShopWorks. ` +
            `Changes in this app would not sync back.\n\n` +
            `Opening read-only quote view instead.`
        );
        viewQuote(quoteId);
        return;
    }

    // Determine quote type from QuoteID prefix = LEADING LETTERS ONLY.
    // QuoteID formats differ by method: EMB-2026-001 (hyphen after prefix)
    // vs DTG0311-1 / DTF0601-1 / SP0601-9001 (date-packed, NO hyphen).
    // The old split('-')[0] returned "DTG0311" for DTG, so every non-EMB
    // quote wrongly fell through to the EMB builder. Match the alpha
    // prefix instead, and use the real builder filenames. (2026-06-01)
    const prefix = (String(quoteId).match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
    let builderUrl = '/quote-builders/embroidery-quote-builder.html';

    if (prefix === 'DTG') {
        builderUrl = '/quote-builders/dtg-quote-builder.html';
    } else if (prefix === 'DTF') {
        builderUrl = '/quote-builders/dtf-quote-builder.html';
    } else if (prefix === 'SP' || prefix === 'SPC' || prefix === 'SSC') {
        builderUrl = '/quote-builders/screenprint-quote-builder.html';
    } else if (prefix === 'CAP') {
        // Custom Hats storefront orders (CAP{MMDD}-{rand4}, 2026-06-11).
        // Stripe-paid storefront quotes have no builder — like CTS DTG
        // rows they're normally caught by the locked-status guard above,
        // but never route a CAP row into the EMB builder. Read-only view.
        viewQuote(quoteId);
        return;
    } else if (prefix === 'OF') {
        // Retired Order Form drafts (OF-NNNN) — the React Order Form app was
        // removed 2026-07-11, so there is no app to reopen these in. Open the
        // read-only view instead (same treatment as CAP rows).
        viewQuote(quoteId);
        return;
    }
    // EMB / EMBC / CEMB and anything else → embroidery builder (default)

    // Open quote builder in edit mode
    window.open(`${builderUrl}?edit=${quoteId}`, '_blank');
}

function copyQuoteLink(quoteId) {
    const url = `${window.location.origin}/quote/${quoteId}`;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard!');
    }).catch(() => {
        // Fallback
        prompt('Copy this link:', url);
    });
}

// ── Duplicate-as-new-quote (#4, 2026-07-05) ──────────────────────────
// ?duplicate=<quoteId> loads a COPY of the source quote as a brand-NEW
// quote at today's prices. It is READ-ONLY on the source (the builders'
// loadQuoteForEditing runs with forDuplicate:true and never writes back),
// so it's safe for ANY status — including Processed/locked/pushed rows,
// which is exactly the reorder case Edit is locked for.
//
// Support (verified 2026-07-05): ALL 4 builders read the ?duplicate= param —
// DTF (dtf-quote-builder.js ~line 239), embroidery (embroidery-quote-builder.js
// ~line 2047), screen print (screenprint-quote-builder.js DOMContentLoaded init
// + duplicateQuote), and DTG (dtg-inline-form.js init() + loadSavedDtgQuoteForEdit
// forDuplicate mode).
// Prefix→builder routing mirrors editQuote() above (leading letters only —
// DTG0311-1 / DTF0601-1 / SP0601-9001 pack the date with NO hyphen).
const DUPLICATE_BUILDERS = {
    DTF:  '/quote-builders/dtf-quote-builder.html',
    // EMB / EMBC / CEMB all route to the embroidery builder, same as Edit.
    EMB:  '/quote-builders/embroidery-quote-builder.html',
    EMBC: '/quote-builders/embroidery-quote-builder.html',
    CEMB: '/quote-builders/embroidery-quote-builder.html',
    DTG:  '/quote-builders/dtg-quote-builder.html',
    // SP / SPC / SSC all route to the screen print builder, same as Edit.
    SP:   '/quote-builders/screenprint-quote-builder.html',
    SPC:  '/quote-builders/screenprint-quote-builder.html',
    SSC:  '/quote-builders/screenprint-quote-builder.html',
};

// Leading-letters prefix of a QuoteID (same rule editQuote uses).
function quoteIdPrefix(quoteId) {
    return (String(quoteId).match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
}

// Row button — only for prefixes whose builder honors ?duplicate= today.
// Duplication is read-only on the source, so it renders for every status
// (Open AND Processed/locked).
function renderDuplicateButton(quote) {
    if (!DUPLICATE_BUILDERS[quoteIdPrefix(quote.QuoteID)]) return '';
    return `<button class="action-btn" onclick="event.stopPropagation(); duplicateQuote('${escapeJsAttr(quote.QuoteID)}')" title="Start a new quote pre-filled from this one">
                <i class="fas fa-copy"></i>
            </button>`;
}

function duplicateQuote(quoteId) {
    const builderUrl = DUPLICATE_BUILDERS[quoteIdPrefix(quoteId)];
    if (!builderUrl) {
        // Defensive — the button never renders for unsupported prefixes.
        alert(`${quoteId} can't be duplicated yet — its builder doesn't support pre-filling from an existing quote.`);
        return;
    }
    window.open(`${builderUrl}?duplicate=${encodeURIComponent(quoteId)}`, '_blank');
}

// ── Resend quote email (#14, 2026-07-05) ─────────────────────────────
// Re-sends the SAME customer quote-link email the builders send
// (quote-builder-utils.js emailQuote(): EmailJS service_jgrave3 /
// template_quote_email — existing template, never an invented ID). The
// EmailJS browser SDK is loaded by quote-management.html with the same
// <script> tag the builders use; init uses the builders' public key.
const EMAILJS_PUBLIC_KEY = '4qSbDO-SQs19TbP80';
const EMAILJS_SERVICE_ID = 'service_jgrave3';
const EMAILJS_TEMPLATE_QUOTE = 'template_quote_email';
let emailJsInited = false;

function ensureEmailJs() {
    if (typeof emailjs === 'undefined') return false; // SDK failed to load
    if (!emailJsInited) {
        emailjs.init(EMAILJS_PUBLIC_KEY);
        emailJsInited = true;
    }
    return true;
}

// Row button — only for rows that have a customer email on file.
function renderResendEmailButton(quote) {
    const email = String(quote.CustomerEmail || '').trim();
    if (!email) return '';
    return `<button class="action-btn" onclick="event.stopPropagation(); resendQuoteEmail(${quote.PK_ID})" title="Resend quote email to ${escapeHtml(email)}">
                <i class="fas fa-paper-plane"></i>
            </button>`;
}

// Confirm (prompt pre-filled with the on-file address, editable) → send.
// Keyed by PK_ID like deleteQuote so no email ever rides in an attribute.
const resendInFlight = new Set();
async function resendQuoteEmail(pkId) {
    const quote = findQuoteByPk(pkId);
    if (!quote) {
        alert('Quote not found — refresh the page and try again.');
        return;
    }
    const quoteId = quote.QuoteID;
    if (resendInFlight.has(quoteId)) return; // double-click guard
    if (!ensureEmailJs()) {
        // Erik's #1 rule — a visible failure, never a silent no-op.
        alert('Email service is unavailable (EmailJS SDK did not load).\nCheck your connection, refresh the page, and try again.');
        return;
    }

    // Confirm + allow editing the address in one step: prompt pre-filled
    // with the on-file email. Cancel aborts; OK sends to whatever's typed.
    const onFile = String(quote.CustomerEmail || '').trim();
    const entered = prompt(
        `Resend quote ${quoteId} to this email?\n\nEdit the address below if needed, then click OK to send.`,
        onFile
    );
    if (entered === null) return; // cancelled
    const toEmail = entered.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
        alert(`"${toEmail}" doesn't look like a valid email address. Nothing was sent.`);
        return;
    }

    // Same customer link the builders' emailQuote builds — the public
    // teamnwca.com origin, NOT window.location.origin (this dashboard can
    // be open on the Heroku domain, which customers shouldn't see).
    const siteOrigin = (window.APP_CONFIG && window.APP_CONFIG.SITE_ORIGIN) || 'https://www.teamnwca.com';
    const quoteUrl = `${siteOrigin}/quote/${quoteId}`;

    resendInFlight.add(quoteId);
    showToast('Sending email…');
    try {
        // Params mirror quote-builder-utils.js emailQuote() exactly, so the
        // template renders identically to the original send.
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_QUOTE, {
            to_email: toEmail,
            customer_name: quote.CustomerName || 'Customer',
            quote_id: quoteId,
            quote_link: quoteUrl,
            reply_to: (quote.SalesRepEmail && String(quote.SalesRepEmail).trim()) || 'sales@nwcustomapparel.com',
            company_name: 'Northwest Custom Apparel',
            company_phone: '253-922-5793',
        });
        showToast(`✓ Email resent to ${toEmail}`);
    } catch (err) {
        // Erik's #1 rule — surface the failure, never fail silently.
        console.error('[QuoteManagement] resendQuoteEmail failed:', err);
        alert(`Failed to resend quote email for ${quoteId}:\n${(err && (err.text || err.message)) || err}`);
    } finally {
        resendInFlight.delete(quoteId);
    }
}

function viewAudit(quoteId) {
    window.open(`/pages/quote-audit.html?id=${quoteId}`, '_blank');
}

// Utilities
function showLoading(show) {
    document.getElementById('table-loading').style.display = show ? 'flex' : 'none';
    if (show) {
        document.getElementById('quotes-table').style.display = 'none';
        document.getElementById('table-empty').style.display = 'none';
    }
}

function showError(message) {
    showLoading(false);
    document.getElementById('table-empty').innerHTML = `
        <i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i>
        <h3>Error Loading Quotes</h3>
        <p>${message}</p>
    `;
    document.getElementById('table-empty').style.display = 'block';
}

function showToast(message) {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #333;
        color: white;
        padding: 12px 24px;
        border-radius: 4px;
        z-index: 9999;
        font-size: 14px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Safe to drop a value inside a SINGLE-quoted JS string that itself lives
// inside a double-quoted HTML onclick="" attribute (e.g. deleteQuote(...)).
// escapeHtml alone does NOT neutralize an apostrophe, so a QuoteID/Status
// containing ' or \ could break out of the JS string. Escape the JS-string
// metacharacters first, then HTML-escape so it's attribute-safe too.
function escapeJsAttr(str) {
    return escapeHtml(String(str == null ? '' : str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'"));
}

// ============================================================
// DELETE FUNCTIONALITY
// ============================================================

// State for delete operations
let selectedQuotes = new Set();
let pendingDeleteData = [];
let pendingDeleteType = null; // 'single' or 'bulk'

// Toggle select all checkbox
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all');
    const checkboxes = document.querySelectorAll('.quote-checkbox');

    checkboxes.forEach(cb => {
        // Skip rows the user can't delete (disabled checkbox) — "select
        // all" must not arm a bulk-delete of someone else's quotes.
        if (!cb.disabled) cb.checked = selectAllCheckbox.checked;
    });

    updateCheckboxSelection();
}

// Update selection state when individual checkboxes change
function updateCheckboxSelection() {
    const checkboxes = document.querySelectorAll('.quote-checkbox');
    const selectAllCheckbox = document.getElementById('select-all');

    selectedQuotes.clear();

    checkboxes.forEach(cb => {
        // Defensive: never count a disabled (non-owned) row, even if its
        // checked state was somehow set programmatically.
        if (cb.checked && !cb.disabled) {
            selectedQuotes.add({
                pkId: cb.dataset.pkId,
                quoteId: cb.dataset.quoteId,
                status: cb.dataset.status
            });
        }
    });

    // Update select all checkbox state — measured against the rows the
    // user is actually allowed to select (deletable / not disabled).
    const checkedCount = selectedQuotes.size;
    const totalCount = Array.from(checkboxes).filter(cb => !cb.disabled).length;

    if (checkedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedCount === totalCount) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }

    updateBulkDeleteButton();
}

// Update bulk delete button state
function updateBulkDeleteButton() {
    const btn = document.getElementById('btn-bulk-delete');
    const countSpan = document.getElementById('selected-count');

    countSpan.textContent = selectedQuotes.size;
    btn.disabled = selectedQuotes.size === 0;
}

// ============================================================
// ROLE-BASED DELETE PERMISSIONS (Erik 2026-06-15)
// Master user (Erik) may delete ANY quote; every other rep may delete
// ONLY quotes they own. Keyed off the staff login (StaffAuthHelper →
// sessionStorage nwca_user_email/name).
//
// This UI-level guard hides the delete control from reps who don't own a
// quote (fast feedback). It is BACKED by real server-side enforcement:
// deleteQuoteAPI() routes DELETE /api/quote_sessions/:id through THIS app
// (not the proxy) with credentials:'same-origin', so the httpOnly session
// cookie rides along and the server's role gate enforces ownership from the
// logged-in identity (returns 401 when the session is missing/expired — the
// client re-establishes it and retries once). A user hand-calling the
// endpoint without a valid session, or for a quote they don't own, is
// rejected server-side — the UI guard is no longer the only line of defense.
// ============================================================
const MASTER_DELETE_EMAILS = new Set(['erik@nwcustomapparel.com']);

function isMasterUser() {
    return !!currentUserEmail && MASTER_DELETE_EMAILS.has(String(currentUserEmail).toLowerCase());
}

// Map a staff display name ("Erik Mickelson") → email via the shared
// StaffAuthHelper map. Returns null if unknown.
function staffNameToEmail(name) {
    if (!name) return null;
    // NOTE: StaffAuthHelper is a top-level `const` in staff-auth-helper.js,
    // so it is a global binding but NOT a property of `window` — reference
    // it by bare name (guarded with typeof), never `window.StaffAuthHelper`
    // (that is undefined and would silently empty this map → nobody but the
    // master could delete their own quotes).
    const map = (typeof StaffAuthHelper !== 'undefined' && StaffAuthHelper.STAFF_EMAIL_MAP) || {};
    const hit = map[String(name).trim()];
    return hit ? hit.toLowerCase() : null;
}

// Best-effort owner email for a quote:
//   1) explicit SalesRepEmail column
//   2) ShopWorks CustomerServiceRep name → email (authoritative once synced)
//   3) quote-time SalesRepName → email
function getQuoteOwnerEmail(quote) {
    if (quote.SalesRepEmail && String(quote.SalesRepEmail).trim()) {
        return String(quote.SalesRepEmail).trim().toLowerCase();
    }
    if (quote.ShopWorks_Snapshot) {
        try {
            const rep = JSON.parse(quote.ShopWorks_Snapshot)?.order?.CustomerServiceRep;
            const email = staffNameToEmail(rep);
            if (email) return email;
        } catch (_) { /* malformed snapshot */ }
    }
    return staffNameToEmail(quote.SalesRepName);
}

// Can the logged-in user delete this quote?
//   • master (Erik)           → always
//   • not logged in / unknown → never (safe default)
//   • otherwise               → only if they own it
function canDeleteQuote(quote) {
    if (!quote) return false;
    if (isMasterUser()) return true;
    if (!currentUserEmail) return false;
    const owner = getQuoteOwnerEmail(quote);
    return !!owner && owner === String(currentUserEmail).toLowerCase();
}

// Delete handlers only receive a pkId — resolve back to the quote row.
function findQuoteByPk(pkId) {
    return (allQuotes || []).find(q => String(q.PK_ID) === String(pkId)) || null;
}

// Single quote delete
function deleteQuote(pkId, quoteId, status) {
    // Permission gate (defensive — the row button/checkbox are already
    // disabled for non-owners; re-check here in case of stale UI).
    const quote = findQuoteByPk(pkId);
    if (!canDeleteQuote(quote)) {
        const owner = quote ? getQuoteOwnerEmail(quote) : null;
        alert(`You can only delete your own quotes.\n\n${quoteId} belongs to ${owner || 'another rep'}. Ask them — or Erik — to delete it.`);
        return;
    }

    let message = `Are you sure you want to delete quote <strong>${quoteId}</strong>?`;

    if (status === 'Accepted') {
        message = `<span class="warning-text"><i class="fas fa-exclamation-triangle"></i> Warning:</span> Quote <strong>${quoteId}</strong> has been <strong>Accepted</strong>. Deleting it will remove the record permanently.<br><br>Are you sure you want to proceed?`;
    }

    showDeleteModal('Delete Quote', message, [{ pkId, quoteId, status }], 'single');
}

// Bulk delete selected quotes
function bulkDelete() {
    if (selectedQuotes.size === 0) return;

    const quotes = Array.from(selectedQuotes);
    const acceptedQuotes = quotes.filter(q => q.status === 'Accepted');
    const otherQuotes = quotes.filter(q => q.status !== 'Accepted');

    let message = '';

    if (acceptedQuotes.length > 0 && otherQuotes.length > 0) {
        message = `<span class="warning-text"><i class="fas fa-exclamation-triangle"></i> Warning:</span> You selected <strong>${quotes.length} quotes</strong>, including <strong>${acceptedQuotes.length} Accepted</strong> quote(s).<br><br>`;
        message += `<strong>Accepted:</strong> ${acceptedQuotes.map(q => q.quoteId).join(', ')}<br>`;
        message += `<strong>Other:</strong> ${otherQuotes.map(q => q.quoteId).join(', ')}<br><br>`;
        message += `Are you sure you want to delete all ${quotes.length} quotes?`;
    } else if (acceptedQuotes.length > 0) {
        message = `<span class="warning-text"><i class="fas fa-exclamation-triangle"></i> Warning:</span> All <strong>${acceptedQuotes.length}</strong> selected quote(s) are <strong>Accepted</strong>:<br><br>`;
        message += `${acceptedQuotes.map(q => q.quoteId).join(', ')}<br><br>`;
        message += `Are you sure you want to delete them permanently?`;
    } else {
        message = `Are you sure you want to delete <strong>${quotes.length}</strong> quote(s)?<br><br>`;
        message += `${quotes.map(q => q.quoteId).join(', ')}`;
    }

    showDeleteModal('Delete Selected Quotes', message, quotes, 'bulk');
}

// Show delete confirmation modal
function showDeleteModal(title, message, data, type) {
    pendingDeleteData = data;
    pendingDeleteType = type;

    document.getElementById('delete-modal-title').textContent = title;
    document.getElementById('delete-modal-message').innerHTML = message;
    document.getElementById('delete-modal').style.display = 'flex';
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('delete-modal').style.display = 'none';
    pendingDeleteData = [];
    pendingDeleteType = null;
}

// Confirm and execute delete
async function confirmDelete() {
    if (pendingDeleteData.length === 0) {
        closeDeleteModal();
        return;
    }

    const confirmBtn = document.querySelector('.btn-confirm-delete');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    let successCount = 0;
    let failCount = 0;
    const errorMessages = new Set();

    for (const item of pendingDeleteData) {
        try {
            const result = await deleteQuoteAPI(item.pkId);
            if (result && result.ok) {
                successCount++;
                // Remove from local data
                allQuotes = allQuotes.filter(q => q.PK_ID != item.pkId);
            } else {
                failCount++;
                if (result && result.message) errorMessages.add(result.message);
            }
        } catch (error) {
            console.error(`[QuoteManagement] Failed to delete ${item.quoteId}:`, error);
            failCount++;
        }
    }

    // Reset button state
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = 'Delete';

    closeDeleteModal();

    // Clear selection
    selectedQuotes.clear();
    document.getElementById('select-all').checked = false;
    updateBulkDeleteButton();

    // Show result — surface the server's reason (e.g. "You can only
    // delete your own quotes") rather than failing silently.
    const detail = errorMessages.size ? ' — ' + [...errorMessages].join('; ') : '';
    if (failCount === 0) {
        showToast(`Successfully deleted ${successCount} quote(s)`);
    } else if (successCount > 0) {
        showToast(`Deleted ${successCount}, ${failCount} blocked${detail}`);
    } else {
        alert(`Could not delete:\n\n${[...errorMessages].join('\n') || 'Please try again.'}`);
    }

    // Re-apply filters to refresh table
    applyFilters();
}

// API call to delete quote
async function deleteQuoteAPI(pkId) {
    // Routed through THIS app (pricing-index), NOT the proxy, so the
    // httpOnly session cookie rides along and the server-side role gate
    // can enforce ownership (DELETE /api/quote_sessions/:id). Returns
    // { ok, status, message }.
    const doDelete = () => fetch(`/api/quote_sessions/${pkId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
    });
    try {
        let response = await doDelete();
        // Session expired (MemoryStore cleared on dyno restart) — try to
        // re-establish once, then retry.
        if (response.status === 401) {
            await establishCrmSession();
            response = await doDelete();
        }
        if (!response.ok) {
            let message = `HTTP ${response.status}`;
            try { const j = await response.json(); if (j && j.message) message = j.message; } catch (_) { /* non-JSON */ }
            console.error(`[QuoteManagement] Delete blocked/failed (${response.status}):`, message);
            return { ok: false, status: response.status, message };
        }
        return { ok: true };
    } catch (error) {
        console.error('[QuoteManagement] Delete API error:', error);
        return { ok: false, status: 0, message: error.message };
    }
}

// Close modal on outside click
document.addEventListener('click', function(e) {
    const modal = document.getElementById('delete-modal');
    if (e.target === modal) {
        closeDeleteModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeDeleteModal();
    }
});
