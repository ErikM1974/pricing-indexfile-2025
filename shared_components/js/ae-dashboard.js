/**
 * ae-dashboard.js -- AE Dashboard tab navigation, modals, and notification polling
 *
 * Extracted from ae-dashboard.html inline <script> (Rule #3 compliance).
 * Also adds real-time toast notifications when Steve updates AE's art requests.
 *
 * Depends on: art-hub.css (shared styles), ae-submit-form.css (form styles)
 */
(function () {
    'use strict';

    const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // ── Dropdown Functionality ──────────────────────────────────────

    window.toggleMoreDropdown = function () {
        var dropdown = document.getElementById('moreDropdown');
        var button = document.getElementById('moreButton');

        if (dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
            button.classList.remove('open');
        } else {
            dropdown.classList.add('show');
            button.classList.add('open');
        }
    };

    window.closeMoreDropdown = function () {
        var dropdown = document.getElementById('moreDropdown');
        var button = document.getElementById('moreButton');
        dropdown.classList.remove('show');
        button.classList.remove('open');
    };

    // Close dropdown when clicking outside
    document.addEventListener('click', function (event) {
        if (!event.target.closest('.more-dropdown')) {
            var dropdown = document.getElementById('moreDropdown');
            var button = document.getElementById('moreButton');
            if (dropdown) dropdown.classList.remove('show');
            if (button) button.classList.remove('open');
        }
    });

    // ── Tab Switching ───────────────────────────────────────────────

    var VISIBLE_TABS = ['submit', 'mockup-ruth', 'view', 'review', 'requirements'];
    var DROPDOWN_TABS = ['gallery', 'generator'];

    var TAB_PANE_MAP = {
        'submit': 'submit-tab',
        'mockup-ruth': 'mockup-ruth-tab',
        'requirements': 'requirements-tab',
        'gallery': 'gallery-tab',
        'generator': 'generator-tab',
        'view': 'view-tab',
        'review': 'review-tab'
    };

    window.showTab = function (tabName) {
        // Remove active class from all buttons and panes
        document.querySelectorAll('.tab-button').forEach(function (btn) { btn.classList.remove('active'); });
        document.querySelectorAll('.dropdown-item').forEach(function (item) { item.classList.remove('active'); });
        document.querySelectorAll('.tab-pane').forEach(function (pane) { pane.classList.remove('active'); });

        var visibleIndex = VISIBLE_TABS.indexOf(tabName);

        if (visibleIndex !== -1) {
            var buttons = document.querySelectorAll('.tab-button');
            if (buttons[visibleIndex]) buttons[visibleIndex].classList.add('active');
            var moreBtn = document.getElementById('moreButton');
            if (moreBtn) moreBtn.classList.remove('active');
        } else {
            var dropdownItems = document.querySelectorAll('.dropdown-item');
            var dropdownIndex = DROPDOWN_TABS.indexOf(tabName);
            if (dropdownIndex !== -1 && dropdownItems[dropdownIndex]) {
                dropdownItems[dropdownIndex].classList.add('active');
                var moreBtn2 = document.getElementById('moreButton');
                if (moreBtn2) moreBtn2.classList.add('active');
            }
        }

        if (TAB_PANE_MAP.hasOwnProperty(tabName)) {
            var pane = document.getElementById(TAB_PANE_MAP[tabName]);
            if (pane) pane.classList.add('active');
        }

        // Load review tab data on switch
        if (tabName === 'review') loadReviewTab();

        localStorage.setItem('aeDashboardTab', tabName);
    };

    // Restore saved tab on load
    document.addEventListener('DOMContentLoaded', function () {
        var savedTab = localStorage.getItem('aeDashboardTab');
        if (savedTab) {
            // Fallback to submit if saved tab no longer exists (e.g., removed mockup-tab)
            if (!TAB_PANE_MAP.hasOwnProperty(savedTab)) {
                savedTab = 'submit';
                localStorage.setItem('aeDashboardTab', savedTab);
            }
            if (savedTab !== 'submit') {
                showTab(savedTab);
            }
        }
    });

    // ── Note Modals ────────────────────────────────────────────────

    var noteWasSubmitted = false;

    window.viewNotesModal = function (designId) {
        document.getElementById('viewNotesRequestId').textContent = designId;
        document.getElementById('viewNotesFrame').src =
            'https://c3eku948.caspio.com/dp/a0e15000d8d96d34814b43498414?ID_Design=' + designId;
        document.getElementById('viewNotesModal').style.display = 'block';
    };

    window.closeViewNotesModal = function () {
        document.getElementById('viewNotesModal').style.display = 'none';
        document.getElementById('viewNotesFrame').src = '';
    };

    window.openNoteModal = function (designId) {
        noteWasSubmitted = false;
        document.getElementById('requestId').textContent = designId;
        document.getElementById('noteFrame').src =
            'https://c3eku948.caspio.com/dp/a0e15000bc57622bf42c450cb7a5?ID_Design=' + designId;
        document.getElementById('noteModal').style.display = 'block';
    };

    window.closeNoteModal = function () {
        document.getElementById('noteModal').style.display = 'none';
        document.getElementById('noteFrame').src = '';
        if (noteWasSubmitted) {
            window.location.reload();
            noteWasSubmitted = false;
        }
    };

    // Close modals when clicking outside
    window.addEventListener('click', function (event) {
        var noteModal = document.getElementById('noteModal');
        var viewNotesModal = document.getElementById('viewNotesModal');
        if (event.target === noteModal) window.closeNoteModal();
        else if (event.target === viewNotesModal) window.closeViewNotesModal();
    });

    // Listen for messages from Caspio iframes
    window.addEventListener('message', function (event) {
        if (event.data === 'closeModal' || event.data === 'formSubmitted') {
            noteWasSubmitted = true;
            window.closeNoteModal();
        }
    });

    // ── Real-Time Notification Polling (toast for Steve's actions) ──

    var POLL_INTERVAL_MS = 45000; // 45 seconds
    var pollTimerId = null;
    var lastNotificationTime = parseInt(sessionStorage.getItem('aeNotifLastSeen')) || Date.now();

    function startNotificationPolling() {
        // Initial poll after 5s (let Caspio load first)
        setTimeout(function () { pollNotifications(); }, 5000);
        pollTimerId = setInterval(pollNotifications, POLL_INTERVAL_MS);

        // Pause polling when tab is hidden, resume when visible
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                clearInterval(pollTimerId);
                pollTimerId = null;
            } else {
                pollNotifications();
                pollTimerId = setInterval(pollNotifications, POLL_INTERVAL_MS);
            }
        });
    }

    async function pollNotifications() {
        try {
            var resp = await fetch(API_BASE + '/api/art-notifications?since=' + lastNotificationTime);
            if (!resp.ok) return;
            var data = await resp.json();

            if (data.notifications && data.notifications.length > 0) {
                data.notifications.forEach(function (n) { showAeNotificationToast(n); });
                lastNotificationTime = data.serverTime || Date.now();
                sessionStorage.setItem('aeNotifLastSeen', String(lastNotificationTime));
                updateTabBadges(); // Refresh counts when notifications arrive
            }
        } catch (err) {
            // Silent failure — polling is best-effort
        }
    }

    function showAeNotificationToast(notification) {
        // Only show notifications relevant to AEs (from Steve's actions)
        var type = notification.type;
        if (type === 'new_submission') return; // AE submitted this themselves, skip

        var container = getOrCreateToastContainer();
        var toast = document.createElement('div');
        toast.className = 'art-notif-toast';

        var icon, verb, accentColor;
        if (type === 'approved' || type === 'completed') {
            icon = '&#x2705;'; // green check
            verb = 'completed';
            accentColor = '#28a745';
        } else if (type === 'mockup_sent') {
            icon = '&#x1F3A8;'; // palette
            verb = 'sent a mockup for';
            accentColor = '#d97706';
        } else if (type === 'status_changed') {
            icon = '&#x1F504;'; // arrows
            verb = 'updated status on';
            accentColor = '#6f42c1';
        } else {
            icon = '&#x1F514;'; // bell
            verb = 'updated';
            accentColor = '#0d6efd';
        }

        toast.style.borderLeftColor = accentColor;
        toast.innerHTML =
            '<div class="art-notif-toast-content">' +
                '<span class="art-notif-toast-icon">' + icon + '</span>' +
                '<div class="art-notif-toast-text">' +
                    '<strong>' + escapeHtml(notification.actorName || 'Art Dept') + '</strong> ' +
                    verb + ' design <strong>#' + escapeHtml(notification.designId || '') + '</strong>' +
                    (notification.companyName ? ' (' + escapeHtml(notification.companyName) + ')' : '') +
                '</div>' +
                '<button class="art-notif-toast-close" type="button" aria-label="Dismiss">&times;</button>' +
            '</div>';

        // Click toast to open detail page
        toast.querySelector('.art-notif-toast-content').addEventListener('click', function (e) {
            if (e.target.classList.contains('art-notif-toast-close')) return;
            window.open('/art-request/' + notification.designId, '_blank');
        });

        // Dismiss button
        toast.querySelector('.art-notif-toast-close').addEventListener('click', function () {
            dismissToast(toast);
        });

        container.appendChild(toast);
        requestAnimationFrame(function () { toast.classList.add('show'); });

        // Auto-dismiss after 8 seconds
        setTimeout(function () { dismissToast(toast); }, 8000);
    }

    function dismissToast(toast) {
        if (!toast || toast.classList.contains('removing')) return;
        toast.classList.add('removing');
        toast.classList.remove('show');
        setTimeout(function () {
            toast.remove();
            var container = document.getElementById('art-notif-container');
            if (container && container.children.length === 0) container.remove();
        }, 300);
    }

    function getOrCreateToastContainer() {
        var container = document.getElementById('art-notif-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'art-notif-container';
            document.body.appendChild(container);
        }
        return container;
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Start Notification Polling ─────────────────────────────────
    startNotificationPolling();

    // ── "My Art Requests" Card View ──────────────────────────────
    // Reads the Caspio report table, hides it, and renders visual
    // cards with mockup images, status badges, and detail links.

    var BARE_CDN_RE = /^https?:\/\/cdn\.caspio\.com\/[A-Za-z0-9]+\/?$/;

    // Status badge config
    var STATUS_MAP = {
        'completed': { cls: 'ae-status--completed', label: 'Completed', icon: '&#x2714;' },
        'in progress': { cls: 'ae-status--progress', label: 'In Progress', icon: '&#x25D0;' },
        'awaiting approval': { cls: 'ae-status--awaiting', label: 'Awaiting Approval', icon: '&#x23F8;' },
        'revision requested': { cls: 'ae-status--revision', label: 'Revision Requested', icon: '&#x1F504;' },
        'submitted': { cls: 'ae-status--submitted', label: 'Submitted', icon: '&#x25CB;' },
        'cancelled': { cls: 'ae-status--cancelled', label: 'Cancelled', icon: '&#x2715;' }
    };

    function getStatusInfo(rawStatus) {
        var s = (rawStatus || '').replace(/[^\w\s]/gi, '').trim().toLowerCase();
        if (!s || s === 'happy' || s === 'status') return STATUS_MAP['submitted'];
        for (var key in STATUS_MAP) {
            if (s.indexOf(key) !== -1) return STATUS_MAP[key];
        }
        return STATUS_MAP['submitted'];
    }

    function buildColumnMap(headers) {
        var map = {};
        for (var i = 0; i < headers.length; i++) {
            var text = (headers[i].textContent || '').trim().toLowerCase();
            if (text === 'status') map.status = i;
            else if (text === 'id_design') map.idDesign = i;
            else if (text.indexOf('company') !== -1) map.company = i;
            else if (text.indexOf('due') !== -1) map.dueDate = i;
            else if (text.indexOf('order') !== -1 && text.indexOf('#') !== -1) map.orderNum = i;
            else if (text.indexOf('design') !== -1 && text.indexOf('#') !== -1) map.designNum = i;
            else if (text.indexOf('view notes') !== -1) map.viewNotes = i;
            else if (text.indexOf('add note') !== -1) map.addNote = i;
            else if (text.indexOf('box_file_mockup') !== -1 || text.indexOf('box file mockup') !== -1) map.boxMockup = i;
            else if (text.indexOf('boxfilelink') !== -1 || text === 'box file link') map.boxFileLink = i;
            else if (text.indexOf('company_mockup') !== -1 || text.indexOf('company mockup') !== -1) map.companyMockup = i;
            else if (text.indexOf('file upload') !== -1) map.fileUpload = i;
            else if (text.indexOf('request type') !== -1) map.requestType = i;
        }
        return map;
    }

    function getCellText(row, idx) {
        if (idx === undefined || idx === null) return '';
        var cells = row.querySelectorAll('td');
        if (!cells[idx]) return '';
        // Caspio wraps labels in <span class="cbResultSetLabel">. Clone cell, remove label, get text.
        var clone = cells[idx].cloneNode(true);
        var label = clone.querySelector('.cbResultSetLabel');
        if (label) label.remove();
        return (clone.textContent || '').trim();
    }

    function getCellImgSrc(row, idx) {
        if (idx === undefined || idx === null) return '';
        var cells = row.querySelectorAll('td');
        if (!cells[idx]) return '';
        var img = cells[idx].querySelector('img');
        if (img && img.src && !BARE_CDN_RE.test(img.src)) return img.src;
        return '';
    }

    function getCellLink(row, idx) {
        if (idx === undefined || idx === null) return null;
        var cells = row.querySelectorAll('td');
        if (!cells[idx]) return null;
        var a = cells[idx].querySelector('a');
        return a ? a.cloneNode(true) : null;
    }

    function renderArtRequestCards() {
        var viewTab = document.getElementById('view-tab');
        if (!viewTab) return;

        var table = viewTab.querySelector('table.cbResultSetTable');
        if (!table) return;

        // Already rendered cards for this table instance?
        if (table.dataset.cardsRendered) return;

        var headers = table.querySelectorAll('thead th');
        if (!headers.length) return;

        var colMap = buildColumnMap(headers);
        // Must have at least design number to be useful
        if (colMap.designNum === undefined && colMap.idDesign === undefined) return;

        var rows = table.querySelectorAll('tbody tr');
        if (!rows.length) return;

        // Remove any previous card grid
        var oldGrid = viewTab.querySelector('.ae-art-grid');
        if (oldGrid) oldGrid.remove();

        // Build card grid
        var grid = document.createElement('div');
        grid.className = 'ae-art-grid';

        rows.forEach(function (row) {
            var designNum = getCellText(row, colMap.designNum);
            var idDesign = getCellText(row, colMap.idDesign);
            var company = getCellText(row, colMap.company);
            var status = getCellText(row, colMap.status);
            var dueDate = getCellText(row, colMap.dueDate);
            var orderNum = getCellText(row, colMap.orderNum);
            var requestType = getCellText(row, colMap.requestType);

            // Image: Box_File_Mockup > BoxFileLink > Company_Mockup > File_Upload_One > placeholder
            var mockupUrl = getCellText(row, colMap.boxMockup);
            if (!mockupUrl || BARE_CDN_RE.test(mockupUrl)) {
                mockupUrl = getCellText(row, colMap.boxFileLink);
            }
            if (!mockupUrl || BARE_CDN_RE.test(mockupUrl)) {
                mockupUrl = getCellText(row, colMap.companyMockup);
            }
            if (!mockupUrl || BARE_CDN_RE.test(mockupUrl)) {
                mockupUrl = getCellImgSrc(row, colMap.fileUpload);
            }

            var statusInfo = getStatusInfo(status);
            var detailId = idDesign.replace(/[^0-9]/g, '');

            var card = document.createElement('div');
            card.className = 'ae-art-card';

            // Image section
            var imageHtml;
            if (mockupUrl) {
                imageHtml = '<div class="ae-art-card__image"><img src="' + escapeHtml(mockupUrl) + '" alt="' + escapeHtml(company) + ' mockup" loading="lazy" style="cursor:pointer" data-mockup-url="' + escapeHtml(mockupUrl) + '" onerror="this.parentElement.innerHTML=\'<div class=ae-art-card__placeholder><svg width=48 height=48 viewBox=&quot;0 0 24 24&quot; fill=none stroke=#9ca3af stroke-width=1.5><rect x=3 y=3 width=18 height=18 rx=2/><circle cx=8.5 cy=8.5 r=1.5/><path d=&quot;M21 15l-5-5L5 21&quot;/></svg></div>\'"></div>';
            } else {
                imageHtml = '<div class="ae-art-card__image"><div class="ae-art-card__placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div></div>';
            }

            // Request type badge
            var typeBadge = '';
            if (requestType && requestType.toLowerCase().indexOf('mockup') !== -1) {
                typeBadge = '<span class="ae-art-card__type ae-art-card__type--mockup">Mockup</span>';
            } else if (requestType && requestType.toLowerCase().indexOf('new') !== -1) {
                typeBadge = '<span class="ae-art-card__type ae-art-card__type--new">New Artwork</span>';
            }

            card.innerHTML = imageHtml +
                '<div class="ae-art-card__body">' +
                    '<div class="ae-art-card__header">' +
                        '<span class="ae-art-card__company">' + escapeHtml(company) + '</span>' +
                        (designNum ? '<span class="ae-art-card__design-num">#' + escapeHtml(designNum) + '</span>' :
                         detailId ? '<span class="ae-art-card__design-num">#' + escapeHtml(detailId) + '</span>' : '') +
                    '</div>' +
                    '<div class="ae-art-card__meta">' +
                        '<span class="ae-art-card__status ' + statusInfo.cls + '">' + statusInfo.icon + ' ' + statusInfo.label + '</span>' +
                        typeBadge +
                    '</div>' +
                    '<div class="ae-art-card__details">' +
                        (dueDate ? '<span class="ae-art-card__detail">Due: ' + escapeHtml(dueDate) + '</span>' : '') +
                        (orderNum ? '<span class="ae-art-card__detail">Order: ' + escapeHtml(orderNum) + '</span>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="ae-art-card__footer">' +
                    (detailId ? '<a href="/art-request/' + escapeHtml(detailId) + '" target="_blank" class="ae-art-card__link ae-art-card__link--primary">View Details &rarr;</a>' : '') +
                    '<span class="ae-art-card__actions" data-id-design="' + escapeHtml(idDesign) + '"></span>' +
                '</div>';

            // Inject View Notes / Add Note links into the actions span
            var actionsSpan = card.querySelector('.ae-art-card__actions');
            var notesLink = getCellLink(row, colMap.viewNotes);
            var addNoteLink = getCellLink(row, colMap.addNote);
            if (notesLink) {
                notesLink.className = 'ae-art-card__link';
                notesLink.textContent = 'Notes';
                actionsSpan.appendChild(notesLink);
            }
            if (addNoteLink) {
                addNoteLink.className = 'ae-art-card__link';
                addNoteLink.textContent = '+ Note';
                actionsSpan.appendChild(addNoteLink);
            }

            grid.appendChild(card);
        });

        // Lightbox on mockup image click
        grid.addEventListener('click', function (e) {
            var img = e.target.closest('.ae-art-card__image img');
            if (img && img.dataset.mockupUrl) {
                openAELightbox(img.dataset.mockupUrl, img.alt || 'Mockup');
            }
        });

        // Insert card grid before the table, then hide the table + Caspio nav/scrollbar
        table.parentNode.insertBefore(grid, table);
        table.style.display = 'none';
        var caspioNav = viewTab.querySelector('.cbReportNavBarPanel');
        if (caspioNav) caspioNav.style.display = 'none';
        // Prevent horizontal overflow from any remaining Caspio elements
        var caspioForm = table.closest('form');
        if (caspioForm) caspioForm.style.overflow = 'hidden';
        table.dataset.cardsRendered = 'true';
    }

    // ── Lightbox for Mockup Preview ──────────────────────────────────
    function openAELightbox(url, label) {
        var lb = document.getElementById('ae-lightbox');
        if (!lb) return;
        document.getElementById('ae-lightbox-img').src = url;
        document.getElementById('ae-lightbox-label').textContent = label || '';
        lb.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeAELightbox() {
        var lb = document.getElementById('ae-lightbox');
        if (!lb) return;
        lb.style.display = 'none';
        document.getElementById('ae-lightbox-img').src = '';
        document.body.style.overflow = '';
    }

    // Close on backdrop click, × button, or Escape
    document.addEventListener('click', function (e) {
        if (e.target.id === 'ae-lightbox-close' || e.target.id === 'ae-lightbox-backdrop') closeAELightbox();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAELightbox();
    });

    // ── Tab Count Badges ───────────────────────────────────────────
    function updateTabBadges() {
        fetch(API_BASE + '/api/artrequests?status=Awaiting%20Approval&select=ID_Design&limit=100')
            .then(function (resp) { return resp.ok ? resp.json() : []; })
            .then(function (data) {
                var items = data.Result || data || [];
                var count = items.length;
                // Find the Review Mockups tab button
                var tabs = document.querySelectorAll('.ae-tab-btn');
                tabs.forEach(function (tab) {
                    if (tab.textContent.indexOf('Review') !== -1) {
                        var badge = tab.querySelector('.ae-tab-badge');
                        if (count > 0) {
                            if (!badge) {
                                badge = document.createElement('span');
                                badge.className = 'ae-tab-badge';
                                tab.appendChild(badge);
                            }
                            badge.textContent = count;
                        } else if (badge) {
                            badge.remove();
                        }
                    }
                });
            })
            .catch(function () { /* silent */ });
    }

    // Run badge update after page load + after each notification poll
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(updateTabBadges, 3000);
    });

    // ── Helpers ────────────────────────────────────────────────────
    function timeAgo(dateStr) {
        if (!dateStr) return '';
        try {
            var d = new Date(dateStr);
            var now = new Date();
            var diffMs = now - d;
            var diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 1) return 'just now';
            if (diffMins < 60) return diffMins + 'm ago';
            var diffHrs = Math.floor(diffMins / 60);
            if (diffHrs < 24) return diffHrs + 'h ago';
            var diffDays = Math.floor(diffHrs / 24);
            if (diffDays === 1) return 'yesterday';
            if (diffDays < 7) return diffDays + ' days ago';
            return (d.getMonth() + 1) + '/' + d.getDate();
        } catch (e) { return ''; }
    }

    // ── Review Mockups Tab ──────────────────────────────────────────
    function loadReviewTab() {
        var container = document.getElementById('review-cards-container');
        var loading = document.getElementById('review-loading');
        var emptyState = document.getElementById('review-empty-state');
        if (!container) return;

        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'none';
        if (loading) loading.style.display = '';

        var url = API_BASE + '/api/artrequests?status=Awaiting%20Approval' +
            '&select=ID_Design,CompanyName,Box_File_Mockup,BoxFileLink,Company_Mockup,File_Upload,Due_Date,Status,Design_Number,Revision_Count,Date_Modified,NOTES' +
            '&orderBy=Date_Created%20DESC&limit=50';

        fetch(url)
            .then(function (resp) {
                if (!resp.ok) throw new Error('Failed to fetch: ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                if (loading) loading.style.display = 'none';
                var items = data.Result || data || [];
                if (!items.length) {
                    if (emptyState) emptyState.style.display = '';
                    return;
                }

                var grid = document.createElement('div');
                grid.className = 'ae-art-grid';

                items.forEach(function (req) {
                    var idDesign = String(req.ID_Design || '');
                    var company = req.CompanyName || '';
                    var designNum = req.Design_Number || '';
                    var dueDate = req.Due_Date || '';
                    var status = req.Status || 'Awaiting Approval';
                    var revCount = parseInt(req.Revision_Count) || 0;
                    var dateModified = req.Date_Modified || '';
                    var notes = req.NOTES || '';

                    // Mockup image fallback chain
                    var mockupUrl = req.Box_File_Mockup || '';
                    if (!mockupUrl || BARE_CDN_RE.test(mockupUrl)) mockupUrl = req.BoxFileLink || '';
                    if (!mockupUrl || BARE_CDN_RE.test(mockupUrl)) mockupUrl = req.Company_Mockup || '';
                    if (!mockupUrl || BARE_CDN_RE.test(mockupUrl)) mockupUrl = req.File_Upload || '';
                    if (BARE_CDN_RE.test(mockupUrl)) mockupUrl = '';

                    var statusInfo = getStatusInfo(status);
                    var detailId = idDesign.replace(/[^0-9]/g, '');

                    // Format due date
                    var dueDateDisplay = '';
                    if (dueDate) {
                        try {
                            var d = new Date(dueDate);
                            dueDateDisplay = (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
                        } catch (e) { dueDateDisplay = dueDate; }
                    }

                    var card = document.createElement('div');
                    card.className = 'ae-art-card';

                    var imageHtml;
                    if (mockupUrl) {
                        imageHtml = '<div class="ae-art-card__image"><img src="' + escapeHtml(mockupUrl) + '" alt="' + escapeHtml(company) + ' mockup" loading="lazy" style="cursor:pointer" data-mockup-url="' + escapeHtml(mockupUrl) + '" onerror="this.parentElement.innerHTML=\'<div class=ae-art-card__placeholder><svg width=48 height=48 viewBox=&quot;0 0 24 24&quot; fill=none stroke=#9ca3af stroke-width=1.5><rect x=3 y=3 width=18 height=18 rx=2/><circle cx=8.5 cy=8.5 r=1.5/><path d=&quot;M21 15l-5-5L5 21&quot;/></svg></div>\'"></div>';
                    } else {
                        imageHtml = '<div class="ae-art-card__image"><div class="ae-art-card__placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div></div>';
                    }

                    card.innerHTML = imageHtml +
                        '<div class="ae-art-card__body">' +
                            '<div class="ae-art-card__header">' +
                                '<span class="ae-art-card__company">' + escapeHtml(company) + '</span>' +
                                (designNum ? '<span class="ae-art-card__design-num">#' + escapeHtml(designNum) + '</span>' :
                                 detailId ? '<span class="ae-art-card__design-num">#' + escapeHtml(detailId) + '</span>' : '') +
                            '</div>' +
                            '<div class="ae-art-card__meta">' +
                                '<span class="ae-art-card__status ' + statusInfo.cls + '">' + statusInfo.icon + ' ' + statusInfo.label + '</span>' +
                                (revCount > 0 ? '<span class="ae-art-card__rev-badge">Rev #' + revCount + '</span>' : '') +
                            '</div>' +
                            '<div class="ae-art-card__details">' +
                                (dueDateDisplay ? '<span class="ae-art-card__detail">Due: ' + escapeHtml(dueDateDisplay) + '</span>' : '') +
                                (dateModified ? '<span class="ae-art-card__sent">Sent ' + timeAgo(dateModified) + '</span>' : '') +
                            '</div>' +
                            (notes ? '<div class="ae-art-card__notes-preview">' + escapeHtml(notes.substring(0, 80)) + (notes.length > 80 ? '...' : '') + '</div>' : '') +
                        '</div>' +
                        '<div class="ae-art-card__footer">' +
                            (detailId ? '<a href="/art-request/' + escapeHtml(detailId) + '" target="_blank" class="ae-art-card__link ae-art-card__link--primary">Review &amp; Respond &rarr;</a>' : '') +
                        '</div>';

                    grid.appendChild(card);
                });

                // Lightbox on mockup image click
                grid.addEventListener('click', function (e) {
                    var img = e.target.closest('.ae-art-card__image img');
                    if (img && img.dataset.mockupUrl) {
                        openAELightbox(img.dataset.mockupUrl, img.alt || 'Mockup');
                    }
                });

                container.appendChild(grid);
            })
            .catch(function (err) {
                if (loading) loading.style.display = 'none';
                container.innerHTML = '<div style="text-align:center;padding:40px;color:#dc3545;">' +
                    '<p>Unable to load mockups for review.</p>' +
                    '<p style="font-size:13px;color:#999;">' + escapeHtml(err.message) + '</p></div>';
            });
    }

    // MutationObserver to catch Caspio report table rendering
    var viewTab = document.getElementById('view-tab');
    if (viewTab) {
        var cardTimer = null;
        var viewObserver = new MutationObserver(function (mutations) {
            // Reset if Caspio re-renders the table (search/pagination)
            var table = viewTab.querySelector('table.cbResultSetTable');
            if (table && !table.dataset.cardsRendered) {
                var oldGrid = viewTab.querySelector('.ae-art-grid');
                if (oldGrid) oldGrid.remove();
            }
            clearTimeout(cardTimer);
            cardTimer = setTimeout(renderArtRequestCards, 400);
        });
        viewObserver.observe(viewTab, { childList: true, subtree: true });
    }

})();
