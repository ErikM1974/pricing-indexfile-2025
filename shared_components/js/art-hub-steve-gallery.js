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
    var currentStatus = 'all';   // 'all' | 'submitted' | 'in-progress' | 'awaiting-approval' | 'revision-requested' | 'approved' | 'completed' | 'on-hold' | 'broken'
    var displayCount = INITIAL_DISPLAY;
    var archiveActive = false;
    var fetchInflight = null;
    // Layer 3.5 — broken-link chip data (mirrors steve.js's brokenDesignIds Map).
    // Populated from /api/art-requests/broken-mockups; consumed by the chip
    // count + the 'broken' filter in getFiltered().
    var brokenDesignIdSet = new Set();      // Set<string designId> for O(1) hit-test
    var brokenFetchInflight = null;
    // Bulk multi-select (2026-07-05): "Select" toggle turns cards into
    // checkboxes; the sticky bar offers ONE bulk action — Mark Complete —
    // which loops the exact same PUT the single-card Complete button uses.
    // Send Mockup / Log Time stay single-card only (modal-entangled).
    var selectMode = false;
    var selectedIds = new Set();            // Set<string designId>
    var bulkInflight = false;

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
        // Coalesce Order_Type (legacy Garment DataPage multi-select dict) with
        // Order_Type_Source (new REST forms — plain Text 255). Each record has
        // exactly one populated; never both. The multi-select REST limitation
        // forced the parallel column. See MEMORY.md "Critical Patterns".
        if (req.Order_Type) {
            var ot = typeof req.Order_Type === 'object' ? Object.values(req.Order_Type)[0] : req.Order_Type;
            return String(ot || '');
        }
        if (req.Order_Type_Source) return String(req.Order_Type_Source);
        return '';
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

    // Item_Type → 'Garment' / 'Sticker' / 'Banner' / 'JDS'. NULL or anything
    // else collapses to 'Garment' so legacy rows render as today (single
    // source of truth for the fallback rule, matches the rule in art-ae.js
    // + mockup-detail).
    function resolveItemType(raw) {
        if (raw === 'Sticker' || raw === 'Banner' || raw === 'JDS') return raw;
        return 'Garment';
    }

    // JDS catalog SKU → thumbnail map, populated lazily after first fetch.
    // Lets the card render the JDS product image when there's no mockup yet.
    var jdsCatalogBySku = {};
    var jdsCatalogLoaded = false;
    function loadJdsCatalog() {
        if (jdsCatalogLoaded || typeof JDSCatalogService === 'undefined') return;
        jdsCatalogLoaded = true;
        try {
            var svc = new JDSCatalogService();
            svc.listAll().then(function (rows) {
                (rows || []).forEach(function (r) {
                    if (r && r.SKU) jdsCatalogBySku[String(r.SKU).toLowerCase()] = r;
                });
                // Re-render so JDS cards pick up the catalog thumbnail.
                if (typeof renderGrid === 'function') renderGrid();
            }).catch(function () { /* fail silent — fallback chain still works */ });
        } catch (_e) { /* ignore */ }
    }
    function getJdsCatalogRow(sku) {
        if (!sku) return null;
        return jdsCatalogBySku[String(sku).toLowerCase()] || null;
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
        // Artwork_Status + Approval_Status are in the PRIMARY select only — if the
        // ArtRequests table doesn't have them yet (pre-migration), the request 500s
        // and falls back to selectFallback which omits them. Graceful degradation.
        var selectFields = 'ID_Design,CompanyName,Design_Num_SW,Status,Sales_Rep,User_Email,Due_Date,Date_Created,Revision_Count,Order_Type,Order_Type_Source,Item_Type,JDS_SKU,Is_Rush,Artwork_Status,Approval_Status,Artwork_Locations,Color_Mode,Exact_Text,Garment_Placement,Box_File_Mockup,BoxFileLink,Company_Mockup,File_Upload_One,File_Upload_Two,CDN_Link,CDN_Link_Two,Is_On_Hold,On_Hold_Since,On_Hold_Note';
        var selectFallback = 'ID_Design,CompanyName,Design_Num_SW,Status,Sales_Rep,User_Email,Due_Date,Date_Created,Revision_Count,Order_Type,Order_Type_Source,Item_Type,JDS_SKU,Box_File_Mockup,BoxFileLink,Company_Mockup,File_Upload_One,File_Upload_Two,CDN_Link,CDN_Link_Two,Is_On_Hold,On_Hold_Since,On_Hold_Note';
        // 2-level fallback for legacy ArtRequests installs that don't have
        // Item_Type, JDS_SKU, or Order_Type_Source yet — strip them and retry.
        // NULL Item_Type = treated as 'Garment' at render time (see
        // resolveItemType()). NULL Order_Type_Source = coalesce falls back to
        // Order_Type which will exist on every install.
        var selectLegacy = selectFallback
            .replace(',Item_Type', '')
            .replace(',JDS_SKU', '')
            .replace(',Order_Type_Source', '');
        var dateClause = archiveActive ? '' : '&dateCreatedFrom=' + DATE_CUTOFF;
        var baseUrl = API_BASE + '/api/artrequests?orderBy=Date_Created DESC&limit=200' + dateClause;

        if (fetchInflight) fetchInflight.abort();
        fetchInflight = new AbortController();

        return fetch(baseUrl + '&select=' + selectFields, { signal: fetchInflight.signal })
            .then(function (resp) {
                if (resp.status === 500) {
                    return fetch(baseUrl + '&select=' + selectFallback, { signal: fetchInflight.signal })
                        .then(function (r2) {
                            if (r2.status === 500) {
                                // Item_Type field doesn't exist in Caspio yet — degrade gracefully.
                                return fetch(baseUrl + '&select=' + selectLegacy, { signal: fetchInflight.signal })
                                    .then(function (r3) { if (!r3.ok) throw new Error('API ' + r3.status); return r3.json(); });
                            }
                            if (!r2.ok) throw new Error('API ' + r2.status);
                            return r2.json();
                        });
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
        var counts = { all: 0, submitted: 0, 'in-progress': 0, 'awaiting-approval': 0, 'revision-requested': 0, approved: 0, completed: 0, 'on-hold': 0 };
        allRequests.forEach(function (r) {
            counts.all++;
            // On-hold designs get their own chip and are EXCLUDED from the
            // status counts — keeps Steve's "Awaiting Approval" backlog accurate
            // (mirrors the AE-dashboard pattern from Phase 2).
            if (r.Is_On_Hold) {
                counts['on-hold']++;
                return;
            }
            var k = statusKey(r);
            if (counts[k] !== undefined) counts[k]++;
        });

        // Broken count = unique designIds in the broken-mockups list that also
        // appear in the current allRequests fetch (so archived/filtered records
        // don't inflate the count).
        var brokenCount = 0;
        if (brokenDesignIdSet.size > 0) {
            allRequests.forEach(function (r) {
                if (brokenDesignIdSet.has(String(r.ID_Design))) brokenCount++;
            });
        }

        var pills = [
            { key: 'all',                  label: 'All',                modifier: 'other' },
            { key: 'submitted',            label: 'Submitted',          modifier: 'submitted' },
            { key: 'in-progress',          label: 'In Progress',        modifier: 'in-progress' },
            { key: 'awaiting-approval',    label: 'Awaiting Approval',  modifier: 'awaiting-approval' },
            { key: 'revision-requested',   label: 'Revisions',          modifier: 'revision-requested' },
            { key: 'approved',             label: 'Approved',           modifier: 'completed' },
            { key: 'completed',            label: 'Completed',          modifier: 'completed' },
            { key: 'on-hold',              label: 'On Hold',            modifier: 'on-hold' },
            { key: 'broken',               label: 'Link Broken',        modifier: 'broken', count: brokenCount }
        ];

        var html = '';
        pills.forEach(function (p) {
            // Broken chip uses its dedicated count; everyone else uses the bucket count.
            var n = (p.key === 'broken') ? p.count : counts[p.key];
            // Hide zero-count chips except 'all'
            if (p.key !== 'all' && n === 0) return;
            var isActive = currentStatus === p.key;
            html += '<div class="status-stat status-stat--' + p.modifier + (isActive ? ' active' : '') +
                '" data-status-key="' + p.key + '" title="' + escapeHtml(p.label) + '">' +
                '<span class="status-stat-count">' + n + '</span>' +
                '<span class="status-stat-label">' + escapeHtml(p.label) + '</span></div>';
        });

        var wrap = document.getElementById('steve-gallery-status');
        if (wrap) wrap.innerHTML = html;
    }

    // ── Broken-mockups fetch (powers the Link Broken chip) ─────────────────
    // Reuses the same endpoint art-hub-steve.js polls for the legacy pill
    // (which we hide once the chip renders). Backend has a 10-min cache so
    // the duplicate call is essentially free.
    function fetchBrokenMockups() {
        if (brokenFetchInflight) return brokenFetchInflight;
        // ?status=all so the chip count matches what's actually visible in the
        // gallery (which renders Completed/Approved cards too). Without this,
        // the chip undercounts and Steve sees broken thumbs the chip doesn't.
        brokenFetchInflight = fetch(API_BASE + '/api/art-requests/broken-mockups?status=all')
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var next = new Set();
                (data && data.results || []).forEach(function (r) {
                    if (r && r.designId != null) next.add(String(r.designId));
                });
                brokenDesignIdSet = next;
                brokenFetchInflight = null;
            })
            .catch(function (err) {
                console.warn('[SteveGallery] broken-mockups fetch failed:', err && err.message);
                brokenFetchInflight = null;
            });
        return brokenFetchInflight;
    }

    // Compact labels for the structured status badges so they fit on cards.
    // Dash-insensitive: the form writes an em-dash, but a hand-edit in Caspio
    // could use a hyphen — normalize both so the badge still shortens.
    function normStatusKey(s) {
        return String(s || '').replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim();
    }
    function shortArtworkStatus(s) {
        var map = {
            'New artwork from scratch': 'New Art',
            'Mockup only': 'Mockup',
            'Revision to existing proof': 'Revision',
            'Repeat from previous order': 'Repeat',
            'Final approved / production ready': 'Production'
        };
        return map[normStatusKey(s)] || s;
    }
    function shortApprovalStatus(s) {
        var map = {
            'Not approved - Steve to create proof': 'Not Approved',
            'Customer reviewing proof': 'In Review',
            'Customer approved - ready for production': '✓ Approved',
            'Internal revision only': 'Internal Rev',
            'Post-approval change order': 'Change Order'
        };
        return map[normStatusKey(s)] || s;
    }
    function shortColorMode(s) {
        var map = {
            'Use exact PMS colors': 'Exact PMS',
            'Use closest match': 'Closest match',
            'Match previous order': 'Match prev',
            'Black only': 'Black only',
            'White only': 'White only',
            'Full color': 'Full color',
            "AE/customer doesn't know - Steve to recommend": 'Steve to pick'
        };
        return map[normStatusKey(s)] || s;
    }
    // Compact at-a-glance art-spec line for cards: primary placement + size,
    // color mode, and an "has exact text" flag. Detail page carries the full set.
    function buildArtSpecLine(req) {
        var parts = [];
        var locs = [];
        try { if (req.Artwork_Locations) { var arr = JSON.parse(req.Artwork_Locations); if (Array.isArray(arr)) locs = arr; } } catch (e) {}
        var primary = locs[0];
        var placeStr = '';
        if (primary && primary.placement) {
            placeStr = primary.placement;
            if (primary.width && primary.height) placeStr += ' ' + primary.width + '×' + primary.height + '"';
            else if (primary.width) placeStr += ' ' + primary.width + '"';
            if (locs.length > 1) placeStr += ' +' + (locs.length - 1);
        } else if (req.Garment_Placement) {
            placeStr = req.Garment_Placement;
        }
        if (placeStr) parts.push('<span class="card-spec-item">\u{1F4CD} ' + escapeHtml(placeStr) + '</span>');
        var cm = (req.Color_Mode || '').trim();
        if (cm) parts.push('<span class="card-spec-item">\u{1F3A8} ' + escapeHtml(shortColorMode(cm)) + '</span>');
        var exact = (req.Exact_Text || '').trim();
        if (exact && exact.indexOf('No text') === -1) parts.push('<span class="card-spec-item">\u{1F4DD} text</span>');
        return parts.length ? '<div class="card-artspec">' + parts.join('') + '</div>' : '';
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
        // On-hold overlay (Phase 3) — visibility only, AE owns the toggle.
        // Pill renders next to status pill; opacity drops via .mockup-card--on-hold.
        var isOnHold      = !!req.Is_On_Hold;
        var onHoldCls     = isOnHold ? ' mockup-card--on-hold' : '';
        var onHoldPillHtml = isOnHold
            ? '<span class="status-pill status-pill--on-hold" title="' + escapeHtml(req.On_Hold_Note || 'On hold — customer paused this design') + '">On Hold</span> '
            : '';

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
            // No mockup yet — for JDS items, prefer the JDS catalog/live thumbnail
            // (Steve sees the actual product Erik picked) before falling back to
            // AE-uploaded artwork thumbnails.
            var jdsThumb = null;
            if (resolveItemType(req.Item_Type) === 'JDS' && req.JDS_SKU) {
                var jdsRow = getJdsCatalogRow(req.JDS_SKU);
                if (jdsRow) {
                    jdsThumb = jdsRow.ThumbnailURL || null;
                }
            }
            // No mockup yet — fall back to up to 2 AE-uploaded artwork thumbnails
            // (CDN_Link / CDN_Link_Two from /Artwork/{filename}). Steve sees what
            // the customer wants without clicking into the detail page.
            var aeUrls = getAeArtworkUrls(req);
            if (jdsThumb) {
                thumbHtml = '<div class="card-thumb-jds">'
                    + '<img src="' + escapeHtml(jdsThumb) + '" alt="' + company + ' JDS product" loading="lazy" onerror="this.parentNode.style.display=\'none\'">'
                    + '<div class="card-thumb-jds-label">JDS · ' + escapeHtml(req.JDS_SKU) + '</div>'
                    + '</div>';
            } else if (aeUrls.length > 0) {
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
        // Item-type badge — Sticker / Banner / JDS / Garment (NULL → Garment).
        // Garment is the default — only render the badge when something else.
        var itemType = resolveItemType(req.Item_Type);
        if (itemType === 'Sticker' || itemType === 'Banner') {
            var itEmoji = itemType === 'Sticker' ? '\u{1F3F7}' : '\u{1F38C}';
            var itCls = itemType === 'Sticker' ? 'card-badge--sticker' : 'card-badge--banner';
            badges += '<span class="card-badge ' + itCls + '" title="' + itemType + ' request">' + itEmoji + ' ' + itemType + '</span>';
        } else if (itemType === 'JDS') {
            var jdsTitle = req.JDS_SKU ? ('JDS request — ' + req.JDS_SKU) : 'JDS vendor product request';
            badges += '<span class="card-badge card-badge--jds" title="' + escapeHtml(jdsTitle) + '">\u{1F3AF} JDS' + (req.JDS_SKU ? ' · ' + escapeHtml(req.JDS_SKU) : '') + '</span>';
        }
        // Structured garment-form status badges (2026-06-17). Artwork_Status
        // tells Steve the kind of work; Approval_Status whether it's cleared.
        var artworkStatus = (req.Artwork_Status || '').trim();
        if (artworkStatus) badges += '<span class="card-badge card-badge--artwork" title="' + escapeHtml(artworkStatus) + '">' + escapeHtml(shortArtworkStatus(artworkStatus)) + '</span>';
        var approvalStatus = (req.Approval_Status || '').trim();
        if (approvalStatus) {
            var apCls = /approved/i.test(approvalStatus) ? ' card-badge--approved' : ' card-badge--approval';
            badges += '<span class="card-badge' + apCls + '" title="' + escapeHtml(approvalStatus) + '">' + escapeHtml(shortApprovalStatus(approvalStatus)) + '</span>';
        }
        if (rushBadge)        badges += '<span class="card-badge card-badge--rush">RUSH</span>';
        if (orderType)        badges += '<span class="card-badge">' + escapeHtml(orderType) + '</span>';
        if (revCount > 0)     badges += '<span class="card-badge card-badge--revision">Rev ' + revCount + '</span>';
        if (due.text)         badges += '<span class="card-badge ' + due.cls + '">' + escapeHtml(due.text) + '</span>';

        // Bulk select mode — checkbox overlay + selection outline. Inline styles
        // (not new CSS) keep this module self-contained; pattern matches the
        // existing inline display toggles elsewhere in the gallery.
        var isSelected = selectMode && selectedIds.has(designId);
        var selectBoxHtml = '';
        if (selectMode) {
            selectBoxHtml = '<label class="sg-card-selectbox" style="position:absolute;top:8px;left:8px;z-index:6;background:rgba(255,255,255,.92);border-radius:6px;padding:5px;line-height:0;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3);">' +
                '<input type="checkbox" data-action="bulk-select"' + (isSelected ? ' checked' : '') +
                ' style="width:18px;height:18px;cursor:pointer;margin:0;" aria-label="Select ' + company + '">' +
            '</label>';
        }
        var selectStyle = selectMode
            ? ' style="position:relative;' + (isSelected ? 'outline:2px solid #4f46e5;outline-offset:2px;' : '') + '"'
            : '';

        return '<article class="mockup-card mockup-card--' + sKey + rushCls + onHoldCls + '" data-design-id="' + escapeHtml(designId) + '" data-status="' + sKey + '"' + selectStyle + '>' +
            selectBoxHtml +
            '<div class="card-header">' +
                '<div class="card-header-left">' +
                    '<div class="card-company">' + company + '</div>' +
                    // Rep first name appended to the design# line via inline span
                    // with a faint dot separator (see .card-rep-name in art-hub.css).
                    // Keeps the header 2 lines tall and gives Steve "which job + whose
                    // AE" in one glance. Replaces the redundant "Rep:" meta line that
                    // used to live below the thumbnail (removed 2026-04-26).
                    // Rep span carries data-action="filter-rep" + data-rep so the
                    // delegated grid click handler can fill the search box with
                    // the rep first name and filter to that rep's cards. See
                    // mount() for the click + getFiltered() for the search match.
                    (designNum
                        ? '<div class="card-design-number">#' + designNum +
                            (repFirstName ? '<span class="card-rep-name" data-action="filter-rep" data-rep="' + repFirstName + '" title="Click to filter by ' + repFirstName + '">' + repFirstName + '</span>' : '') +
                          '</div>'
                        : (repFirstName
                            ? '<div class="card-design-number"><span class="card-rep-name card-rep-name--standalone" data-action="filter-rep" data-rep="' + repFirstName + '" title="Click to filter by ' + repFirstName + '">' + repFirstName + '</span></div>'
                            : '')
                    ) +
                '</div>' +
                '<div class="card-header-right">' +
                    onHoldPillHtml +
                    '<span class="status-pill status-pill--' + sKey + '">' + escapeHtml(statusRaw) + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="card-thumb">' + thumbHtml + '</div>' +
            '<div class="card-body">' +
                (badges ? '<div class="card-badges">' + badges + '</div>' : '') +
                buildArtSpecLine(req) +
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
            if (currentStatus === 'broken') {
                // 'Link Broken' chip → only designs whose Box file currently 404s.
                // Bypasses on-hold exclusion: a broken link on a paused design is
                // still broken and should appear here.
                if (!brokenDesignIdSet.has(String(r.ID_Design))) return false;
            } else if (currentStatus === 'on-hold') {
                // 'On Hold' chip → only on-hold designs (regardless of underlying status)
                if (!r.Is_On_Hold) return false;
            } else if (currentStatus !== 'all') {
                // Granular status chips exclude on-hold so paused designs don't
                // pollute Steve's status backlogs.
                if (r.Is_On_Hold) return false;
                if (statusKey(r) !== currentStatus) return false;
            }
            // 'all' shows everything including on-hold (matches Phase 2 behavior)
            // Search filter — matches company, design#, ID, and rep first name
            // (resolved from Sales_Rep || User_Email). Lets the user filter
            // by typing "Nika" or by clicking a rep name in any card header
            // (which fills the search box).
            if (q) {
                var rep = getRepFirstName(r.Sales_Rep || r.User_Email).toLowerCase();
                var hay = (
                    (r.CompanyName || '') + ' ' +
                    (r.Design_Num_SW || '') + ' ' +
                    String(r.ID_Design || '') + ' ' +
                    rep
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
        // When the user clicks the Link Broken chip, also pop the existing
        // bulk-recover modal owned by art-hub-steve.js. Hidden pill button
        // is the bridge — clicking it re-opens the same modal Steve already
        // knows. Non-fatal if the button isn't present (e.g. steve.js not loaded).
        if (currentStatus === 'broken') {
            var pillBtn = document.getElementById('broken-mockups-review-btn');
            if (pillBtn && typeof pillBtn.click === 'function') {
                try { pillBtn.click(); } catch (e) { /* defensive */ }
            }
        }
    }

    // ─── Bulk multi-select (2026-07-05) ────────────────────────────────
    function companyFor(designId) {
        var req = allRequests.filter(function (r) { return String(r.ID_Design) === String(designId); })[0];
        return (req && req.CompanyName) || '';
    }

    function toggleSelectMode() {
        if (bulkInflight) return; // never flip mode mid-bulk-write
        selectMode = !selectMode;
        if (!selectMode) selectedIds.clear();
        var btn = document.getElementById('steve-gallery-select');
        if (btn) {
            btn.textContent = selectMode ? 'Cancel selection' : 'Select';
            btn.classList.toggle('sg-btn--active', selectMode);
        }
        renderGrid();
        updateBulkBar();
    }

    function setSelected(designId, on) {
        if (!designId) return;
        if (on) selectedIds.add(String(designId));
        else selectedIds.delete(String(designId));
        renderGrid();
        updateBulkBar();
    }

    function updateBulkBar() {
        var bar = document.getElementById('steve-gallery-bulkbar');
        if (!bar) return;
        if (!selectMode) { bar.style.display = 'none'; return; }
        bar.style.display = 'flex';
        var n = selectedIds.size;
        var countEl = document.getElementById('steve-gallery-bulk-count');
        if (countEl) countEl.textContent = n === 0 ? 'Tap cards to select' : n + ' selected';
        var completeBtn = document.getElementById('steve-gallery-bulk-complete');
        if (completeBtn && !bulkInflight) {
            completeBtn.disabled = n === 0;
            completeBtn.textContent = n > 0 ? 'Mark ' + n + ' Complete' : 'Mark Complete';
        }
    }

    // The ONE bulk action. Loops the SAME putComplete() the single-card button
    // uses (never a new write path), via Promise.allSettled so one failure
    // doesn't abort the rest. Failures stay selected + are listed visibly.
    function bulkMarkComplete() {
        if (bulkInflight) return;
        var ids = Array.from(selectedIds);
        if (!ids.length) return;
        var preview = ids.slice(0, 5).map(function (id) {
            var c = companyFor(id);
            return '#' + id + (c ? ' — ' + c : '');
        }).join('\n');
        if (ids.length > 5) preview += '\n… and ' + (ids.length - 5) + ' more';
        if (!confirm('Mark ' + ids.length + ' request(s) Complete?\n\n' + preview +
            '\n\nEach AE gets the same completion notification as the single-card Complete button.')) return;

        bulkInflight = true;
        var completeBtn = document.getElementById('steve-gallery-bulk-complete');
        if (completeBtn) { completeBtn.disabled = true; completeBtn.textContent = 'Marking…'; }

        Promise.allSettled(ids.map(function (id) { return putComplete(id); }))
            .then(function (results) {
                var failed = [];
                results.forEach(function (res, i) {
                    if (res.status === 'rejected') failed.push(ids[i]);
                });
                // Keep only the failed ones selected so Steve can retry them.
                selectedIds = new Set(failed);
                bulkInflight = false;
                return refresh().then(function () {
                    if (failed.length) {
                        updateBulkBar();
                        alert('Completed ' + (ids.length - failed.length) + ' of ' + ids.length +
                            ' request(s).\n\nFAILED (still selected — retry or use the card button):\n' +
                            failed.map(function (id) {
                                var c = companyFor(id);
                                return '#' + id + (c ? ' — ' + c : '');
                            }).join('\n'));
                    } else {
                        // All done — leave select mode (also clears selection + button label).
                        if (selectMode) toggleSelectMode();
                    }
                });
            })
            .catch(function (err) {
                // Defensive — allSettled shouldn't reject; refresh() errors render
                // their own visible state.
                bulkInflight = false;
                console.error('[SteveGallery.bulkMarkComplete] unexpected:', err);
                updateBulkBar();
            });
    }

    // ─── Display-time Auto-Heal (Layer 3) ──────────────────────────────
    // Cap auto-recover fires per page-load + dedup per pkId so a wave of broken
    // thumbnails doesn't hammer the Box Search API.
    var _galleryAutoRecover = {
        attempted: Object.create(null),
        fired: 0,
        cap: 10
    };

    function handleThumbError(img) {
        // Image had a src that failed to load → the Box link is broken (file
        // deleted, fileId stale, shared-link expired). Show a clear warning,
        // then kick off background auto-recovery — ~97% of breaks self-heal
        // when the design's Box folder still has the file.
        var thumb;
        try {
            thumb = img.parentNode;
            thumb.innerHTML =
                '<div class="card-thumb-broken" title="Click card to open detail page and re-upload">' +
                    '<div class="card-thumb-broken-icon">&#9888;</div>' +
                    '<div class="card-thumb-broken-title">Link broken</div>' +
                    '<div class="card-thumb-broken-hint">Click to re-upload</div>' +
                '</div>';
        } catch (e) { return; /* img already detached */ }

        // Background auto-recover ─────────────────────────────────────
        try {
            var card = thumb && thumb.closest ? thumb.closest('.mockup-card') : null;
            var designId = card && card.dataset ? card.dataset.designId : '';
            if (!designId) return;
            var req = allRequests.filter(function (r) { return String(r.ID_Design) === String(designId); })[0];
            if (!req || !req.PK_ID || !req.Design_Num_SW) return;
            var pkId = req.PK_ID;
            if (_galleryAutoRecover.attempted[pkId]) return;
            if (_galleryAutoRecover.fired >= _galleryAutoRecover.cap) return;
            _galleryAutoRecover.attempted[pkId] = true;
            _galleryAutoRecover.fired++;

            fetch(API_BASE + '/api/art-requests/' + encodeURIComponent(pkId) + '/auto-recover-mockup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    designNumber: String(req.Design_Num_SW),
                    companyName: req.CompanyName || ''
                })
            })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
            .then(function (resp) {
                if (resp.ok && resp.body && resp.body.success && resp.body.newUrl
                        && resp.body.confidence === 'high' && thumb && thumb.parentNode) {
                    // Mutate the in-memory record so a re-render keeps the URL.
                    req.Box_File_Mockup = resp.body.newUrl;
                    // Swap the broken card for a fresh image without touching the rest of the card.
                    thumb.innerHTML = '<img src="' + resp.body.newUrl + '"' +
                        ' alt="' + (req.CompanyName || 'mockup') + '" loading="lazy"' +
                        ' onerror="window.SteveGallery.handleThumbError(this)">';
                }
            })
            .catch(function () { /* silent — broken state already shown */ });
        } catch (err) { /* defensive — never break the page on recovery failure */ }
    }

    // Single source of truth for the "mark this design Completed" write.
    // PUT — the backend only registers PUT for this route (PATCH 404s, which
    // silently broke completion from the gallery). The PUT handler fires the
    // AE completion notification (email + Slack DM) server-side. `actor` is
    // this dashboard's owner so the Slack ping reads "Completed by Steve".
    // Used by the single-card Complete button AND the bulk action (which loops
    // this exact function — never a separate write path).
    function putComplete(designId) {
        return fetch(API_BASE + '/api/art-requests/' + encodeURIComponent(designId) + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Completed', actor: 'Steve' })
        }).then(function (r) {
            if (!r.ok) throw new Error('API ' + r.status);
            return r;
        });
    }

    function markComplete(designId, btn) {
        if (!designId) return;
        if (btn) { btn.disabled = true; btn.textContent = 'Marking…'; }
        putComplete(designId)
        .then(function () {
            return refresh();
        })
        .catch(function (err) {
            console.error('[SteveGallery.markComplete] failed:', err);
            alert('Failed to mark complete: ' + (err.message || err));
            if (btn) { btn.disabled = false; btn.textContent = 'Mark Complete'; }
        });
    }

    function refresh() {
        // Kick off broken-mockups fetch in parallel with the main requests
        // fetch — neither needs to block the other; the chip count just
        // updates after both resolve via the second renderStatusChips call.
        var brokenP = fetchBrokenMockups();
        return fetchRequests().then(function () {
            renderStatusChips();
            renderGrid();
            // Re-render chips once broken data lands so the count updates.
            return brokenP.then(renderStatusChips, renderStatusChips);
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

        // Kick off JDS catalog load so JDS card thumbnails resolve once it lands.
        loadJdsCatalog();

        host.innerHTML =
            '<div class="sg-toolbar">' +
                '<input type="search" id="steve-gallery-search" placeholder="Search company, design #, rep, or ID..." autocomplete="off">' +
                '<button type="button" id="steve-gallery-select" class="sg-btn" title="Select multiple cards for a bulk action">Select</button>' +
                '<button type="button" id="steve-gallery-archive" class="sg-btn">Show Archive</button>' +
                '<span id="steve-gallery-count" class="sg-count"></span>' +
            '</div>' +
            '<div id="steve-gallery-status" class="status-summary"></div>' +
            '<div id="steve-gallery-grid" class="mockup-grid"></div>' +
            '<div class="sg-load-more-wrap">' +
                '<button type="button" id="steve-gallery-load-more" class="sg-btn" style="display:none;"></button>' +
            '</div>' +
            // Bulk-action bar — sticky at the viewport bottom while select mode
            // is on. Inline styles keep the module standalone (no CSS edit).
            '<div id="steve-gallery-bulkbar" style="display:none;position:sticky;bottom:12px;z-index:40;margin-top:12px;padding:10px 16px;border-radius:10px;background:#1f2937;color:#f9fafb;box-shadow:0 4px 16px rgba(0,0,0,.35);align-items:center;gap:14px;">' +
                '<span id="steve-gallery-bulk-count" style="font-weight:600;">Tap cards to select</span>' +
                '<button type="button" id="steve-gallery-bulk-complete" class="sg-btn sg-btn--success" disabled>Mark Complete</button>' +
                '<button type="button" id="steve-gallery-bulk-cancel" class="sg-btn" style="margin-left:auto;">Done</button>' +
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

        // Bulk select controls
        document.getElementById('steve-gallery-select').addEventListener('click', toggleSelectMode);
        document.getElementById('steve-gallery-bulk-cancel').addEventListener('click', function () {
            if (selectMode) toggleSelectMode();
        });
        document.getElementById('steve-gallery-bulk-complete').addEventListener('click', bulkMarkComplete);

        // Card + action button clicks — delegated
        var grid = document.getElementById('steve-gallery-grid');
        grid.addEventListener('click', function (e) {
            // Select mode intercepts EVERY card click — checkbox, buttons, or
            // card body all just toggle selection; nothing navigates or opens
            // modals until Steve leaves select mode.
            if (selectMode) {
                var selCard = e.target.closest('.mockup-card');
                if (!selCard || !selCard.dataset.designId) return;
                var box = e.target.closest('input[data-action="bulk-select"]');
                if (box) {
                    // Checkbox already flipped natively — mirror its state.
                    setSelected(selCard.dataset.designId, box.checked);
                } else {
                    e.preventDefault();
                    setSelected(selCard.dataset.designId, !selectedIds.has(String(selCard.dataset.designId)));
                }
                return;
            }
            // Click rep name → fill search box with the rep first name. Filter
            // happens automatically via the search input's debounced listener.
            var repBtn = e.target.closest('.card-rep-name[data-action="filter-rep"]');
            if (repBtn) {
                e.preventDefault();
                e.stopPropagation();
                var name = repBtn.dataset.rep || '';
                var searchInput = document.getElementById('steve-gallery-search');
                if (searchInput && name) {
                    // If the search already shows this rep, treat the click as
                    // "clear filter" — toggle behavior.
                    var current = searchInput.value.trim().toLowerCase();
                    searchInput.value = (current === name.toLowerCase()) ? '' : name;
                    // Fire the same input event the typed search uses, so the
                    // existing 120ms debounce + applySearch() pipeline runs.
                    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    searchInput.focus();
                }
                return;
            }
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
                try { sessionStorage.setItem('artHubReturnTo', '/dashboards/art-hub-steve.html'); } catch (err) {}
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
        toggleSelectMode: toggleSelectMode,
        isActive: isActive
    };
})();
