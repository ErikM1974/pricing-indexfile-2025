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

    var VISIBLE_TABS = ['submit', 'mockup', 'mockup-ruth', 'gallery', 'view', 'requirements'];
    var DROPDOWN_TABS = ['generator'];

    var TAB_PANE_MAP = {
        'submit': 'submit-tab',
        'mockup': 'mockup-tab',
        'mockup-ruth': 'mockup-ruth-tab',
        'requirements': 'requirements-tab',
        'gallery': 'gallery-tab',
        'generator': 'generator-tab',
        'view': 'view-tab'
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

        localStorage.setItem('aeDashboardTab', tabName);
    };

    // Restore saved tab on load
    document.addEventListener('DOMContentLoaded', function () {
        var savedTab = localStorage.getItem('aeDashboardTab');
        if (savedTab && savedTab === 'view') {
            showTab(savedTab);
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

})();
