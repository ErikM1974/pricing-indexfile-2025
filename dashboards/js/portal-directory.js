/**
 * Portal Directory — Staff page for managing customer portals
 * Fetches mockups + art requests from 2026+, groups by company,
 * renders searchable/sortable cards with copy-link + open-portal actions.
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || '';
    if (!API_BASE) console.error('[portal-directory] APP_CONFIG.API.BASE_URL missing — the proxy host is not configured');
    var SITE_ORIGIN = 'https://www.teamnwca.com';
    var DATE_CUTOFF = '2026-01-01T00:00:00';

    var allCompanies = [];
    var searchTimeout = null;

    // Image fallback for the header logo (was an inline onerror= — Rule 3). `error` does not bubble → capture.
    document.addEventListener('error', function (e) {
        var img = e.target;
        if (img && img.tagName === 'IMG' && img.dataset && img.dataset.onerror === 'hide') img.hidden = true;
    }, true);

    // ── Load on ready ──
    loadDirectory();
    window._pdRetry = function () {
        document.getElementById('pd-error').hidden = true;
        document.getElementById('pd-loading').hidden = false;
        loadDirectory();
    };

    // ── Bind events ──
    document.getElementById('pd-search').addEventListener('input', function () {
        clearTimeout(searchTimeout);
        var term = this.value;
        searchTimeout = setTimeout(function () { filterAndRender(term); }, 300);
    });

    document.getElementById('pd-sort').addEventListener('change', function () {
        sortCompanies(this.value);
        renderCards(getFilteredCompanies());
    });

    // ── Main load ──
    function loadDirectory() {
        Promise.all([fetchMockups(), fetchArtRequests()])
            .then(function (results) {
                allCompanies = aggregateCompanies(results[0], results[1]);

                // Auto-resolve missing customer IDs from Company_Contacts table
                var needsId = allCompanies.filter(function (c) { return !c.customerId || c.customerId <= 0; });
                if (needsId.length > 0) {
                    return Promise.all(needsId.map(function (c) {
                        return fetch('/api/company-contacts/search?q=' + encodeURIComponent(c.displayName) + '&limit=3&includeInactive=true')
                            .then(function (r) { return r.ok ? r.json() : { contacts: [] }; })
                            .then(function (data) {
                                var contacts = data.contacts || data || [];
                                if (Array.isArray(contacts) && contacts.length > 0) {
                                    var match = contacts.find(function (ct) {
                                        return ct.CustomerCompanyName &&
                                            ct.CustomerCompanyName.toLowerCase() === c.displayName.toLowerCase();
                                    });
                                    if (match && match.id_Customer) {
                                        c.customerId = match.id_Customer;
                                    }
                                }
                            })
                            .catch(function () { /* skip — card stays as No ID */ });
                    }));
                }
            })
            .then(function () {
                sortCompanies('lastUpdated');

                document.getElementById('pd-loading').hidden = true;
                document.getElementById('pd-toolbar').hidden = false;

                if (allCompanies.length === 0) {
                    document.getElementById('pd-empty').hidden = false;
                } else {
                    document.getElementById('pd-grid').hidden = false;
                    renderCards(allCompanies);
                    updateStats(allCompanies.length, allCompanies.length);
                }
            })
            .catch(function (err) {
                console.error('Portal directory load error:', err);
                showError('Unable to Load', 'Something went wrong loading the directory (' + (err && err.message ? err.message : 'unknown error') + ').');
            });
    }

    // ── Fetch mockups (2026+ with images) ──
    // A failed feed used to resolve to [] and the page rendered as if that source were simply empty
    // (a silent half-directory). Now it throws so the error panel + Retry show (Erik's #1 rule).
    function fetchMockups() {
        return fetch('/api/mockups?dateFrom=' + encodeURIComponent(DATE_CUTOFF) + '&pageSize=1000')
            .then(function (r) {
                if (!r.ok) throw new Error('Mockups: ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var records = data.records || data || [];
                return records.filter(function (m) {
                    return m.Box_Mockup_1 || m.Box_Mockup_2 || m.Box_Mockup_3;
                });
            });
    }

    // ── Fetch art requests (2026+ with images) ──
    function fetchArtRequests() {
        return fetch(API_BASE + '/api/artrequests?dateCreatedFrom=' + encodeURIComponent(DATE_CUTOFF) + '&pageSize=1000')
            .then(function (r) {
                if (!r.ok) throw new Error('Art requests: ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var records = Array.isArray(data) ? data : (data.records || []);
                return records.filter(function (ar) {
                    return ar.MAIN_IMAGE_URL_1 || ar.MAIN_IMAGE_URL_2 || ar.MAIN_IMAGE_URL_3 || ar.MAIN_IMAGE_URL_4;
                });
            });
    }

    // ── Group by company ──
    function aggregateCompanies(mockups, artRequests) {
        var map = {};

        mockups.forEach(function (m) {
            var name = (m.Company_Name || '').trim();
            if (!name) return;
            var key = name.toLowerCase();
            if (!map[key]) map[key] = createEntry(name);
            var entry = map[key];
            entry.mockupCount++;
            updateLastActivity(entry, m.Submitted_Date);
            if (m.Id_Customer && m.Id_Customer > 0) entry.customerId = m.Id_Customer;
            if (m.Sales_Rep && !entry.salesRep) entry.salesRep = m.Sales_Rep;
        });

        artRequests.forEach(function (ar) {
            var name = (ar.CompanyName || '').trim();
            if (!name) return;
            var key = name.toLowerCase();
            if (!map[key]) map[key] = createEntry(name);
            var entry = map[key];
            entry.artCount++;
            updateLastActivity(entry, ar.Date_Created);
            if (ar.Shopwork_customer_number && !entry.customerId) {
                entry.customerId = ar.Shopwork_customer_number;
            }
            if (ar.Sales_Rep && !entry.salesRep) entry.salesRep = ar.Sales_Rep;
        });

        return Object.keys(map).map(function (k) { return map[k]; });
    }

    function createEntry(displayName) {
        return {
            displayName: displayName,
            customerId: null,
            mockupCount: 0,
            artCount: 0,
            lastActivity: null,
            salesRep: null
        };
    }

    function updateLastActivity(entry, dateStr) {
        if (!dateStr) return;
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return;
        if (!entry.lastActivity || d > entry.lastActivity) {
            entry.lastActivity = d;
        }
    }

    // ── Sort ──
    function sortCompanies(sortBy) {
        allCompanies.sort(function (a, b) {
            if (sortBy === 'nameAZ') {
                return a.displayName.localeCompare(b.displayName);
            }
            if (sortBy === 'mostItems') {
                return (b.mockupCount + b.artCount) - (a.mockupCount + a.artCount);
            }
            // lastUpdated (default)
            var da = a.lastActivity ? a.lastActivity.getTime() : 0;
            var db = b.lastActivity ? b.lastActivity.getTime() : 0;
            return db - da;
        });
    }

    // ── Search/filter ──
    function getFilteredCompanies() {
        var term = (document.getElementById('pd-search').value || '').trim().toLowerCase();
        if (!term) return allCompanies;
        return allCompanies.filter(function (c) {
            return c.displayName.toLowerCase().indexOf(term) !== -1;
        });
    }

    function filterAndRender(term) {
        var filtered = getFilteredCompanies();
        renderCards(filtered);
        updateStats(filtered.length, allCompanies.length);
    }

    // ── Update stats ──
    function updateStats(showing, total) {
        var totalMockups = 0;
        var totalArt = 0;
        allCompanies.forEach(function (c) {
            totalMockups += c.mockupCount;
            totalArt += c.artCount;
        });
        var text = showing < total
            ? 'Showing ' + showing + ' of ' + total + ' companies'
            : total + ' companies';
        text += ' \u00B7 ' + totalMockups + ' mockups \u00B7 ' + totalArt + ' art requests';
        document.getElementById('pd-stats').textContent = text;
    }

    // ── Render cards ──
    function renderCards(companies) {
        var grid = document.getElementById('pd-grid');

        if (companies.length === 0) {
            grid.innerHTML = '<div class="pd-empty"><div class="pd-empty-text">No companies match your search.</div></div>';
            return;
        }

        var now = new Date();
        var html = '';

        companies.forEach(function (c) {
            var dotClass = getActivityDotClass(c.lastActivity, now);
            var dotTitle = c.lastActivity ? formatDate(c.lastActivity) : 'No activity';
            var hasId = c.customerId && c.customerId > 0;
            // Customers open /portal (their session decides the account). Staff cannot see a customer's
            // portal that way — /portal/:id just bounces to /portal — so "Open" goes to the read-only
            // staff mirror instead. "Copy Link" stays the customer-facing URL.
            var previewUrl = hasId ? ('/portal-admin/preview/' + c.customerId) : '';
            var totalItems = c.mockupCount + c.artCount;

            html += '<div class="pd-card" data-company="' + escapeAttr(c.displayName.toLowerCase()) + '">'
                + '<div class="pd-card-header">'
                + '<h3 class="pd-card-company">' + escapeHtml(c.displayName) + '</h3>'
                + '<span class="pd-dot ' + dotClass + '" role="img" title="' + escapeAttr(dotTitle) + '" aria-label="Last activity ' + escapeAttr(dotTitle) + '"></span>'
                + '</div>'

                + '<div class="pd-card-stats">'
                + '<span class="pd-stat"><i class="fas fa-image" aria-hidden="true"></i> ' + c.mockupCount + ' mockup' + (c.mockupCount !== 1 ? 's' : '') + '</span>'
                + '<span class="pd-stat-divider">&middot;</span>'
                + '<span class="pd-stat"><i class="fas fa-palette" aria-hidden="true"></i> ' + c.artCount + ' art request' + (c.artCount !== 1 ? 's' : '') + '</span>'
                + '</div>'

                + '<div class="pd-card-meta">'
                + '<span>' + (c.salesRep ? escapeHtml(c.salesRep) : '\u2014') + '</span>'
                + '<span>' + (c.lastActivity ? 'Last: ' + formatDate(c.lastActivity) : '') + '</span>'
                + '</div>'

                + '<div class="pd-card-actions">';

            if (hasId) {
                html += '<button type="button" class="pd-btn-copy" data-call="_pdCopy" data-args="' + escapeAttr(JSON.stringify([c.customerId, '$this'])) + '" title="Copy the customer-facing portal link" aria-label="Copy portal link for ' + escapeAttr(c.displayName) + '">'
                    + '<i class="fas fa-copy" aria-hidden="true"></i> Copy Link</button>'
                    + '<a class="pd-btn-open" href="' + escapeAttr(previewUrl) + '" target="_blank" rel="noopener" title="Preview their portal (read-only staff view)" aria-label="Preview portal for ' + escapeAttr(c.displayName) + '">'
                    + '<i class="fas fa-eye" aria-hidden="true"></i> Preview</a>';
            } else {
                html += '<button type="button" class="pd-btn-copy" disabled title="No customer ID on file">'
                    + '<i class="fas fa-copy" aria-hidden="true"></i> No ID</button>'
                    + '<span class="pd-btn-open is-disabled" aria-disabled="true">'
                    + '<i class="fas fa-eye" aria-hidden="true"></i> Preview</span>';
            }

            html += '</div></div>';
        });

        grid.innerHTML = html;
    }

    // ── Activity dot ──
    function getActivityDotClass(lastActivity, now) {
        if (!lastActivity) return 'pd-dot--red';
        var days = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
        if (days <= 7) return 'pd-dot--green';
        if (days <= 30) return 'pd-dot--amber';
        return 'pd-dot--red';
    }

    // ── Copy link (data-call target) ──
    window._pdCopy = function (customerId, btnEl) {
        var url = SITE_ORIGIN + '/portal/' + customerId;
        navigator.clipboard.writeText(url).then(function () {
            btnEl.classList.add('pd-copied');
            btnEl.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Copied!';
            showToast('Portal link copied!');
            setTimeout(function () {
                btnEl.innerHTML = '<i class="fas fa-copy" aria-hidden="true"></i> Copy Link';
                btnEl.classList.remove('pd-copied');
            }, 2000);
        }).catch(function () {
            // Clipboard blocked (http, permissions) — show the link so it can be selected by hand.
            showToast('Copy blocked by the browser — link: ' + url, 6000);
        });
    };

    // ── Toast ──
    var toastTimer = null;
    function showToast(msg, ms) {
        var toast = document.getElementById('pd-toast');
        toast.textContent = msg;
        toast.classList.add('pd-toast--show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toast.classList.remove('pd-toast--show');
        }, ms || 2500);
    }

    // ── Error ──
    function showError(title, message) {
        document.getElementById('pd-loading').hidden = true;
        document.getElementById('pd-error').hidden = false;
        document.getElementById('pd-error-title').textContent = title;
        document.getElementById('pd-error-message').textContent = message;
    }

    // ── Helpers ──
    function formatDate(d) {
        if (!d) return '';
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
    }
})();
