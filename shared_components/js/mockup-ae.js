/**
 * mockup-ae.js — AE Mockup Gallery (purple cards)
 *
 * Renders mockup cards in the AE Dashboard "Mockups" tab.
 * Cards link to /mockup/:id?view=ae for approval/review.
 *
 * Usage: MockupAeGallery.init('container-id')
 *
 * Depends on: mockup-ruth.css (reuses card styles), app-config.js
 */
var MockupAeGallery = (function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    var containerId = null;
    var allMockups = [];
    var currentRepFilter = sessionStorage.getItem('ae_dashboard_rep_filter') || 'All';
    var currentSearchText = '';
    // Bucket filter: 'needs-review' | 'with-ruth' | 'done' | 'all'.
    // null on first render — render() picks 'needs-review' if there's anything
    // to review, else 'all'. After that the user owns it.
    var currentBucketFilter = null;

    var REP_EMAIL_MAP = {
        'Taneisha': 'taneisha@nwcustomapparel.com',
        'Nika': 'nika@nwcustomapparel.com',
        'Ruthie': 'ruthie@nwcustomapparel.com',
        'Erik': 'erik@nwcustomapparel.com'
    };

    function resolveRepName(email) {
        if (!email) return '';
        for (var name in REP_EMAIL_MAP) {
            if (email.toLowerCase() === REP_EMAIL_MAP[name].toLowerCase()) return name;
        }
        var at = email.indexOf('@');
        if (at > 0) return email.substring(0, at).charAt(0).toUpperCase() + email.substring(1, at);
        return email;
    }

    function init(containerIdParam) {
        containerId = containerIdParam;
        var container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">'
            + '<div class="mockup-loading-spinner" style="width:30px;height:30px;border:3px solid #e5e7eb;border-top-color:#6B46C1;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div>'
            + 'Loading mockups...</div>';

        currentBucketFilter = null;
        fetchMockups();
    }

    function fetchMockups() {
        // Sort by ID DESC, not Submitted_Date — recent records have null
        // Submitted_Date (Caspio field type changed away from auto-populated
        // Timestamp) and would otherwise sort to the bottom under 41 Completed
        // records. ID is auto-increment, always populated, monotonic by submission.
        fetch(API_BASE + '/api/mockups?orderBy=ID DESC&limit=200')
            .then(function (r) {
                if (!r.ok) throw new Error('API returned ' + r.status);
                return r.json();
            })
            .then(function (data) {
                allMockups = data.records || [];
                render();
            })
            .catch(function (err) {
                var container = document.getElementById(containerId);
                if (container) {
                    container.innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626;">'
                        + '<strong>Error:</strong> ' + escapeHtml(err.message)
                        + '<br><button onclick="MockupAeGallery.init(\'' + containerId + '\')" '
                        + 'style="margin-top:10px;padding:8px 16px;border:none;border-radius:4px;background:#6B46C1;color:white;cursor:pointer;">Retry</button>'
                        + '</div>';
                }
            });
    }

    function render() {
        var container = document.getElementById(containerId);
        if (!container) return;

        if (allMockups.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#999;">'
                + '<div style="font-size:48px;margin-bottom:12px;">&#128194;</div>'
                + '<div style="font-size:16px;font-weight:500;">No mockup requests yet</div>'
                + '</div>';
            return;
        }

        // Bucket counts. normalizeStatus() maps null/blank/typos → 'Submitted'
        // so they fall into 'with-ruth' (the catch-all bucket) and never vanish.
        var counts = countByBucket(allMockups);

        // First render: pick the default. If the AE has nothing to review,
        // open on All so they see their full pipeline instead of an empty state.
        if (currentBucketFilter === null) {
            currentBucketFilter = (counts.needsReview > 0) ? 'needs-review' : 'all';
        }

        // 4-bucket status summary. AE-centric labels:
        //   Needs Your Review = Awaiting Approval (only thing AE acts on)
        //   With Ruth         = Submitted + In Progress + Revision Requested (waiting)
        //   Done              = Approved + Completed
        //   All               = escape hatch, always visible
        var html = buildBucketChipsHtml(counts);

        // Search + Rep filter bar
        var repOptions = ['All', 'Taneisha', 'Nika', 'Ruthie', 'Erik'];
        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;margin:0 0 12px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);flex-wrap:wrap;">';
        html += '<input type="text" id="mockup-ae-search" placeholder="Search company, design #, or ID..." value="' + escapeHtml(currentSearchText || '') + '" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;color:#1e293b;width:220px;">';
        html += '<label style="font-size:13px;font-weight:600;color:#64748b;white-space:nowrap;margin-left:8px;">Rep:</label>';
        html += '<select id="mockup-ae-rep-filter" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;color:#1e293b;">';
        repOptions.forEach(function (name) {
            html += '<option value="' + name + '"' + (name === currentRepFilter ? ' selected' : '') + '>' + name + '</option>';
        });
        html += '</select>';
        html += '<span id="mockup-ae-rep-count" style="font-size:12px;color:#94a3b8;margin-left:auto;"></span>';
        html += '</div>';

        // Card grid — filter by rep + search
        var displayMockups = getDisplayMockups();

        html += '<div class="mockup-grid">';
        if (displayMockups.length === 0) {
            // Friendly empty state — most relevant when "Needs Your Review" was
            // the default and is empty ("you're all caught up"), but also covers
            // empty rep/search/bucket combinations.
            var msg = (currentBucketFilter === 'needs-review')
                ? "You're all caught up — nothing waiting for your review."
                : 'No mockups match this filter.';
            html += '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999;">'
                + msg + '</div>';
        } else {
            displayMockups.forEach(function (m) {
                html += buildCard(m);
            });
        }
        html += '</div>';

        container.innerHTML = html;

        updateCountSpan(displayMockups);

        // Wire rep filter change
        var repSelect = document.getElementById('mockup-ae-rep-filter');
        if (repSelect) {
            repSelect.addEventListener('change', function () {
                currentRepFilter = this.value;
                sessionStorage.setItem('ae_dashboard_rep_filter', currentRepFilter);
                render();
            });
        }

        // Wire text search — call renderCards() (not render()) so the input
        // element itself isn't destroyed on every keystroke. Same pattern as
        // art-ae.js's search wiring.
        var searchInput = document.getElementById('mockup-ae-search');
        if (searchInput) {
            var searchTimer = null;
            searchInput.addEventListener('input', function () {
                clearTimeout(searchTimer);
                var input = this;
                searchTimer = setTimeout(function () {
                    // Preserve original casing in storage so the value="" attribute
                    // shows what the user actually typed after a full re-render.
                    // The filter helper lowercases at compare time.
                    currentSearchText = input.value.trim();
                    renderCards();
                }, 200);
            });
        }

        // Wire bucket chip clicks. Click any chip → switch the bucket filter.
        // Re-runs render() so the chip's .active state and the count of visible
        // cards update together (renderCards alone would leave the chip styling stale).
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

        wireCardClicks(container);
    }

    // Filter helper — shared by render() and renderCards() so the rep + search
    // logic isn't duplicated. Returns the visible mockup subset.
    function getDisplayMockups() {
        var searchLc = (currentSearchText || '').toLowerCase();
        return allMockups.filter(function (m) {
            var matchBucket = currentBucketFilter === 'all'
                || currentBucketFilter === null
                || bucketFor(m.Status) === currentBucketFilter;
            var matchRep = currentRepFilter === 'All' || resolveRepName(m.Submitted_By || '') === currentRepFilter;
            var matchSearch = !searchLc || (
                (m.Company_Name || '').toLowerCase().indexOf(searchLc) !== -1 ||
                (m.Design_Number || '').toLowerCase().indexOf(searchLc) !== -1 ||
                (m.Design_Name || '').toLowerCase().indexOf(searchLc) !== -1 ||
                String(m.ID || '').indexOf(searchLc) !== -1 ||
                // Rep name match — lets the user filter by typing "Nika" or
                // by clicking a rep name in any card header (which fills
                // this same search input). The dropdown filter still uses
                // the full resolveRepName() match above.
                (m.Submitted_By || '').toLowerCase().indexOf(searchLc) !== -1 ||
                resolveRepName(m.Submitted_By || '').toLowerCase().indexOf(searchLc) !== -1
            );
            return matchBucket && matchRep && matchSearch;
        });
    }

    // Map a Caspio status to its display bucket. The fallthrough → 'with-ruth'
    // is the safety net: if normalizeStatus() can't classify a value (null,
    // blank, typo), the mockup still appears in a visible chip rather than
    // vanishing from the gallery.
    function bucketFor(status) {
        var s = normalizeStatus(status);
        if (s === 'Awaiting Approval') return 'needs-review';
        if (s === 'Approved' || s === 'Completed') return 'done';
        return 'with-ruth';
    }

    function countByBucket(mockups) {
        var counts = { needsReview: 0, withRuth: 0, done: 0, all: 0 };
        mockups.forEach(function (m) {
            counts.all++;
            var b = bucketFor(m.Status);
            if (b === 'needs-review') counts.needsReview++;
            else if (b === 'done') counts.done++;
            else counts.withRuth++;
        });
        // Safety assertion — every mockup must land in exactly one bucket.
        var sum = counts.needsReview + counts.withRuth + counts.done;
        if (sum !== counts.all) {
            console.warn('[MockupAeGallery] bucket sum ' + sum + ' !== total ' + counts.all
                + ' — some mockups were not categorized. Check normalizeStatus().');
        }
        return counts;
    }

    function buildBucketChipsHtml(counts) {
        var chips = [
            { key: 'needs-review', label: 'Needs Your Review', count: counts.needsReview, modifier: 'needs-review' },
            { key: 'with-ruth',    label: 'With Ruth',         count: counts.withRuth,    modifier: 'with-ruth' },
            { key: 'done',         label: 'Done',              count: counts.done,        modifier: 'done' },
            { key: 'all',          label: 'All',               count: counts.all,         modifier: 'all' }
        ];
        var html = '<div class="status-summary">';
        chips.forEach(function (c) {
            var active = currentBucketFilter === c.key ? ' active' : '';
            html += '<div class="status-stat status-stat--' + c.modifier + active + '" '
                + 'data-bucket="' + c.key + '" title="' + escapeHtml(c.label) + '">'
                + '<span class="status-stat-count" data-stat="' + c.key + '">' + c.count + '</span>'
                + '<span class="status-stat-label">' + escapeHtml(c.label) + '</span></div>';
        });
        html += '</div>';
        return html;
    }

    function updateCountSpan(displayMockups) {
        var countSpan = document.getElementById('mockup-ae-rep-count');
        if (!countSpan) return;
        var isFiltered = currentRepFilter !== 'All' || currentSearchText;
        countSpan.textContent = isFiltered
            ? displayMockups.length + ' of ' + allMockups.length + ' mockups'
            : allMockups.length + ' mockups';
    }

    // Re-render only the cards grid + count. Leaves the toolbar (search input
    // + rep dropdown) untouched so typing into the search box doesn't destroy
    // the input element mid-keystroke. Mirrors art-ae.js:207.
    function renderCards() {
        var container = document.getElementById(containerId);
        if (!container) return;
        var grid = container.querySelector('.mockup-grid');
        if (!grid) return;

        var displayMockups = getDisplayMockups();
        var html = '';
        if (displayMockups.length === 0) {
            var msg = (currentBucketFilter === 'needs-review')
                ? "You're all caught up — nothing waiting for your review."
                : 'No mockups match this filter.';
            html = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999;">'
                + msg + '</div>';
        } else {
            displayMockups.forEach(function (m) { html += buildCard(m); });
        }
        grid.innerHTML = html;

        updateCountSpan(displayMockups);
        wireCardClicks(container);
    }

    function wireCardClicks(container) {
        container.querySelectorAll('.mockup-card').forEach(function (card) {
            card.addEventListener('click', function (e) {
                // Click rep name → fill search box, filter to that AE.
                // Stops propagation so the navigation below doesn't fire.
                var repBtn = e.target.closest('.card-rep-name[data-action="filter-rep"]');
                if (repBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    var name = repBtn.dataset.rep || '';
                    var input = document.getElementById('mockup-ae-search');
                    if (input && name) {
                        var current = input.value.trim().toLowerCase();
                        input.value = (current === name.toLowerCase()) ? '' : name;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.focus();
                    }
                    return;
                }
                var id = card.dataset.mockupId;
                if (id) window.location.href = '/mockup/' + id + '?view=ae';
            });
        });
    }

    function buildCard(mockup) {
        var id = mockup.ID;
        var company = escapeHtml(mockup.Company_Name || 'Unknown Company');
        var designNum = escapeHtml(mockup.Design_Number || '—');
        var designName = escapeHtml(mockup.Design_Name || '');
        var status = mockup.Status || 'Submitted';
        var statusClass = 'status-pill--' + status.toLowerCase().replace(/\s+/g, '-');
        var mockupType = escapeHtml(mockup.Mockup_Type || '');
        var submittedDate = formatDate(mockup.Submitted_Date);
        var revCount = mockup.Revision_Count || 0;

        // Logo dimensions + stitch count — Ruth fills these in; AE reads.
        var dimensions = '';
        if (mockup.Logo_Width && mockup.Logo_Height) dimensions = mockup.Logo_Width + '" × ' + mockup.Logo_Height + '"';
        else if (mockup.Logo_Width) dimensions = mockup.Logo_Width + '" wide';
        else if (mockup.Logo_Height) dimensions = mockup.Logo_Height + '" tall';
        var stitchCountText = '';
        if (mockup.Stitch_Count != null && mockup.Stitch_Count !== '') {
            var sc = parseInt(mockup.Stitch_Count, 10);
            stitchCountText = isNaN(sc) ? String(mockup.Stitch_Count) : sc.toLocaleString();
        }

        var badges = '';
        if (mockupType) {
            mockupType.split(', ').forEach(function (t) {
                badges += '<span class="card-badge">' + escapeHtml(t.trim()) + '</span>';
            });
        }
        if (revCount > 0) {
            badges += '<span class="card-badge card-badge--revision">Rev ' + revCount + '</span>';
        }

        // Elapsed time badge for all statuses + CTA for awaiting approval
        var elapsedBadge = (typeof ElapsedTimeUtils !== 'undefined')
            ? ElapsedTimeUtils.getStatusElapsedBadge(status, mockup, 'mockup')
            : '';
        var ctaHtml = '';
        if (status === 'Awaiting Approval') {
            ctaHtml = '<div class="card-actions">'
                + '<span style="font-size:12px;color:#d97706;font-weight:600;padding:6px 0;">&#9888; Needs your review</span>'
                + (elapsedBadge ? '<div>' + elapsedBadge + '</div>' : '')
                + '</div>';
        } else if (elapsedBadge) {
            ctaHtml = '<div class="card-actions">' + elapsedBadge + '</div>';
        }

        var thumbUrl = mockup.Box_Mockup_1 || '';
        var thumbHtml = '';
        if (thumbUrl) {
            thumbHtml = '<div class="card-thumb">'
                + '<img src="' + escapeHtml(thumbUrl) + '" alt="Mockup preview" loading="lazy"'
                + ' data-original-src="' + escapeHtml(thumbUrl) + '"'
                + ' onerror="if(window.ArtActions&&window.ArtActions.handleBoxImageError){window.ArtActions.handleBoxImageError(this);}else{this.parentElement.style.display=\'none\';}">'
                + '</div>';
        }

        var repName = resolveRepName(mockup.Submitted_By || '');
        // First whitespace-token only — the inline header treatment uses the
        // first name for at-a-glance scanning ("#40018 · Taneisha"). data-rep
        // attribute keeps the full repName since the rep filter dropdown
        // matches against the full resolveRepName() output.
        var repFirstName = repName ? escapeHtml(String(repName).split(/\s+/)[0]) : '';

        return '<div class="mockup-card" data-mockup-id="' + id + '" data-rep="' + escapeHtml(repName) + '" style="cursor:pointer;">'
            + '<div class="card-header">'
            + '  <div class="card-header-left">'
            + '    <div class="card-company">' + company + '</div>'
            + '    <div class="card-design-number">#' + designNum
            +        (repFirstName ? '<span class="card-rep-name" data-action="filter-rep" data-rep="' + repFirstName + '" title="Click to filter by ' + repFirstName + '">' + repFirstName + '</span>' : '')
            +      '</div>'
            + '  </div>'
            + '  <div class="card-header-right">'
            + '    <span class="status-pill ' + statusClass + '">' + escapeHtml(status) + '</span>'
            + '  </div>'
            + '</div>'
            + thumbHtml
            + '<div class="card-body">'
            + (designName ? '<div class="card-design-name">' + designName + '</div>' : '')
            + ((dimensions || stitchCountText) ? '<div class="card-meta">'
                + (dimensions ? '<div class="card-meta-row"><span class="card-meta-label">Dimensions:</span> ' + escapeHtml(dimensions) + '</div>' : '')
                + (stitchCountText ? '<div class="card-meta-row"><span class="card-meta-label">Stitches:</span> ' + escapeHtml(stitchCountText) + '</div>' : '')
                + '</div>' : '')
            + (badges ? '<div class="card-badges">' + badges + '</div>' : '')
            // REP meta-row removed 2026-04-26 — rep promoted to header inline
            // with designNum (see card-design-number block above).
            + '</div>'
            + '<div class="card-footer">'
            + '  <span class="card-date">' + submittedDate + '</span>'
            + '  <span class="card-action-link">View Details &rarr;</span>'
            + '</div>'
            + ctaHtml
            + '</div>';
    }

    // Legacy API — externals may still call this. Translate the requested
    // status to its bucket so the bucket UI stays consistent.
    function filterByStatus(status) {
        currentBucketFilter = bucketFor(status);
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

    function getElapsedText(date) {
        var now = new Date();
        var diffMs = now - date;
        var diffMins = Math.floor(diffMs / 60000);
        var diffHours = Math.floor(diffMs / 3600000);
        var diffDays = Math.floor(diffMs / 86400000);

        var text, cssClass;
        if (diffMins < 60) {
            text = diffMins <= 1 ? 'just now' : diffMins + ' min ago';
            cssClass = 'approval-elapsed--fresh';
        } else if (diffHours < 24) {
            text = diffHours === 1 ? '1 hr ago' : diffHours + ' hrs ago';
            cssClass = 'approval-elapsed--fresh';
        } else if (diffDays < 3) {
            text = diffDays === 1 ? '1 day ago' : diffDays + ' days ago';
            cssClass = 'approval-elapsed--waiting';
        } else {
            text = diffDays + ' days ago';
            cssClass = 'approval-elapsed--overdue';
        }
        return { text: text, cssClass: cssClass };
    }

    // ── Kanban Board View ───────────────────────────────────────────────
    var kanbanActive = false;
    var KANBAN_DATE_CUTOFF = new Date('2026-03-15');
    var COMPLETED_SHOW_LIMIT = 5;

    var KANBAN_COLUMNS = [
        { id: 'submitted', label: 'Submitted', match: ['Submitted'] },
        { id: 'in-progress', label: 'In Progress', match: ['In Progress'] },
        { id: 'awaiting', label: 'Awaiting Approval', match: ['Awaiting Approval'] },
        { id: 'revision', label: 'Revision Requested', match: ['Revision Requested'] },
        { id: 'approved', label: 'Approved', match: ['Approved'] },
        { id: 'completed', label: 'Completed', match: ['Completed'] }
    ];

    function normalizeStatus(raw) {
        if (!raw || raw === '') return 'Submitted';
        var s = String(raw).trim();
        var lower = s.toLowerCase();
        if (lower === 'submitted' || lower === '') return 'Submitted';
        if (lower === 'in progress') return 'In Progress';
        if (lower === 'awaiting approval') return 'Awaiting Approval';
        if (lower === 'completed' || lower === 'complete') return 'Completed';
        if (lower === 'approved') return 'Approved';
        if (lower.indexOf('revision') !== -1) return 'Revision Requested';
        return 'Submitted';
    }

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
        return { text: '', cls: '' };
    }

    function renderMockupKanbanCard(m, hidden) {
        var company = escapeHtml(m.Company_Name || 'Unknown');
        var designNum = escapeHtml(m.Design_Number || '');
        var id = m.ID;
        var due = getDueBadge(m.Due_Date);

        var aeDisplay = '';
        var sub = m.Submitted_By || '';
        if (sub) {
            var atIdx = sub.indexOf('@');
            aeDisplay = atIdx > 0 ? sub.substring(0, atIdx) : sub;
            aeDisplay = aeDisplay.charAt(0).toUpperCase() + aeDisplay.slice(1);
        }

        var badges = '';
        var mockupType = m.Mockup_Type || '';
        var revCount = m.Revision_Count || 0;
        var kanbanDim = '';
        if (m.Logo_Width && m.Logo_Height) kanbanDim = m.Logo_Width + '" × ' + m.Logo_Height + '"';
        else if (m.Logo_Width) kanbanDim = m.Logo_Width + '" wide';
        else if (m.Logo_Height) kanbanDim = m.Logo_Height + '" tall';
        var kanbanStitch = '';
        if (m.Stitch_Count != null && m.Stitch_Count !== '') {
            var ks = parseInt(m.Stitch_Count, 10);
            kanbanStitch = isNaN(ks) ? String(m.Stitch_Count) : ks.toLocaleString();
        }
        if (mockupType) badges += '<span class="kanban-card-badge kanban-card-badge--type">' + escapeHtml(mockupType) + '</span>';
        if (kanbanDim) badges += '<span class="kanban-card-badge kanban-card-badge--dim">📐 ' + escapeHtml(kanbanDim) + '</span>';
        if (kanbanStitch) badges += '<span class="kanban-card-badge kanban-card-badge--dim">🧵 ' + escapeHtml(kanbanStitch) + '</span>';
        if (revCount > 0) badges += '<span class="kanban-card-badge kanban-card-badge--rev">Rev ' + revCount + '</span>';

        var thumbHtml = '';
        if (m.Box_Mockup_1) {
            thumbHtml = '<img class="kanban-card-thumb" src="' + escapeHtml(m.Box_Mockup_1) + '" loading="lazy" data-original-src="' + escapeHtml(m.Box_Mockup_1) + '" onerror="if(window.ArtActions&&window.ArtActions.handleBoxImageError){window.ArtActions.handleBoxImageError(this);}else{this.style.display=\'none\';}" alt="">';
        }

        var kanbanElapsed = (typeof ElapsedTimeUtils !== 'undefined')
            ? ElapsedTimeUtils.getKanbanElapsedBadge(m.Status || '', m, 'mockup')
            : '';

        var hiddenStyle = hidden ? ' style="display: none"' : '';
        return '<div class="kanban-card" data-mockup-id="' + id + '"' + hiddenStyle + ' onclick="window.open(\'/mockup/' + id + '?view=ae\', \'_blank\')">'
            + '<div class="kanban-card-company">' + company + kanbanElapsed + '</div>'
            + (designNum ? '<div class="kanban-card-design">#' + designNum + '</div>' : '')
            + '<div class="kanban-card-meta">'
            + '<span class="kanban-card-rep">' + escapeHtml(aeDisplay) + '</span>'
            + (due.text ? '<span class="kanban-card-due ' + due.cls + '">' + escapeHtml(due.text) + '</span>' : '')
            + '</div>'
            + (badges ? '<div class="kanban-card-badges">' + badges + '</div>' : '')
            + thumbHtml
            + '</div>';
    }

    window.toggleRuthAeKanbanView = function (view) {
        var galleryView = document.getElementById('mockup-ae-gallery');
        var boardView = document.getElementById('ruth-ae-kanban-board');
        var toggleBtns = document.querySelectorAll('#ruth-ae-view-toggle .view-toggle-btn');
        if (!galleryView || !boardView) return;

        kanbanActive = (view === 'board');

        toggleBtns.forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        if (kanbanActive) {
            galleryView.style.display = 'none';
            boardView.classList.add('active');
            buildRuthAeKanbanBoard();
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

    function buildRuthAeKanbanBoard() {
        var board = document.getElementById('ruth-ae-kanban-board');
        if (!board) return;

        // Filter to date cutoff
        var filtered = allMockups.filter(function (m) {
            if (!m.Submitted_Date) return false;
            return new Date(m.Submitted_Date) >= KANBAN_DATE_CUTOFF;
        });

        // Group into buckets
        var buckets = {};
        KANBAN_COLUMNS.forEach(function (col) { buckets[col.id] = []; });

        filtered.forEach(function (m) {
            var status = normalizeStatus(m.Status);
            var placed = false;
            KANBAN_COLUMNS.forEach(function (col) {
                if (!placed && col.match.indexOf(status) !== -1) {
                    buckets[col.id].push(m);
                    placed = true;
                }
            });
            if (!placed) buckets['submitted'].push(m);
        });

        var completedCollapsed = localStorage.getItem('ruthAeKanbanCompletedCollapsed') !== '0';

        board.innerHTML = KANBAN_COLUMNS.map(function (col) {
            var colCards = buckets[col.id] || [];
            var isCompleted = col.id === 'completed';

            var cardsHtml = '';
            if (isCompleted && colCards.length > COMPLETED_SHOW_LIMIT) {
                cardsHtml = colCards.slice(0, COMPLETED_SHOW_LIMIT).map(function (m) { return renderMockupKanbanCard(m, false); }).join('');
                cardsHtml += colCards.slice(COMPLETED_SHOW_LIMIT).map(function (m) { return renderMockupKanbanCard(m, true); }).join('');
                cardsHtml += '<div class="kanban-show-all" onclick="event.stopPropagation(); window.kanbanShowAll(\'' + col.id + '\')">Show all ' + colCards.length + ' items</div>';
            } else {
                cardsHtml = colCards.map(function (m) { return renderMockupKanbanCard(m, false); }).join('');
            }

            var chevron = isCompleted ? '<span class="kanban-collapse-chevron">&#9660;</span>' : '';
            var collapseClass = (isCompleted && completedCollapsed) ? ' kanban-column--collapsed' : '';
            var clickHandler = isCompleted ? ' onclick="window.toggleKanbanCollapse(\'' + col.id + '\', \'ruthAeKanbanCompletedCollapsed\')"' : '';

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
        filterByStatus: filterByStatus
    };

})();
