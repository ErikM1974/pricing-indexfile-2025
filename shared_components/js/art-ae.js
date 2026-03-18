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
    var SELECT_FIELDS = 'PK_ID,ID_Design,CompanyName,Design_Num_SW,Status,Order_Type,Sales_Rep,User_Email,Due_Date,Date_Created,Full_Name_Contact,Garment_Placement,Box_File_Mockup,BoxFileLink,Company_Mockup,Revision_Count,Art_Minutes,Prelim_Charges,Amount_Art_Billed,NOTES,Mockup';

    var containerId = null;
    var allRequests = [];
    var activeFilter = null;
    var searchTerm = '';
    var showAll = false;

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
        fetchRequests();
    }

    function fetchRequests() {
        var url = API_BASE + '/api/artrequests?orderBy=Date_Created DESC&limit=200'
            + '&select=' + SELECT_FIELDS;

        if (!showAll) {
            url += '&dateCreatedFrom=' + getDateFrom(DAYS_DEFAULT);
        }

        fetch(url)
            .then(function (r) {
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

    function getFilteredRequests() {
        var list = allRequests;
        if (activeFilter) {
            list = list.filter(function (r) {
                return normalizeStatus(r.Status) === activeFilter;
            });
        }
        if (searchTerm) {
            var term = searchTerm.toLowerCase();
            list = list.filter(function (r) {
                var company = (r.CompanyName || '').toLowerCase();
                var designNum = (r.Design_Num_SW || r.Design_Number || '').toLowerCase();
                var contact = (r.Full_Name_Contact || '').toLowerCase();
                return company.indexOf(term) !== -1 || designNum.indexOf(term) !== -1 || contact.indexOf(term) !== -1;
            });
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

        // Count statuses
        var counts = { submitted: 0, inProgress: 0, awaitingApproval: 0, completed: 0, other: 0 };
        allRequests.forEach(function (r) {
            var s = normalizeStatus(r.Status);
            if (s === 'Submitted') counts.submitted++;
            else if (s === 'In Progress') counts.inProgress++;
            else if (s === 'Awaiting Approval') counts.awaitingApproval++;
            else if (s === 'Completed') counts.completed++;
            else counts.other++;
        });

        var html = '';

        // Date range indicator
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">';
        if (showAll) {
            html += '<span style="font-size:13px;color:#6b7280;">Showing 200 most recent requests</span>'
                + '<button onclick="ArtAeGallery.toggleDateRange()" '
                + 'style="padding:4px 12px;border:1px solid #d1d5db;border-radius:4px;background:white;cursor:pointer;font-size:13px;font-family:inherit;color:#981e32;">'
                + 'Last 90 Days</button>';
        } else {
            html += '<span style="font-size:13px;color:#6b7280;">Showing last 90 days (' + allRequests.length + ' requests)</span>'
                + '<button onclick="ArtAeGallery.toggleDateRange()" '
                + 'style="padding:4px 12px;border:1px solid #d1d5db;border-radius:4px;background:white;cursor:pointer;font-size:13px;font-family:inherit;color:#981e32;">'
                + 'Show All</button>';
        }
        html += '</div>';

        // Search bar
        html += '<div style="display:flex;gap:12px;margin-bottom:16px;align-items:center;flex-wrap:wrap;">'
            + '<div style="flex:1;min-width:200px;max-width:340px;position:relative;">'
            + '<input type="text" id="art-ae-search" placeholder="Search company, design #, or contact..." '
            + 'value="' + escapeHtml(searchTerm) + '" '
            + 'style="width:100%;padding:8px 12px 8px 34px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:inherit;">'
            + '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#9ca3af;font-size:16px;">&#128269;</span>'
            + '</div>'
            + '</div>';

        // Status summary pills
        html += '<div class="status-summary" style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">';
        if (counts.awaitingApproval > 0) {
            html += statusPill(counts.awaitingApproval, 'Needs Review', 'Awaiting Approval', '#fff7ed', '#fed7aa', '#d97706', '#92400e');
        }
        html += statusPill(counts.submitted, 'Submitted', 'Submitted', '#fdf2f8', '#fce7f3', '#be185d', '#831843');
        html += statusPill(counts.inProgress, 'In Progress', 'In Progress', '#eff6ff', '#bfdbfe', '#2563eb', '#1e40af');
        html += statusPill(counts.completed, 'Completed', 'Completed', '#ecfdf5', '#a7f3d0', '#059669', '#065f46');
        if (counts.other > 0) {
            html += statusPill(counts.other, 'Other', null, '#f9fafb', '#e5e7eb', '#6b7280', '#374151');
        }
        html += '</div>';

        // Filter indicator
        if (activeFilter) {
            html += '<div style="margin-bottom:12px;">'
                + '<button onclick="ArtAeGallery.clearFilter()" '
                + 'style="padding:6px 14px;border:1px solid #d1d5db;border-radius:4px;background:white;cursor:pointer;font-size:13px;font-family:inherit;">'
                + '&larr; Show All</button>'
                + '<span style="margin-left:12px;font-size:14px;color:#666;">Showing: <strong>' + escapeHtml(activeFilter) + '</strong></span>'
                + '</div>';
        }

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
                var id = card.dataset.designId;
                if (id) window.location.href = '/art-request/' + id + '?view=ae';
            });
        });
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

    function statusPill(count, label, filterValue, bg, border, numColor, textColor) {
        var clickAttr = filterValue
            ? ' onclick="ArtAeGallery.filterByStatus(\'' + filterValue + '\')" style="cursor:pointer;'
            : ' style="';
        return '<div' + clickAttr + 'display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px;background:' + bg + ';border:1px solid ' + border + ';font-size:14px;">'
            + '<span style="font-weight:700;font-size:18px;color:' + numColor + ';">' + count + '</span>'
            + '<span style="font-weight:500;color:' + textColor + ';">' + label + '</span></div>';
    }

    function buildCard(req) {
        var designId = req.ID_Design || req.PK_ID;
        var company = escapeHtml(req.CompanyName || 'Unknown');
        var designNum = escapeHtml(req.Design_Num_SW || req.Design_Number || '—');
        var status = normalizeStatus(req.Status);
        var statusClass = 'status-pill--' + status.toLowerCase().replace(/\s+/g, '-');
        var orderType = parseOrderType(req.Order_Type);
        var dueDate = req.Due_Date;
        var createdDate = formatDate(req.Date_Created);
        var contact = escapeHtml(req.Full_Name_Contact || '');
        var revCount = req.Revision_Count || 0;
        var salesRep = escapeHtml(req.Sales_Rep || extractRepFromEmail(req.User_Email));
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
                + ' onerror="this.parentElement.style.display=\'none\';">'
                + '</div>';
        }

        // Badges
        var badges = '';
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

        // Sales rep
        var repHtml = salesRep
            ? '<div class="card-meta-row"><span class="card-meta-label">REP</span> ' + salesRep + '</div>'
            : '';

        return '<div class="mockup-card art-card" data-design-id="' + designId + '" style="cursor:pointer;">'
            + '<div class="card-header" style="background:var(--art-theme, #981e32);">'
            + '  <div class="card-header-left">'
            + '    <div class="card-company">' + company + '</div>'
            + '    <div class="card-design-number">#' + designNum + '</div>'
            + '  </div>'
            + '  <div class="card-header-right">'
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
            + repHtml
            + artChargeHtml
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

    function filterByStatus(status) {
        activeFilter = status;
        render();
    }

    function clearFilter() {
        activeFilter = null;
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

    return {
        init: init,
        filterByStatus: filterByStatus,
        clearFilter: clearFilter,
        toggleDateRange: toggleDateRange
    };

})();
