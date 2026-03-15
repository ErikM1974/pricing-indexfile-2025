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

    function init(containerIdParam) {
        containerId = containerIdParam;
        var container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">'
            + '<div class="mockup-loading-spinner" style="width:30px;height:30px;border:3px solid #e5e7eb;border-top-color:#6B46C1;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px;"></div>'
            + 'Loading mockups...</div>';

        fetchMockups();
    }

    function fetchMockups() {
        fetch(API_BASE + '/api/mockups?orderBy=Submitted_Date DESC&limit=200')
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

        // Status summary
        var counts = { submitted: 0, inProgress: 0, awaitingApproval: 0, revisionRequested: 0, approved: 0 };
        allMockups.forEach(function (m) {
            var s = (m.Status || '').toLowerCase();
            if (s === 'submitted') counts.submitted++;
            else if (s === 'in progress') counts.inProgress++;
            else if (s === 'awaiting approval') counts.awaitingApproval++;
            else if (s === 'revision requested') counts.revisionRequested++;
            else if (s === 'approved') counts.approved++;
        });

        var html = '<div class="status-summary" style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">';
        if (counts.awaitingApproval > 0) {
            html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;font-size:14px;cursor:pointer;" onclick="MockupAeGallery.filterByStatus(\'Awaiting Approval\')">'
                + '<span style="font-weight:700;font-size:18px;color:#d97706;">' + counts.awaitingApproval + '</span>'
                + '<span style="font-weight:500;color:#92400e;">Needs Your Review</span></div>';
        }
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;background:#f8f5ff;border:1px solid #e9e0f5;font-size:14px;">'
            + '<span style="font-weight:700;font-size:18px;">' + counts.submitted + '</span>'
            + '<span style="font-weight:500;color:#666;">Submitted</span></div>';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;background:#eff6ff;border:1px solid #bfdbfe;font-size:14px;">'
            + '<span style="font-weight:700;font-size:18px;">' + counts.inProgress + '</span>'
            + '<span style="font-weight:500;color:#666;">In Progress</span></div>';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;background:#ecfdf5;border:1px solid #a7f3d0;font-size:14px;">'
            + '<span style="font-weight:700;font-size:18px;">' + counts.approved + '</span>'
            + '<span style="font-weight:500;color:#666;">Approved</span></div>';
        html += '</div>';

        // Card grid
        html += '<div class="mockup-grid">';
        allMockups.forEach(function (m) {
            html += buildCard(m);
        });
        html += '</div>';

        container.innerHTML = html;

        // Wire card clicks
        container.querySelectorAll('.mockup-card').forEach(function (card) {
            card.addEventListener('click', function () {
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

        var badges = '';
        if (mockupType) {
            badges += '<span class="card-badge">' + mockupType + '</span>';
        }
        if (revCount > 0) {
            badges += '<span class="card-badge card-badge--revision">Rev ' + revCount + '</span>';
        }

        // Highlight awaiting approval with a subtle CTA
        var ctaHtml = '';
        if (status === 'Awaiting Approval') {
            ctaHtml = '<div class="card-actions">'
                + '<span style="font-size:12px;color:#d97706;font-weight:600;padding:6px 0;">&#9888; Needs your review</span>'
                + '</div>';
        }

        return '<div class="mockup-card" data-mockup-id="' + id + '" style="cursor:pointer;">'
            + '<div class="card-header">'
            + '  <div class="card-header-left">'
            + '    <div class="card-company">' + company + '</div>'
            + '    <div class="card-design-number">#' + designNum + '</div>'
            + '  </div>'
            + '  <div class="card-header-right">'
            + '    <span class="status-pill ' + statusClass + '">' + escapeHtml(status) + '</span>'
            + '  </div>'
            + '</div>'
            + '<div class="card-body">'
            + (designName ? '<div class="card-design-name">' + designName + '</div>' : '')
            + (badges ? '<div class="card-badges">' + badges + '</div>' : '')
            + '</div>'
            + '<div class="card-footer">'
            + '  <span class="card-date">' + submittedDate + '</span>'
            + '  <span class="card-action-link">View Details &rarr;</span>'
            + '</div>'
            + ctaHtml
            + '</div>';
    }

    function filterByStatus(status) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var filtered = allMockups.filter(function (m) { return m.Status === status; });

        var html = '<div style="margin-bottom:16px;">'
            + '<button onclick="MockupAeGallery.init(\'' + containerId + '\')" '
            + 'style="padding:6px 14px;border:1px solid #d1d5db;border-radius:4px;background:white;cursor:pointer;font-size:13px;font-family:inherit;">'
            + '&larr; Show All</button>'
            + '<span style="margin-left:12px;font-size:14px;color:#666;">Showing: <strong>' + escapeHtml(status) + '</strong> (' + filtered.length + ')</span>'
            + '</div>';

        html += '<div class="mockup-grid">';
        filtered.forEach(function (m) { html += buildCard(m); });
        html += '</div>';

        container.innerHTML = html;

        container.querySelectorAll('.mockup-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var id = card.dataset.mockupId;
                if (id) window.location.href = '/mockup/' + id + '?view=ae';
            });
        });
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

    return {
        init: init,
        filterByStatus: filterByStatus
    };

})();
