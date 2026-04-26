/**
 * art-hub-steve-gallery.js — JS-rendered gallery for Steve's Art Hub
 *
 * Replaces the Caspio DataPage embed (a0e15000a28d5718e81646dd900b) with a
 * JS-rendered grid that reuses the 2026 design system (.mockup-card pattern
 * shared with Ruth + AE) and routes mockup thumbnails through the dormant
 * /api/box/shared-image proxy so they actually render.
 *
 * Exposes `window.SteveGallery = { mount, refresh, applySearch, applyStatus,
 * handleThumbError, markComplete, isActive }`.
 *
 * Depends on: art-hub-steve.js (normalizeStatus, getDueBadge, isRush helpers
 * are NOT shared yet — duplicated locally to keep this module standalone),
 * art-actions-shared.js (window.ArtActions for modals + escapeHtml),
 * mockup-ruth.css (.mockup-card / .status-stat / .pill / .status-pill).
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // Same date cutoff the kanban uses — only show requests on the new status system
    var DATE_CUTOFF = '2026-03-15';
    var INITIAL_DISPLAY = 30;
    var DISPLAY_INCREMENT = 30;

    // Module state
    var allRequests = [];        // last fetched array
    var currentSearch = '';
    var currentStatus = 'all';   // 'all' | 'submitted' | 'in-progress' | 'awaiting-approval' | 'revision-requested' | 'approved' | 'completed'
    var displayCount = INITIAL_DISPLAY;
    var archiveActive = false;
    var fetchInflight = null;

    // ── Helpers (local copies of art-hub-steve.js fns to keep this module standalone) ──
    function escapeHtml(s) {
        return (window.ArtActions && window.ArtActions.escapeHtml)
            ? window.ArtActions.escapeHtml(s)
            : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
    }

    function normalizeStatus(raw) {
        if (!raw || raw === '') return 'Submitted';
        var s = String(raw).trim();
        if (typeof raw === 'object') {
            var vals = Object.values(raw);
            s = vals.length > 0 ? String(vals[0]).trim() : 'Submitted';
        }
        var lower = s.toLowerCase();
        if (lower === 'submitted' || lower === '') return 'Submitted';
        if (lower === 'in progress') return 'In Progress';
        if (lower === 'awaiting approval') return 'Awaiting Approval';
        if (lower === 'completed' || lower === 'complete') return 'Completed';
        if (lower === 'approved') return 'Approved';
        if (lower.indexOf('revision') !== -1) return 'Revision Requested';
        return 'Submitted';
    }

    function statusKey(req) {
        return normalizeStatus(req.Status).toLowerCase().replace(/\s+/g, '-');
    }

    function isRush(v) {
        if (window.ArtActions && typeof window.ArtActions.isRush === 'function') return window.ArtActions.isRush(v);
        if (!v && v !== 0) return false;
        if (typeof v === 'boolean') return v;
        var s = String(v).trim().toLowerCase();
        return s === 'yes' || s === 'y' || s === 'true' || s === '1';
    }

    function getDueBadge(dueDateStr) {
        if (!dueDateStr) return { text: '', cls: '' };
        var due = new Date(dueDateStr);
        if (isNaN(due.getTime())) return { text: '', cls: '' };
        var today = new Date(); today.setHours(0,0,0,0);
        due.setHours(0,0,0,0);
        var diffDays = Math.round((due - today) / 86400000);
        if (diffDays < 0)   return { text: 'Overdue ' + Math.abs(diffDays) + 'd', cls: 'pill--danger' };
        if (diffDays === 0) return { text: 'Due Today', cls: 'pill--warning' };
        if (diffDays === 1) return { text: 'Due Tomorrow', cls: 'pill--warning' };
        if (diffDays <= 7) {
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return { text: 'Due ' + months[due.getMonth()] + ' ' + due.getDate(), cls: 'pill--info' };
        }
        return { text: '', cls: '' };
    }

    function getOrderType(req) {
        if (!req.Order_Type) return '';
        var ot = typeof req.Order_Type === 'object' ? Object.values(req.Order_Type)[0] : req.Order_Type;
        return String(ot || '');
    }

    // Resolve a sales rep email/identifier to a first name for the card header.
    // Tries window.ArtActions.resolveRep(email).displayName first (the registered
    // human-readable name), then falls back to capitalized email local-part
    // ("erik@nwcustomapparel.com" → "Erik"). Returns '' if no rep on record.
    function getRepFirstName(salesRep) {
        if (!salesRep) return '';
        var raw = String(salesRep).trim();
        if (!raw) return '';
        if (window.ArtActions && typeof window.ArtActions.resolveRep === 'function') {
            try {
                var resolved = window.ArtActions.resolveRep(raw);
                if (resolved && resolved.displayName) {
                    return String(resolved.displayName).split(/\s+/)[0];
                }
            } catch (e) { /* fall through to email parse */ }
        }
        // Fallback: take the email local-part and capitalize it.
        var local = raw.split('@')[0];
        if (!local) return '';
        return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
    }

    // Image-only extensions for AE-uploaded files (PDF/EPS/AI render as 0-width
    // <img> and trip onerror, so we filter upfront to keep thumbnails clean).
    var IMG_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
    function isImagePath(path) {
        return path && IMG_EXT_RE.test(String(path));
    }

    // Pull up to 2 AE-uploaded image thumbnails (CDN_Link, CDN_Link_Two paired
    // with File_Upload_One, File_Upload_Two for extension check).
    function getAeArtworkUrls(req) {
        var pairs = [
            { url: req.CDN_Link,     path: req.File_Upload_One },
            { url: req.CDN_Link_Two, path: req.File_Upload_Two }
        ];
        return pairs.filter(function (p) { return p.url && isImagePath(p.path); })
                    .map(function (p) { return p.url; });
    }

    // ── Fetch ─────────────────────────────────────────────────────────────
    function fetchRequests() {
        // Sales_Rep || User_Email per the established convention (MEMORY.md note
        // "Email recipient fix v2026.04.08"). On recent records Sales_Rep is
        // empty and User_Email holds the AE email — without User_Email in the
        // SELECT the rep first name in the card header has nothing to resolve.
        var selectFields = 'ID_Design,CompanyName,Design_Num_SW,Status,Sales_Rep,User_Email,Due_Date,Date_Created,Revision_Count,Order_Type,Is_Rush,Box_File_Mockup,BoxFileLink,Company_Mockup,File_Upload_One,File_Upload_Two,CDN_Link,CDN_Link_Two';
        var selectFallback = 'ID_Design,CompanyName,Design_Num_SW,Status,Sales_Rep,User_Email,Due_Date,Date_Created,Revision_Count,Order_Type,Box_File_Mockup,BoxFileLink,Company_Mockup,File_Upload_One,File_Upload_Two,CDN_Link,CDN_Link_Two';
        var dateClause = archiveActive ? '' : '&dateCreatedFrom=' + DATE_CUTOFF;
        var baseUrl = API_BASE + '/api/artrequests?orderBy=Date_Created DESC&limit=200' + dateClause;

        if (fetchInflight) fetchInflight.abort();
        fetchInflight = new AbortController();

        return fetch(baseUrl + '&select=' + selectFields, { signal: fetchInflight.signal })
            .then(function (resp) {
                if (resp.status === 500) {
                    return fetch(baseUrl + '&select=' + selectFallback, { signal: fetchInflight.signal })
                        .then(function (r2) { if (!r2.ok) throw new Error('API ' + r2.status); return r2.json(); });
                }
                if (!resp.ok) throw new Error('API ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                allRequests = Array.isArray(data) ? data : [];
                fetchInflight = null;
            });
    }

    // ── Render: status filter chips ────────────────────────────────────────
    function renderStatusChips() {
        var counts = { all: 0, submitted: 0, 'in-progress': 0, 'awaiting-approval': 0, 'revision-requested': 0, approved: 0, completed: 0 };
        allRequests.forEach(function (r) {
            counts.all++;
            var k = statusKey(r);
            if (counts[k] !== undefined) counts[k]++;
        });

        var pills = [
            { key: 'all',                  label: 'All',                modifier: 'other' },
            { key: 'submitted',            label: 'Submitted',          modifier: 'submitted' },
            { key: 'in-progress',          label: 'In Progress',        modifier: 'in-progress' },
            { key: 'awaiting-approval',    label: 'Awaiting Approval',  modifier: 'awaiting-approval' },
            { key: 'revision-requested',   label: 'Revisions',          modifier: 'revision-requested' },
            { key: 'approved',             label: 'Approved',           modifier: 'completed' },
            { key: 'completed',            label: 'Completed',          modifier: 'completed' }
        ];

        var html = '';
        pills.forEach(function (p) {
            // Hide zero-count chips except 'all'
            if (p.key !== 'all' && counts[p.key] === 0) return;
            var isActive = currentStatus === p.key;
            html += '<div class="status-stat status-stat--' + p.modifier + (isActive ? ' active' : '') +
                '" data-status-key="' + p.key + '" title="' + escapeHtml(p.label) + '">' +
                '<span class="status-stat-count">' + counts[p.key] + '</span>' +
                '<span class="status-stat-label">' + escapeHtml(p.label) + '</span></div>';
        });

        var wrap = document.getElementById('steve-gallery-status');
        if (wrap) wrap.innerHTML = html;
    }

    // ── Render: card ──────────────────────────────────────────────────────
    function buildCard(req) {
        var designId      = String(req.ID_Design || '');
        var company       = escapeHtml(req.CompanyName || 'Unknown');
        var designNum     = escapeHtml(req.Design_Num_SW || '');
        var statusRaw     = normalizeStatus(req.Status);
        var sKey          = statusRaw.toLowerCase().replace(/\s+/g, '-');
        // Sales_Rep || User_Email per MEMORY.md convention. On most recent
        // records Sales_Rep is empty and User_Email holds the AE address.
        var repFirstName  = escapeHtml(getRepFirstName(req.Sales_Rep || req.User_Email));
        var revCount      = req.Revision_Count || 0;
        var due        = getDueBadge(req.Due_Date);
        var orderType  = getOrderType(req);
        var rushBadge  = isRush(req.Is_Rush);
        var rushCls    = rushBadge ? ' mockup-card--rush' : '';

        var mockupUrl = req.Box_File_Mockup || req.BoxFileLink || req.Company_Mockup || '';
        var thumbHtml;
        if (mockupUrl) {
            // Two URL shapes appear in ArtRequests.Box_File_Mockup historically:
            //  (a) Raw Box shared link (HTML page): box.com/shared/static/...
            //      → MUST go through /api/box/shared-image (HTML-page-to-image proxy)
            //  (b) Proxy URL written by recent uploaders: caspio-pricing-proxy.../api/box/thumbnail/{id}
            //      → Already an image URL; use directly. Wrapping it in shared-image
            //        produces nonsense like ?url=<proxy-url> which the converter rejects.
            var src = (mockupUrl.indexOf('/api/box/') !== -1)
                ? mockupUrl
                : API_BASE + '/api/box/shared-image?url=' + encodeURIComponent(mockupUrl);
            thumbHtml = '<img src="' + src + '"' +
                ' alt="' + company + ' mockup" loading="lazy"' +
                ' onerror="window.SteveGallery.handleThumbError(this)">';
        } else {
            // No mockup yet — fall back to up to 2 AE-uploaded artwork thumbnails
            // (CDN_Link / CDN_Link_Two from /Artwork/{filename}). Steve sees what
            // the customer wants without clicking into the detail page.
            var aeUrls = getAeArtworkUrls(req);
            if (aeUrls.length > 0) {
                var imgs = aeUrls.map(function (u) {
                    return '<img src="' + escapeHtml(u) + '" alt="AE artwork" loading="lazy" onerror="this.style.display=\'none\'">';
                }).join('');
                thumbHtml =
                    '<div class="card-thumb-ae card-thumb-ae--' + aeUrls.length + '">' +
                        '<div class="card-thumb-ae-label">AE Artwork</div>' +
                        '<div class="card-thumb-ae-grid">' + imgs + '</div>' +
                    '</div>';
            } else {
                // Status-aware empty message — "Completed — no mockup file" reads as
                // a legitimate end-state (text-only jobs, rework, etc.) rather than
                // implying Steve forgot to upload. Active states stay "No mockup yet".
                var doneStates = (sKey === 'approved' || sKey === 'completed');
                var emptyMsg = doneStates ? 'Completed — no mockup file' : 'No mockup yet';
                thumbHtml = '<div class="card-thumb-empty"><span class="pill">' + emptyMsg + '</span></div>';
            }
        }

        var badges = '';
        if (rushBadge)        badges += '<span class="card-badge card-badge--rush">RUSH</span>';
        if (orderType)        badges += '<span class="card-badge">' + escapeHtml(orderType) + '</span>';
        if (revCount > 0)     badges += '<span class="card-badge card-badge--revision">Rev ' + revCount + '</span>';
        if (due.text)         badges += '<span class="card-badge ' + due.cls + '">' + escapeHtml(due.text) + '</span>';

        return '<article class="mockup-card mockup-card--' + sKey + rushCls + '" data-design-id="' + escapeHtml(designId) + '" data-status="' + sKey + '">' +
            '<div class="card-header">' +
                '<div class="card-header-left">' +
                    '<div class="card-company">' + company + '</div>' +
                    // Rep first name appended to the design# line via inline span
                    // with a faint dot separator (see .card-rep-name in art-hub.css).
                    // Keeps the header 2 lines tall and gives Steve "which job + whose
                    // AE" in one glance. Replaces the redundant "Rep:" meta line that
                    // used to live below the thumbnail (removed 2026-04-26).
                    (designNum
                        ? '<div class="card-design-number">#' + designNum +
                            (repFirstName ? '<span class="card-rep-name">' + repFirstName + '</span>' : '') +
                          '</div>'
                        : (repFirstName
                            ? '<div class="card-design-number"><span class="card-rep-name card-rep-name--standalone">' + repFirstName + '</span></div>'
                            : '')
                    ) +
                '</div>' +
                '<div class="card-header-right">' +
                    '<span class="status-pill status-pill--' + sKey + '">' + escapeHtml(statusRaw) + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="card-thumb">' + thumbHtml + '</div>' +
            '<div class="card-body">' +
                (badges ? '<div class="card-badges">' + badges + '</div>' : '') +
                // 3 actions in workflow order: Send Mockup → Complete → Log Time.
                // Labels shortened 2026-04-26 so all 3 fit on one row at typical
                // card widths (was wrapping to 2 rows with "Send for Approval"
                // and "Mark Complete"). "Send Mockup" matches what the modal
                // calls itself; "Complete" drops the redundant "Mark" verb.
                // Notes button removed earlier — that button called
                // window.openNotesPanel which is defined inside art-hub-steve.js's
                // IIFE and never exposed globally. Notes are added on the detail
                // page's "Notes & Activity" panel.
                '<div class="card-actions">' +
                    '<button type="button" class="sg-btn sg-btn--primary" data-action="send-approval">Send Mockup</button>' +
                    '<button type="button" class="sg-btn sg-btn--success" data-action="mark-complete">Complete</button>' +
                    '<button type="button" class="sg-btn" data-action="log-time">Log Time</button>' +
                '</div>' +
            '</div>' +
        '</article>';
    }

    // ── Render: grid (applies search + status + display cap) ──────────────
    function getFiltered() {
        var q = currentSearch.toLowerCase();
        return allRequests.filter(function (r) {
            // Status filter
            if (currentStatus !== 'all' && statusKey(r) !== currentStatus) return false;
            // Search filter
            if (q) {
                var hay = (
                    (r.CompanyName || '') + ' ' +
                    (r.Design_Num_SW || '') + ' ' +
                    String(r.ID_Design || '')
                ).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });
    }

    function renderGrid() {
        var grid = document.getElementById('steve-gallery-grid');
        if (!grid) return;
        var filtered = getFiltered();
        var slice = filtered.slice(0, displayCount);

        if (filtered.length === 0) {
            grid.innerHTML = '<div class="sg-empty">No matching requests' +
                (currentSearch ? ' for "' + escapeHtml(currentSearch) + '"' : '') + '.</div>';
        } else {
            grid.innerHTML = slice.map(buildCard).join('');
        }

        // Load More button visibility
        var loadMore = document.getElementById('steve-gallery-load-more');
        if (loadMore) {
            var hidden = filtered.length - slice.length;
            if (hidden > 0) {
                loadMore.style.display = '';
                loadMore.textContent = 'Load ' + Math.min(DISPLAY_INCREMENT, hidden) + ' more (' + hidden + ' hidden)';
            } else {
                loadMore.style.display = 'none';
            }
        }

        // Result count
        var countEl = document.getElementById('steve-gallery-count');
        if (countEl) {
            countEl.textContent = filtered.length === allRequests.length
                ? allRequests.length + ' requests'
                : filtered.length + ' of ' + allRequests.length + ' requests';
        }
    }

    // ── Public API ────────────────────────────────────────────────────────
    function applySearch(q) {
        currentSearch = String(q || '').trim();
        displayCount = INITIAL_DISPLAY;
        renderGrid();
    }

    function applyStatus(key) {
        currentStatus = key || 'all';
        displayCount = INITIAL_DISPLAY;
        renderStatusChips();
        renderGrid();
    }

    function handleThumbError(img) {
        // Image had a src that failed to load → the Box link is broken (file
        // deleted, fileId stale, shared-link expired). Distinct from "no mockup
        // ever uploaded" — show a clear warning and direct staff to re-upload.
        // Card-level click handler already opens /art-request/{id} in a new tab,
        // where the detail page has the Re-upload button.
        try {
            var thumb = img.parentNode;
            thumb.innerHTML =
                '<div class="card-thumb-broken" title="Click card to open detail page and re-upload">' +
                    '<div class="card-thumb-broken-icon">&#9888;</div>' +
                    '<div class="card-thumb-broken-title">Link broken</div>' +
                    '<div class="card-thumb-broken-hint">Click to re-upload</div>' +
                '</div>';
        } catch (e) { /* defensive — img may already be detached */ }
    }

    function markComplete(designId, btn) {
        if (!designId) return;
        if (btn) { btn.disabled = true; btn.textContent = 'Marking…'; }
        fetch(API_BASE + '/api/art-requests/' + encodeURIComponent(designId) + '/status', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Completed' })
        })
        .then(function (r) {
            if (!r.ok) throw new Error('API ' + r.status);
            return refresh();
        })
        .catch(function (err) {
            console.error('[SteveGallery.markComplete] failed:', err);
            alert('Failed to mark complete: ' + (err.message || err));
            if (btn) { btn.disabled = false; btn.textContent = 'Mark Complete'; }
        });
    }

    function refresh() {
        return fetchRequests().then(function () {
            renderStatusChips();
            renderGrid();
        }).catch(function (err) {
            if (err && err.name === 'AbortError') return;
            console.error('[SteveGallery] fetch failed:', err);
            var grid = document.getElementById('steve-gallery-grid');
            if (grid) {
                grid.innerHTML = '';
                var wrap = document.createElement('div');
                wrap.className = 'sg-error';
                var strong = document.createElement('strong');
                strong.textContent = 'Error loading requests: ';
                wrap.appendChild(strong);
                wrap.appendChild(document.createTextNode(err.message || String(err)));
                wrap.appendChild(document.createElement('br'));
                var retry = document.createElement('button');
                retry.type = 'button';
                retry.className = 'sg-btn';
                retry.textContent = 'Retry';
                retry.style.marginTop = '12px';
                retry.addEventListener('click', refresh);
                wrap.appendChild(retry);
                grid.appendChild(wrap);
            }
        });
    }

    function isActive() {
        // True when grid view is active (not kanban)
        return localStorage.getItem('steveViewPreference') !== 'board';
    }

    // ── Mount: build chrome inside #steve-grid-view, wire events ─────────
    var mounted = false;
    function mount() {
        if (mounted) return;
        var host = document.getElementById('steve-grid-view');
        if (!host) return;
        mounted = true;

        host.innerHTML =
            '<div class="sg-toolbar">' +
                '<input type="search" id="steve-gallery-search" placeholder="Search company, design #, or ID..." autocomplete="off">' +
                '<button type="button" id="steve-gallery-archive" class="sg-btn">Show Archive</button>' +
                '<span id="steve-gallery-count" class="sg-count"></span>' +
            '</div>' +
            '<div id="steve-gallery-status" class="status-summary"></div>' +
            '<div id="steve-gallery-grid" class="mockup-grid"></div>' +
            '<div class="sg-load-more-wrap">' +
                '<button type="button" id="steve-gallery-load-more" class="sg-btn" style="display:none;"></button>' +
            '</div>';

        // Search input — debounced 120ms
        var searchEl = document.getElementById('steve-gallery-search');
        var searchTimer = null;
        searchEl.addEventListener('input', function () {
            clearTimeout(searchTimer);
            var v = this.value;
            searchTimer = setTimeout(function () { applySearch(v); }, 120);
        });

        // Archive toggle
        var archiveBtn = document.getElementById('steve-gallery-archive');
        archiveBtn.addEventListener('click', function () {
            archiveActive = !archiveActive;
            archiveBtn.textContent = archiveActive ? 'Hide Archive' : 'Show Archive';
            archiveBtn.classList.toggle('sg-btn--active', archiveActive);
            displayCount = INITIAL_DISPLAY;
            refresh();
        });

        // Status chip click — delegated
        document.getElementById('steve-gallery-status').addEventListener('click', function (e) {
            var chip = e.target.closest('.status-stat');
            if (!chip) return;
            applyStatus(chip.dataset.statusKey);
        });

        // Card + action button clicks — delegated
        var grid = document.getElementById('steve-gallery-grid');
        grid.addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-action]');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                var card = btn.closest('.mockup-card');
                if (!card) return;
                var designId = card.dataset.designId;
                var company  = (card.querySelector('.card-company') || {}).textContent || '';
                var action = btn.dataset.action;
                if (action === 'send-approval') {
                    if (window.ArtActions && window.ArtActions.showSendForApprovalModal) {
                        window.ArtActions.showSendForApprovalModal(designId, company.trim(), refresh);
                    }
                } else if (action === 'log-time') {
                    if (window.ArtActions && window.ArtActions.showArtTimeModal) {
                        window.ArtActions.showArtTimeModal(designId, '', company.trim(), refresh);
                    }
                } else if (action === 'mark-complete') {
                    if (confirm('Mark "' + company.trim() + '" complete?')) {
                        markComplete(designId, btn);
                    }
                }
                return;
            }
            // Card-level click (not on a button) → open detail page
            var card = e.target.closest('.mockup-card');
            if (card && card.dataset.designId) {
                window.open('/art-request/' + encodeURIComponent(card.dataset.designId), '_blank');
            }
        });

        // Load More
        document.getElementById('steve-gallery-load-more').addEventListener('click', function () {
            displayCount += DISPLAY_INCREMENT;
            renderGrid();
        });

        // Initial fetch + render
        refresh();
    }

    // ── Auto-mount on DOMContentLoaded if Grid view is preferred ─────────
    function autoMount() {
        if (localStorage.getItem('steveViewPreference') === 'board') {
            // User prefers board view — defer mount until they switch to Grid
            return;
        }
        mount();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoMount);
    } else {
        autoMount();
    }

    window.SteveGallery = {
        mount: mount,
        refresh: refresh,
        applySearch: applySearch,
        applyStatus: applyStatus,
        handleThumbError: handleThumbError,
        markComplete: markComplete,
        isActive: isActive
    };
})();
