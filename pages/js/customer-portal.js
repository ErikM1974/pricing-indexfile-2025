/**
 * Customer Portal — /portal/:customerId
 * Shows all mockups and art requests for a company.
 * No login required — URL-based access (sales rep shares the link).
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // Only show records from 2026 onwards (before that, images weren't consistently uploaded)
    var DATE_CUTOFF = '2026-01-01T00:00:00';

    // ── Parse customer ID from URL ──
    var pathParts = window.location.pathname.split('/');
    var customerId = pathParts[pathParts.length - 1];

    if (!customerId || !/^\d+$/.test(customerId)) {
        showError('Invalid Link', 'This link doesn\'t appear to be valid. Please contact your account representative for the correct link.');
        return;
    }

    // ── Load portal data ──
    loadPortalData(customerId);

    function loadPortalData(custId) {
        // Step 1: Look up company name from customer ID
        fetch(API_BASE + '/api/company-contacts/search?q=' + custId + '&limit=1&searchById=true')
            .then(function (resp) {
                if (!resp.ok) throw new Error('Contact lookup failed: ' + resp.status);
                return resp.json();
            })
            .then(function (contactData) {
                var contacts = contactData.contacts || contactData || [];
                // Find contact matching this customer ID
                var match = null;
                if (Array.isArray(contacts)) {
                    match = contacts.find(function (c) { return String(c.id_Customer) === String(custId); });
                }

                if (!match) {
                    // Try direct by-customer lookup
                    return fetch(API_BASE + '/api/company-contacts/by-customer/' + custId)
                        .then(function (r) {
                            if (!r.ok) throw new Error('not found');
                            return r.json();
                        })
                        .then(function (data) {
                            var arr = data.contacts || data || [];
                            if (Array.isArray(arr) && arr.length > 0) return arr[0];
                            throw new Error('not found');
                        })
                        .catch(function () {
                            // Fallback: company may only have art requests (no contact record yet).
                            // Look up company name from art requests by Shopwork_customer_number.
                            return fetch(API_BASE + '/api/artrequests?shopworksCustomerId=' + custId + '&limit=1')
                                .then(function (r) { return r.ok ? r.json() : null; })
                                .then(function (data) {
                                    if (!data) throw new Error('not found');
                                    var records = Array.isArray(data) ? data : (data.records || []);
                                    if (records.length > 0 && records[0].CompanyName) {
                                        return { CustomerCompanyName: records[0].CompanyName, id_Customer: custId };
                                    }
                                    // Last resort: try mockups table
                                    return fetch(API_BASE + '/api/mockups?idCustomer=' + custId + '&limit=1')
                                        .then(function (r2) { return r2.ok ? r2.json() : null; })
                                        .then(function (mData) {
                                            if (!mData) throw new Error('not found');
                                            var mRecs = mData.records || mData || [];
                                            if (Array.isArray(mRecs) && mRecs.length > 0 && mRecs[0].Company_Name) {
                                                return { CustomerCompanyName: mRecs[0].Company_Name, id_Customer: custId };
                                            }
                                            throw new Error('not found');
                                        });
                                });
                        });
                }
                return match;
            })
            .then(function (contact) {
                var companyName = contact.CustomerCompanyName || contact.companyName || 'Customer';
                document.getElementById('cp-company-name').textContent = companyName;
                document.title = companyName + ' — Design Portal | NWCA';

                // Step 2: Fetch mockups and art requests in parallel
                return Promise.all([
                    fetchMockups(companyName, customerId),
                    fetchArtRequests(companyName, customerId)
                ]);
            })
            .then(function (results) {
                var mockups = results[0];
                var artRequests = results[1];

                renderMockups(mockups);
                renderArtRequests(artRequests);

                // Show content, hide loading
                document.getElementById('cp-loading').style.display = 'none';
                document.getElementById('cp-content').style.display = 'block';
            })
            .catch(function (err) {
                console.error('Portal load error:', err);
                if (err.message === 'not found') {
                    showError('Company Not Found', 'We couldn\'t find an account with this ID. Please contact us at (253) 922-5793 for assistance.');
                } else {
                    showError('Unable to Load', 'Something went wrong loading your portal. Please refresh the page or call us at (253) 922-5793.');
                }
            });
    }

    // ── Fetch mockups by company name (2026+ with images only) ──
    function fetchMockups(companyName, custId) {
        // Query by customer ID (reliable) with company name fallback
        var url = API_BASE + '/api/mockups?idCustomer=' + encodeURIComponent(custId)
            + '&dateFrom=' + encodeURIComponent(DATE_CUTOFF);
        return fetch(url)
            .then(function (resp) {
                if (!resp.ok) throw new Error('Mockups fetch failed: ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var records = data.records || data || [];
                // Only show mockups that have at least one image
                return records.filter(function (m) {
                    return m.Box_Mockup_1 || m.Box_Mockup_2 || m.Box_Mockup_3;
                });
            })
            .catch(function (err) {
                console.error('Mockups fetch error:', err);
                return [];
            });
    }

    // ── Fetch art requests by company name + ShopWorks customer number (2026+ with images only) ──
    function fetchArtRequests(companyName, custId) {
        // Try by ShopWorks customer number first, fall back to company name
        var url = API_BASE + '/api/artrequests?shopworksCustomerId=' + encodeURIComponent(custId)
            + '&dateCreatedFrom=' + encodeURIComponent(DATE_CUTOFF);
        return fetch(url)
            .then(function (resp) {
                if (!resp.ok) throw new Error('Art requests fetch failed: ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                var records = Array.isArray(data) ? data : (data.records || []);
                if (records.length > 0) return filterArtWithImages(records);

                // Fallback: try by company name
                var nameUrl = API_BASE + '/api/artrequests?companyName=' + encodeURIComponent(companyName)
                    + '&dateCreatedFrom=' + encodeURIComponent(DATE_CUTOFF);
                return fetch(nameUrl)
                    .then(function (r) { return r.json(); })
                    .then(function (d) {
                        var recs = Array.isArray(d) ? d : (d.records || []);
                        return filterArtWithImages(recs);
                    });
            })
            .catch(function (err) {
                console.error('Art requests fetch error:', err);
                return [];
            });
    }

    // Filter art requests to only those with at least one image
    function filterArtWithImages(records) {
        return records.filter(function (ar) {
            return ar.MAIN_IMAGE_URL_1 || ar.MAIN_IMAGE_URL_2 || ar.MAIN_IMAGE_URL_3 || ar.MAIN_IMAGE_URL_4;
        });
    }

    // ── Render mockup cards ──
    function renderMockups(mockups) {
        var grid = document.getElementById('cp-mockup-grid');
        var countEl = document.getElementById('cp-mockup-count');
        var emptyEl = document.getElementById('cp-mockup-empty');

        countEl.textContent = mockups.length;

        if (mockups.length === 0) {
            grid.style.display = 'none';
            emptyEl.style.display = 'block';
            return;
        }

        // Sort: action-needed first, then newest
        mockups.sort(function (a, b) {
            var aAction = needsAction(a.Status) ? 0 : 1;
            var bAction = needsAction(b.Status) ? 0 : 1;
            if (aAction !== bAction) return aAction - bAction;
            return new Date(b.Submitted_Date || 0) - new Date(a.Submitted_Date || 0);
        });

        var html = '';
        mockups.forEach(function (m) {
            var imgUrl = m.Box_Mockup_1 ? ('/api/image-proxy?url=' + encodeURIComponent(m.Box_Mockup_1)) : '';
            var isAction = needsAction(m.Status);
            var designLabel = m.Design_Number ? ('Design #' + escapeHtml(m.Design_Number)) : 'Mockup';
            var meta = [m.Print_Location, m.Mockup_Type].filter(Boolean).join(' \u00B7 ');

            html += '<a class="cp-card' + (isAction ? ' cp-card--action-needed' : '') + '" '
                + 'href="/mockup/' + m.ID + '?view=customer" target="_blank">'
                + '<div class="cp-card-image">';

            if (imgUrl) {
                html += '<img src="' + imgUrl + '" alt="Mockup" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=cp-card-placeholder>&#128085;</div>\'">';
            } else {
                html += '<div class="cp-card-placeholder">&#128085;</div>';
            }

            if (isAction) {
                html += '<div class="cp-action-badge">Action Needed</div>';
            }

            html += '</div>'
                + '<div class="cp-card-body">'
                + '<div class="cp-card-design">' + designLabel + '</div>'
                + '<div class="cp-card-name">' + escapeHtml(m.Design_Name || '') + '</div>';

            if (meta) {
                html += '<div class="cp-card-meta">' + escapeHtml(meta) + '</div>';
            }

            html += '<div class="cp-card-footer">'
                + renderStatusBadge(m.Status)
                + '<div class="cp-card-date">' + formatDate(m.Submitted_Date) + '</div>'
                + '</div>'
                + '</div></a>';
        });

        grid.innerHTML = html;
    }

    // ── Render art request cards ──
    function renderArtRequests(artRequests) {
        var grid = document.getElementById('cp-art-grid');
        var countEl = document.getElementById('cp-art-count');
        var emptyEl = document.getElementById('cp-art-empty');

        countEl.textContent = artRequests.length;

        if (artRequests.length === 0) {
            grid.style.display = 'none';
            emptyEl.style.display = 'block';
            return;
        }

        // Sort: action-needed first, then newest
        artRequests.sort(function (a, b) {
            var aAction = needsAction(a.Status) ? 0 : 1;
            var bAction = needsAction(b.Status) ? 0 : 1;
            if (aAction !== bAction) return aAction - bAction;
            return new Date(b.Date_Created || 0) - new Date(a.Date_Created || 0);
        });

        var html = '';
        artRequests.forEach(function (ar) {
            var imgUrl = ar.MAIN_IMAGE_URL_1 ? ('/api/image-proxy?url=' + encodeURIComponent(ar.MAIN_IMAGE_URL_1)) : '';
            var isAction = needsAction(ar.Status);
            var designLabel = ar.Design_Num_SW ? ('Design #' + escapeHtml(String(ar.Design_Num_SW))) : 'Art Request';
            var garmentInfo = [ar.GarmentStyle, ar.GarmentColor].filter(Boolean).join(' \u00B7 ');

            // Get order type text (Caspio dropdowns can return objects)
            var orderType = ar.Order_Type || '';
            if (typeof orderType === 'object') {
                var keys = Object.keys(orderType);
                orderType = keys.length > 0 ? orderType[keys[0]] : '';
            }

            html += '<a class="cp-card' + (isAction ? ' cp-card--action-needed' : '') + '" '
                + 'href="/art-request/' + ar.PK_ID + '?view=customer" target="_blank">'
                + '<div class="cp-card-image">';

            if (imgUrl) {
                html += '<img src="' + imgUrl + '" alt="Design" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=cp-card-placeholder>&#127912;</div>\'">';
            } else {
                html += '<div class="cp-card-placeholder">&#127912;</div>';
            }

            if (isAction) {
                html += '<div class="cp-action-badge">Action Needed</div>';
            }

            html += '</div>'
                + '<div class="cp-card-body">'
                + '<div class="cp-card-design">' + designLabel + '</div>';

            if (garmentInfo) {
                html += '<div class="cp-card-name">' + escapeHtml(garmentInfo) + '</div>';
            }

            if (orderType) {
                html += '<div class="cp-card-meta">' + escapeHtml(String(orderType)) + '</div>';
            }

            html += '<div class="cp-card-footer">'
                + renderStatusBadge(ar.Status)
                + '<div class="cp-card-date">' + formatDate(ar.Date_Created) + '</div>'
                + '</div>'
                + '</div></a>';
        });

        grid.innerHTML = html;
    }

    // ── Helpers ──

    function needsAction(status) {
        if (!status) return false;
        var s = status.toLowerCase().replace(/\s+/g, '-');
        return s === 'awaiting-approval' || s === 'revision-requested';
    }

    function renderStatusBadge(status) {
        if (!status) return '<span class="cp-status">Unknown</span>';
        var slug = status.toLowerCase().replace(/\s+/g, '-');
        return '<span class="cp-status cp-status--' + slug + '">' + escapeHtml(status) + '</span>';
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            var d = new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
        } catch (e) {
            return '';
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function showError(title, message) {
        document.getElementById('cp-loading').style.display = 'none';
        document.getElementById('cp-error').style.display = 'block';
        document.getElementById('cp-error-title').textContent = title;
        document.getElementById('cp-error-message').textContent = message;
    }
})();
