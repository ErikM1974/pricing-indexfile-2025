/**
 * art-ae.js — AE Art Request Gallery (maroon cards)
 *
 * Renders Steve's art request cards in the AE Dashboard "Steve Mockups" tab.
 * Replaces the old Caspio DataPage embed for full CSS control.
 * Cards link to /art-request/:id?view=ae for review.
 *
 * Usage: ArtAeGallery.init('container-id')
 *
 * Depends on: art-hub.css (reuses card styles), app-config.js
 */
var ArtAeGallery = (function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    var DAYS_DEFAULT = 90;
    var DATE_CUTOFF = '2026-03-15';
    var SELECT_FIELDS = 'PK_ID,ID_Design,CompanyName,Design_Num_SW,Status,Order_Type,Order_Type_Source,Item_Type,JDS_SKU,Sales_Rep,User_Email,Due_Date,Date_Created,Approval_Sent_Date,Full_Name_Contact,Garment_Placement,Box_File_Mockup,BoxFileLink,Company_Mockup,Revision_Count,Art_Minutes,Prelim_Charges,Amount_Art_Billed,NOTES,Mockup,Is_On_Hold,On_Hold_Since,On_Hold_Note';
    // Legacy fallback for installs that don't have Item_Type / JDS_SKU yet —
    // strip them and retry. NULL Item_Type → 'Garment' at render time
    // (resolveItemType).
    var SELECT_FIELDS_LEGACY = SELECT_FIELDS
        .replace(',Item_Type', '')
        .replace(',JDS_SKU', '')
        .replace(',Order_Type_Source', '');

    function resolveItemType(raw) {
        if (raw === 'Sticker' || raw === 'Banner' || raw === 'JDS') return raw;
        return 'Garment';
    }

    var containerId = null;
    var allRequests = [];
    var activeFilter = null;
    var searchTerm = '';
    var showAll = false;
    var showArchive = false;
    // Bucket filter: 'needs-review' | 'with-steve' | 'done' | 'all'.
    // null on first render — render() picks 'needs-review' if there's anything
    // to review, else 'all'. After that the user owns it.
    var currentBucketFilter = null;

    function getDateFrom(days) {
        var cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return cutoff.toISOString().split('T')[0];
    }

    function init(containerIdParam) {
        containerId = containerIdParam;
        var container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">'
            + '<div style="width:30px;height:30px;border:3px solid #e5e7eb;border-top-color:#981e32;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div>'
            + 'Loading art requests...</div>';

        activeFilter = null;
        searchTerm = '';
        showAll = false;
        currentBucketFilter = null;
        fetchRequests();
    }

    function fetchRequests() {
        var url = API_BASE + '/api/artrequests?orderBy=Date_Created DESC&limit=200'
            + '&select=' + SELECT_FIELDS;

        if (showArchive) {
            // Show all records when archive is on
        } else {
            url += '&dateCreatedFrom=' + DATE_CUTOFF;
        }

        fetch(url)
            .then(function (r) {
                if (r.status === 500) {
                    // Caspio rejects unknown q.select fields with 500 — retry without Item_Type
                    var legacyUrl = url.replace('&select=' + SELECT_FIELDS, '&select=' + SELECT_FIELDS_LEGACY);
                    return fetch(legacyUrl).then(function (r2) {
                        if (!r2.ok) throw new Error('API returned ' + r2.status);
                        return r2.json();
                    });
                }
                if (!r.ok) throw new Error('API returned ' + r.status);
                return r.json();
            })
            .then(function (data) {
                allRequests = Array.isArray(data) ? data : [];
                render();
            })
            .catch(function (err) {
                var container = document.getElementById(containerId);
                if (container) {
                    container.innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626;">'
                        + '<strong>Error:</strong> ' + escapeHtml(err.message)
                        + '<br><button onclick="ArtAeGallery.init(\'' + containerId + '\')" '
                        + 'style="margin-top:10px;padding:8px 16px;border:none;border-radius:4px;background:#981e32;color:white;cursor:pointer;">Retry</button>'
                        + '</div>';
                }
            });
    }

    // Map a Caspio status to its display bucket. Fallthrough → 'with-steve'
    // is the safety net: null/blank/typo'd statuses still appear in a chip
    // rather than vanishing from the gallery.
    function bucketFor(status) {
        var s = normalizeStatus(status);
        if (s === 'Awaiting Approval') return 'needs-review';
        if (s === 'Approved' || s === 'Completed') return 'done';
        return 'with-steve';
    }

    function countByBucket(requests) {
        var counts = { needsReview: 0, withSteve: 0, done: 0, onHold: 0, all: 0 };
        requests.forEach(function (r) {
            counts.all++;
            // On-hold designs get their own bucket and are EXCLUDED from the
            // 4 status buckets — keeps "Needs Your Review" backlog accurate.
            if (r.Is_On_Hold) {
                counts.onHold++;
                return;
            }
            var b = bucketFor(r.Status);
            if (b === 'needs-review') counts.needsReview++;
            else if (b === 'done') counts.done++;
            else counts.withSteve++;
        });
        var sum = counts.needsReview + counts.withSteve + counts.done + counts.onHold;
        if (sum !== counts.all) {
            console.warn('[ArtAeGallery] bucket sum ' + sum + ' !== total ' + counts.all
                + ' — some requests were not categorized. Check normalizeStatus().');
        }
        return counts;
    }

    /**
     * Sort comparator that puts the longest-waiting Awaiting-Approval request
     * at the top — urgency-first ordering for the AE's action queue.
     * Items without an Approval_Sent_Date sort to the bottom (we don't know
     * how urgent they are, so they yield to ones we can measure).
     * Used only inside the 'needs-review' bucket; other buckets keep the
     * default Date_Created DESC fetch order so look-up flows feel familiar.
     */
    function sortByLongestWaiting(a, b) {
        var aTime = a.Approval_Sent_Date ? new Date(a.Approval_Sent_Date).getTime() : NaN;
        var bTime = b.Approval_Sent_Date ? new Date(b.Approval_Sent_Date).getTime() : NaN;
        if (isNaN(aTime) && isNaN(bTime)) return 0;
        if (isNaN(aTime)) return 1;   // a → bottom
        if (isNaN(bTime)) return -1;  // a → top
        return aTime - bTime;          // ASC: oldest first (most urgent at top)
    }

    function getFilteredRequests() {
        var list = allRequests;
        if (currentBucketFilter === 'on-hold') {
            // 'On Hold' chip → only on-hold designs, regardless of underlying status
            list = list.filter(function (r) { return !!r.Is_On_Hold; });
        } else if (currentBucketFilter && currentBucketFilter !== 'all') {
            // Status buckets exclude on-hold (they shouldn't pollute "Needs Review" etc.)
            list = list.filter(function (r) {
                return !r.Is_On_Hold && bucketFor(r.Status) === currentBucketFilter;
            });
        }
        // 'all' shows everything including on-hold (existing behavior preserved)
        if (searchTerm) {
            var term = searchTerm.toLowerCase();
            list = list.filter(function (r) {
                var company = (r.CompanyName || '').toLowerCase();
                var designNum = (r.Design_Num_SW || r.Design_Number || '').toLowerCase();
                var contact = (r.Full_Name_Contact || '').toLowerCase();
                // Rep first name (Sales_Rep || User_Email local-part) — lets the
                // user filter by typing "Nika" or by clicking a rep name in any
                // card header (which fills the search box).
                var rawRep = r.Sales_Rep || extractRepFromEmail(r.User_Email);
                var repFirst = rawRep ? String(rawRep).split(/\s+/)[0].toLowerCase() : '';
                return company.indexOf(term) !== -1
                    || designNum.indexOf(term) !== -1
                    || contact.indexOf(term) !== -1
                    || (repFirst && repFirst.indexOf(term) !== -1);
            });
        }
        // Bucket-aware sort: Needs Your Review = urgency queue (oldest waiting
        // at top). Other buckets keep the fetched Date_Created DESC order
        // since they're look-up / history flows where newest-first is correct.
        if (currentBucketFilter === 'needs-review') {
            list = list.slice().sort(sortByLongestWaiting);
        }
        return list;
    }

    function render() {
        var container = document.getElementById(containerId);
        if (!container) return;

        if (allRequests.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#999;">'
                + '<div style="font-size:48px;margin-bottom:12px;">&#127912;</div>'
                + '<div style="font-size:16px;font-weight:500;">No art requests found</div>'
                + '</div>';
            return;
        }

        // Bucket counts. normalizeStatus() maps null/blank/typos → 'Submitted'
        // so they fall into 'with-steve' (the catch-all bucket) and never vanish.
        var counts = countByBucket(allRequests);

        // First render: pick the default. If the AE has nothing to review,
        // open on All so they see their full pipeline instead of an empty state.
        if (currentBucketFilter === null) {
            currentBucketFilter = (counts.needsReview > 0) ? 'needs-review' : 'all';
        }

        var html = '';

        // Date range indicator with archive toggle
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">';
        if (showArchive) {
            html += '<span style="font-size:13px;color:#6b7280;">Showing all requests including archive (' + allRequests.length + ')</span>'
                + '<button onclick="ArtAeGallery.toggleArchive()" '
                + 'style="padding:4px 12px;border:1px solid #981e32;border-radius:4px;background:#fef2f2;cursor:pointer;font-size:13px;font-family:inherit;color:#981e32;font-weight:600;">'
                + 'Hide Archive</button>';
        } else {
            html += '<span style="font-size:13px;color:#6b7280;">Showing current requests (' + allRequests.length + ')</span>'
                + '<button onclick="ArtAeGallery.toggleArchive()" '
                + 'style="padding:4px 12px;border:1px solid #d1d5db;border-radius:4px;background:white;cursor:pointer;font-size:13px;font-family:inherit;color:#666;">'
                + 'Show Archive</button>';
        }
        html += '</div>';

        // Search bar
        html += '<div style="display:flex;gap:12px;margin-bottom:16px;align-items:center;flex-wrap:wrap;">'
            + '<div style="flex:1;min-width:200px;max-width:340px;position:relative;">'
            + '<input type="text" id="art-ae-search" placeholder="Search company, design #, contact, or rep..." '
            + 'value="' + escapeHtml(searchTerm) + '" '
            + 'style="width:100%;padding:8px 12px 8px 34px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:inherit;">'
            + '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#9ca3af;font-size:16px;">&#128269;</span>'
            + '</div>'
            + '</div>';

        // 4-bucket status summary. AE-centric labels:
        //   Needs Your Review = Awaiting Approval (only thing AE acts on)
        //   With Steve        = Submitted + In Progress + Revision Requested (waiting)
        //   Done              = Approved + Completed
        //   All               = escape hatch, always visible
        var bucketChips = [
            { key: 'needs-review', label: 'Needs Your Review', count: counts.needsReview, modifier: 'needs-review' },
            { key: 'with-steve',   label: 'With Steve',        count: counts.withSteve,   modifier: 'with-steve' },
            { key: 'done',         label: 'Done',              count: counts.done,        modifier: 'done' },
            { key: 'on-hold',      label: 'On Hold',           count: counts.onHold,      modifier: 'on-hold' },
            { key: 'all',          label: 'All',               count: counts.all,         modifier: 'all' }
        ];
        html += '<div class="status-summary">';
        bucketChips.forEach(function (c) {
            var active = currentBucketFilter === c.key ? ' active' : '';
            html += '<div class="status-stat status-stat--' + c.modifier + active + '" '
                + 'data-bucket="' + c.key + '" title="' + escapeHtml(c.label) + '">'
                + '<span class="status-stat-count">' + c.count + '</span>'
                + '<span class="status-stat-label">' + escapeHtml(c.label) + '</span></div>';
        });
        html += '</div>';

        // Card grid
        var filtered = getFilteredRequests();
        html += '<div class="mockup-grid">';
        if (filtered.length === 0) {
            html += '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999;">No matching requests</div>';
        }
        filtered.forEach(function (r) {
            html += buildCard(r);
        });
        html += '</div>';

        container.innerHTML = html;

        // Wire search
        var searchInput = document.getElementById('art-ae-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                searchTerm = this.value.trim();
                renderCards();
            });
        }

        // Wire bucket chip clicks. Click any chip → switch the bucket filter.
        // Re-runs render() so the chip's .active state and the count of visible
        // cards update together.
        var summary = container.querySelector('.status-summary');
        if (summary) {
            summary.addEventListener('click', function (e) {
                var chip = e.target.closest('.status-stat[data-bucket]');
                if (!chip) return;
                var key = chip.dataset.bucket;
                if (!key || key === currentBucketFilter) return;
                currentBucketFilter = key;
                render();
            });
        }

        // Wire card clicks
        wireCardClicks(container);
    }

    function renderCards() {
        var container = document.getElementById(containerId);
        if (!container) return;
        var grid = container.querySelector('.mockup-grid');
        if (!grid) return;

        var filtered = getFilteredRequests();
        var html = '';
        if (filtered.length === 0) {
            html = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999;">No matching requests</div>';
        }
        filtered.forEach(function (r) { html += buildCard(r); });
        grid.innerHTML = html;
        wireCardClicks(container);
    }

    function wireCardClicks(container) {
        container.querySelectorAll('.mockup-card[data-design-id]').forEach(function (card) {
            card.addEventListener('click', function (e) {
                // Don't navigate if they clicked a link
                if (e.target.closest('a')) return;
                // Click rep name → fill search box, filter to that rep. Stops
                // propagation so the card-level click below doesn't navigate.
                var repBtn = e.target.closest('.card-rep-name[data-action="filter-rep"]');
                if (repBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    var name = repBtn.dataset.rep || '';
                    var input = document.getElementById('art-ae-search');
                    if (input && name) {
                        var current = input.value.trim().toLowerCase();
                        input.value = (current === name.toLowerCase()) ? '' : name;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.focus();
                    }
                    return;
                }
                var id = card.dataset.designId;
                if (id) window.location.href = '/art-request/' + id + '?view=ae';
            });
        });
    }

    function toggleArchive() {
        showArchive = !showArchive;
        activeFilter = null;
        searchTerm = '';
        currentBucketFilter = null;
        fetchRequests();
    }

    function toggleDateRange() {
        showAll = !showAll;
        activeFilter = null;
        searchTerm = '';
        var container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">'
                + '<div style="width:30px;height:30px;border:3px solid #e5e7eb;border-top-color:#981e32;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div>'
                + 'Loading art requests...</div>';
        }
        fetchRequests();
    }

    function statusPill(count, label, filterValue, modifier) {
        var clickAttr = filterValue
            ? ' onclick="ArtAeGallery.filterByStatus(\'' + filterValue + '\')"'
            : '';
        return '<div class="status-stat status-stat--' + modifier + '" title="' + label + '"' + clickAttr + '>'
            + '<span class="status-stat-count">' + count + '</span>'
            + '<span class="status-stat-label">' + label + '</span></div>';
    }

    function buildCard(req) {
        var designId = req.ID_Design || req.PK_ID;
        var company = escapeHtml(req.CompanyName || 'Unknown');
        var designNum = escapeHtml(req.Design_Num_SW || req.Design_Number || '—');
        var status = normalizeStatus(req.Status);
        var statusClass = 'status-pill--' + status.toLowerCase().replace(/\s+/g, '-');
        var isOnHold = !!req.Is_On_Hold;
        var onHoldClass = isOnHold ? ' mockup-card--on-hold' : '';
        var onHoldPillHtml = isOnHold
            ? '<span class="status-pill status-pill--on-hold" title="' + escapeHtml(req.On_Hold_Note || 'On hold — customer paused this design') + '">On Hold</span> '
            : '';
        var orderType = getOrderType(req);
        var dueDate = req.Due_Date;
        var createdDate = formatDate(req.Date_Created);
        var contact = escapeHtml(req.Full_Name_Contact || '');
        var revCount = req.Revision_Count || 0;
        // Sales_Rep || User_Email (email-local capitalized) per MEMORY.md convention.
        // First whitespace-token only — full names like "Erik Mickelson" become "Erik"
        // for the inline header treatment (#designNum · Erik). Same pattern as
        // Steve's gallery (v2026.04.26.10).
        var rawRep = req.Sales_Rep || extractRepFromEmail(req.User_Email);
        var repFirstName = rawRep ? escapeHtml(String(rawRep).split(/\s+/)[0]) : '';
        var artMinutes = req.Art_Minutes || 0;
        var quotedArt = req.Prelim_Charges;
        var actualArt = req.Amount_Art_Billed;
        var notes = req.NOTES || '';

        // Thumbnail
        var thumbUrl = req.Box_File_Mockup || req.BoxFileLink || req.Company_Mockup || '';
        var thumbHtml = '';
        if (thumbUrl) {
            thumbHtml = '<div class="card-thumb">'
                + '<img src="' + escapeHtml(thumbUrl) + '" alt="Mockup" loading="lazy"'
                + ' data-original-src="' + escapeHtml(thumbUrl) + '"'
                + ' onerror="if(window.ArtActions&&window.ArtActions.handleBoxImageError){window.ArtActions.handleBoxImageError(this);}else{this.parentElement.style.display=\'none\';}">'
                + '</div>';
        }

        // Badges
        var badges = '';
        // Item-type badge — only when not Garment (default)
        var itemType = resolveItemType(req.Item_Type);
        if (itemType === 'Sticker' || itemType === 'Banner') {
            var itEmoji = itemType === 'Sticker' ? '\u{1F3F7}' : '\u{1F38C}';
            var itCls = itemType === 'Sticker' ? 'card-badge--sticker' : 'card-badge--banner';
            badges += '<span class="card-badge ' + itCls + '" title="' + itemType + ' request">' + itEmoji + ' ' + itemType + '</span>';
        } else if (itemType === 'JDS') {
            var jdsTitle = req.JDS_SKU ? ('JDS request — ' + req.JDS_SKU) : 'JDS vendor product request';
            badges += '<span class="card-badge card-badge--jds" title="' + escapeHtml(jdsTitle) + '">\u{1F3AF} JDS' + (req.JDS_SKU ? ' · ' + escapeHtml(req.JDS_SKU) : '') + '</span>';
        }
        if (orderType) {
            badges += '<span class="card-badge">' + escapeHtml(orderType) + '</span>';
        }
        if (revCount > 0) {
            badges += '<span class="card-badge card-badge--revision">Rev ' + revCount + '</span>';
        }

        // Due date urgency
        var dueDateHtml = '';
        if (dueDate) {
            var due = getDueInfo(dueDate);
            dueDateHtml = '<span class="card-due ' + due.cssClass + '">' + due.text + '</span>';
        }

        // Art charge
        var artChargeHtml = '';
        if (quotedArt || actualArt) {
            var quoted = quotedArt ? '$' + Number(quotedArt).toFixed(2) : '—';
            var actual = actualArt ? '$' + Number(actualArt).toFixed(2) : 'No time logged';
            var hrs = artMinutes ? (artMinutes / 60).toFixed(2) + ' hrs' : '';
            artChargeHtml = '<div class="card-art-charge">'
                + '<span class="card-art-label">ART CHARGE</span>'
                + '<div class="card-art-row"><span class="card-art-quoted">QUOTED</span> ' + quoted + (hrs ? ' &middot; ' + hrs : '') + '</div>';
            if (actualArt) {
                artChargeHtml += '<div class="card-art-row"><span class="card-art-actual">ACTUAL</span> <strong>' + actual + '</strong></div>';
            }
            artChargeHtml += '</div>';
        }

        // Contact
        var contactHtml = contact
            ? '<div class="card-meta-row"><span class="card-meta-label">CONTACT</span> ' + contact + '</div>'
            : '';

        // Rep meta-row removed 2026-04-26 — promoted to header inline with
        // designNum (see card-design-number block below). Keeps cards tighter.

        var elapsedBadge = (typeof ElapsedTimeUtils !== 'undefined')
            ? ElapsedTimeUtils.getStatusElapsedBadge(status, req, 'art')
            : '';

        return '<div class="mockup-card art-card' + onHoldClass + '" data-design-id="' + designId + '" style="cursor:pointer;">'
            + '<div class="card-header" style="background:var(--art-theme, #981e32);">'
            + '  <div class="card-header-left">'
            + '    <div class="card-company">' + company + '</div>'
            + '    <div class="card-design-number">#' + designNum
            +        (repFirstName ? '<span class="card-rep-name" data-action="filter-rep" data-rep="' + repFirstName + '" title="Click to filter by ' + repFirstName + '">' + repFirstName + '</span>' : '')
            +      '</div>'
            + '  </div>'
            + '  <div class="card-header-right">'
            + '    ' + onHoldPillHtml
            + '    <span class="status-pill ' + statusClass + '">' + escapeHtml(status) + '</span>'
            + '  </div>'
            + '</div>'
            + thumbHtml
            + '<div class="card-body">'
            + '<div class="card-status-row">'
            + (dueDateHtml || '')
            + '</div>'
            + (badges ? '<div class="card-badges">' + badges + '</div>' : '')
            + contactHtml
            + artChargeHtml
            + (elapsedBadge ? '<div style="margin-top:6px;">' + elapsedBadge + '</div>' : '')
            + '</div>'
            + '<div class="card-footer">'
            + '  <span class="card-date">' + createdDate + '</span>'
            + '  <span class="card-action-link">View Details &rarr;</span>'
            + '</div>'
            + '</div>';
    }

    function normalizeStatus(raw) {
        if (!raw || raw === '') return 'Submitted';
        var s = String(raw).trim();
        // Handle object (Caspio dropdown)
        if (typeof raw === 'object') {
            var vals = Object.values(raw);
            s = vals.length > 0 ? String(vals[0]).trim() : 'Submitted';
        }
        // Normalize known statuses
        var lower = s.toLowerCase();
        if (lower === 'submitted' || lower === '') return 'Submitted';
        if (lower === 'in progress') return 'In Progress';
        if (lower === 'awaiting approval') return 'Awaiting Approval';
        if (lower === 'completed' || lower === 'complete') return 'Completed';
        if (lower.indexOf('revision') !== -1) return 'Revision Requested';
        return s;
    }

    function parseOrderType(val) {
        if (!val) return '';
        if (typeof val === 'object') {
            var vals = Object.values(val);
            return vals.length > 0 ? String(vals[0]) : '';
        }
        return String(val);
    }

    /**
     * Coalesce Order_Type (legacy Garment DataPage multi-select) with
     * Order_Type_Source (new REST forms — plain Text 255). Each record has
     * exactly one populated; never both. The multi-select REST limitation
     * forced the parallel column. See MEMORY.md "Critical Patterns".
     */
    function getOrderType(req) {
        var fromMulti = parseOrderType(req && req.Order_Type);
        if (fromMulti) return fromMulti;
        return (req && req.Order_Type_Source) ? String(req.Order_Type_Source) : '';
    }

    function extractRepFromEmail(email) {
        if (!email) return '';
        var name = email.split('@')[0];
        if (!name) return '';
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    function getDueInfo(dueDateStr) {
        var due = new Date(dueDateStr);
        if (isNaN(due.getTime())) return { text: '', cssClass: '' };

        var now = new Date();
        now.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        var diffDays = Math.round((due - now) / 86400000);

        if (diffDays < 0) return { text: 'Overdue ' + Math.abs(diffDays) + 'd', cssClass: 'card-due--overdue' };
        if (diffDays === 0) return { text: 'Due Today', cssClass: 'card-due--today' };
        if (diffDays === 1) return { text: 'Due Tomorrow', cssClass: 'card-due--soon' };
        if (diffDays <= 3) return { text: 'Due in ' + diffDays + ' Days', cssClass: 'card-due--soon' };
        return { text: formatDate(dueDateStr), cssClass: '' };
    }

    // Legacy API — externals may still call these. Translate the requested
    // status to its bucket so the bucket UI stays consistent.
    function filterByStatus(status) {
        currentBucketFilter = bucketFor(status);
        render();
    }

    function clearFilter() {
        currentBucketFilter = 'all';
        render();
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // ── Kanban Board View ───────────────────────────────────────────────
    var kanbanActive = false;
    var KANBAN_DATE_CUTOFF = '2026-03-15';
    var COMPLETED_SHOW_LIMIT = 5;

    var KANBAN_COLUMNS = [
        { id: 'submitted', label: 'Submitted', match: ['Submitted'] },
        { id: 'in-progress', label: 'In Progress', match: ['In Progress'] },
        { id: 'awaiting', label: 'Awaiting Approval', match: ['Awaiting Approval'] },
        { id: 'revision', label: 'Revision Requested', match: ['Revision Requested'] },
        { id: 'approved', label: 'Approved', match: ['Approved'] },
        { id: 'completed', label: 'Completed', match: ['Completed'] }
    ];

    function getDueBadge(dueDateStr) {
        if (!dueDateStr) return { text: '', cls: '' };
        var due = new Date(dueDateStr);
        if (isNaN(due.getTime())) return { text: '', cls: '' };
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        var diffDays = Math.round((due - today) / 86400000);
        if (diffDays < 0) return { text: 'OVERDUE', cls: 'kanban-card-due--overdue' };
        if (diffDays === 0) return { text: 'Due Today', cls: 'kanban-card-due--soon' };
        if (diffDays === 1) return { text: 'Due Tomorrow', cls: 'kanban-card-due--soon' };
        if (diffDays <= 7) {
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return { text: 'Due ' + months[due.getMonth()] + ' ' + due.getDate(), cls: 'kanban-card-due--ok' };
        }
        return { text: 'Upcoming', cls: 'kanban-card-due--ok' };
    }

    function renderAeKanbanCard(req) {
        var company = escapeHtml(req.CompanyName || 'Unknown');
        var designNum = req.Design_Num_SW || '';
        var designId = req.ID_Design || '';
        var rep = escapeHtml(req.Sales_Rep || '');
        var revCount = req.Revision_Count || 0;
        var due = getDueBadge(req.Due_Date);

        var orderType = getOrderType(req);

        var badges = '';
        if (orderType) badges += '<span class="kanban-card-badge kanban-card-badge--type">' + escapeHtml(orderType) + '</span>';
        if (revCount > 0) badges += '<span class="kanban-card-badge kanban-card-badge--rev">Rev ' + revCount + '</span>';

        var kanbanElapsed = (typeof ElapsedTimeUtils !== 'undefined')
            ? ElapsedTimeUtils.getKanbanElapsedBadge(req.Status || '', req, 'art')
            : '';

        return '<div class="kanban-card" data-design-id="' + designId + '" onclick="window.open(\'/art-request/' + designId + '?view=ae\', \'_blank\')">'
            + '<div class="kanban-card-company">' + company + kanbanElapsed + '</div>'
            + (designNum ? '<div class="kanban-card-design">#' + escapeHtml(designNum) + '</div>' : '')
            + '<div class="kanban-card-meta">'
            + '<span class="kanban-card-rep">' + rep + '</span>'
            + (due.text ? '<span class="kanban-card-due ' + due.cls + '">' + escapeHtml(due.text) + '</span>' : '')
            + '</div>'
            + (badges ? '<div class="kanban-card-badges">' + badges + '</div>' : '')
            + '</div>';
    }

    window.toggleAeKanbanView = function (view) {
        var galleryView = document.getElementById('art-ae-gallery');
        var boardView = document.getElementById('ae-kanban-board');
        var toggleBtns = document.querySelectorAll('#ae-view-toggle .view-toggle-btn');
        if (!galleryView || !boardView) return;

        kanbanActive = (view === 'board');

        toggleBtns.forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        if (kanbanActive) {
            galleryView.style.display = 'none';
            boardView.classList.add('active');
            buildAeKanbanBoard();
        } else {
            galleryView.style.display = '';
            boardView.classList.remove('active');
        }
    };

    // Collapse/expand helpers (shared via window)
    window.toggleKanbanCollapse = window.toggleKanbanCollapse || function (colId, storageKey) {
        var col = document.querySelector('.kanban-column--' + colId);
        if (!col) return;
        col.classList.toggle('kanban-column--collapsed');
        localStorage.setItem(storageKey, col.classList.contains('kanban-column--collapsed') ? '1' : '0');
    };
    window.kanbanShowAll = window.kanbanShowAll || function (colId) {
        var col = document.querySelector('.kanban-column--' + colId);
        if (!col) return;
        col.querySelectorAll('.kanban-card[style*="display: none"]').forEach(function (c) { c.style.display = ''; });
        var link = col.querySelector('.kanban-show-all');
        if (link) link.remove();
    };

    function buildAeKanbanBoard() {
        var board = document.getElementById('ae-kanban-board');
        if (!board) return;

        // Filter to date cutoff
        var cutoff = new Date(KANBAN_DATE_CUTOFF);
        var filtered = allRequests.filter(function (r) {
            if (!r.Date_Created) return false;
            return new Date(r.Date_Created) >= cutoff;
        });

        // Group into buckets
        var buckets = {};
        KANBAN_COLUMNS.forEach(function (col) { buckets[col.id] = []; });

        filtered.forEach(function (req) {
            var status = normalizeStatus(req.Status);
            var placed = false;
            KANBAN_COLUMNS.forEach(function (col) {
                if (!placed && col.match.indexOf(status) !== -1) {
                    buckets[col.id].push(req);
                    placed = true;
                }
            });
            if (!placed) buckets['submitted'].push(req);
        });

        var completedCollapsed = localStorage.getItem('aeKanbanCompletedCollapsed') !== '0';

        board.innerHTML = KANBAN_COLUMNS.map(function (col) {
            var colCards = buckets[col.id] || [];
            var isCompleted = col.id === 'completed';

            var cardsHtml = '';
            if (isCompleted && colCards.length > COMPLETED_SHOW_LIMIT) {
                cardsHtml = colCards.slice(0, COMPLETED_SHOW_LIMIT).map(function (r) { return renderAeKanbanCard(r); }).join('');
                cardsHtml += colCards.slice(COMPLETED_SHOW_LIMIT).map(function (r) {
                    return renderAeKanbanCard(r).replace('class="kanban-card"', 'class="kanban-card" style="display: none"');
                }).join('');
                cardsHtml += '<div class="kanban-show-all" onclick="event.stopPropagation(); window.kanbanShowAll(\'' + col.id + '\')">Show all ' + colCards.length + ' items</div>';
            } else {
                cardsHtml = colCards.map(function (r) { return renderAeKanbanCard(r); }).join('');
            }

            var chevron = isCompleted ? '<span class="kanban-collapse-chevron">&#9660;</span>' : '';
            var collapseClass = (isCompleted && completedCollapsed) ? ' kanban-column--collapsed' : '';
            var clickHandler = isCompleted ? ' onclick="window.toggleKanbanCollapse(\'' + col.id + '\', \'aeKanbanCompletedCollapsed\')"' : '';

            return '<div class="kanban-column kanban-column--' + col.id + collapseClass + '">'
                + '<div class="kanban-column-header"' + clickHandler + '>'
                + chevron
                + '<span>' + col.label + '</span>'
                + '<span class="kanban-column-count">' + colCards.length + '</span>'
                + '</div>'
                + '<div class="kanban-column-body">' + cardsHtml + '</div>'
                + '</div>';
        }).join('');
    }

    return {
        init: init,
        filterByStatus: filterByStatus,
        clearFilter: clearFilter,
        toggleDateRange: toggleDateRange,
        toggleArchive: toggleArchive
    };

})();
