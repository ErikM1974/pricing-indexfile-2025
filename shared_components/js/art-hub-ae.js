/**
 * art-hub-ae.js — AE Gallery Card Processor
 *
 * Processes the SAME Caspio DataPage cards as art-hub-steve.js but with
 * AE-specific enhancements: simplified footer (View Details only),
 * maroon theme, audit badges, and ?view=ae detail page links.
 *
 * This file mirrors the card-processing pipeline from art-hub-steve.js
 * but omits Steve-specific features (action buttons, notes panel, modals).
 *
 * Depends on: art-hub.css (shared styles), APP_CONFIG
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // ── Rep Email Map ────────────────────────────────────────────────
    var REP_EMAIL_MAP = {
        'Taneisha': 'taneisha@nwcustomapparel.com',
        'Nika': 'nika@nwcustomapparel.com',
        'Ruthie': 'ruthie@nwcustomapparel.com',
        'Erik': 'erik@nwcustomapparel.com'
    };

    // ── Escape HTML ──────────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Card Enhancement Functions (from art-hub-steve.js) ───────────

    function addRequestTypeBadge(card) {
        if (card.querySelector('.badge--mockup')) return;
        var typeSpan = card.querySelector('.cb-request-type');
        if (!typeSpan) return;
        var type = typeSpan.textContent.trim();
        if (type.toLowerCase() !== 'mockup') return;

        var badge = document.createElement('span');
        badge.className = 'badge badge--mockup';
        badge.textContent = '\uD83D\uDCF8 MOCKUP';
        var companyEl = card.querySelector('.company-name');
        if (companyEl) {
            companyEl.parentNode.insertBefore(badge, companyEl.nextSibling);
        } else {
            card.prepend(badge);
        }
    }

    function styleCardPills(card) {
        var block = card.closest('div[data-cb-name="data-row"]');
        if (!block) return;

        var duePill = card.querySelector('.due-status-pill');
        var calcField = block.querySelector('.cbResultSetCalculatedField');
        if (duePill && calcField) {
            var text = calcField.textContent.trim();
            duePill.textContent = text;
            duePill.className = 'pill due-status-pill due-' + text.toLowerCase().replace(/ /g, '-');
        }

        var statusPill = card.querySelector('.status-pill');
        if (statusPill) {
            var text2 = statusPill.textContent.trim();
            var clean = text2.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().toLowerCase().replace(/\s+/g, '');
            statusPill.className = 'pill status-pill status-' + clean;
        }
    }

    function calculateArtHours(card) {
        var chargeSpan = card.querySelector('.charge-amount');
        var hoursSpan = card.querySelector('.charge-hours');
        if (!chargeSpan || !hoursSpan) return;

        var quotedCharge = parseFloat(chargeSpan.textContent.replace('$', '')) || 0;
        var quotedHours = quotedCharge > 0 ? (Math.ceil(quotedCharge / 18.75) * 0.25) : 0;

        var actualMinsSpan = card.querySelector('.actual-minutes');
        var actualMins = actualMinsSpan ? (parseInt(actualMinsSpan.textContent) || 0) : 0;
        var actualHours = actualMins > 0 ? (Math.ceil(actualMins / 15) * 0.25) : 0;
        var actualCost = actualHours * 75;

        var valueDiv = chargeSpan.closest('.value');
        if (!valueDiv) {
            hoursSpan.textContent = quotedHours.toFixed(2) + ' hrs';
            return;
        }

        var html = '<div class="charge-line charge-line--quoted">';
        html += '<span class="charge-label">Quoted</span>';
        html += '<span class="charge-val">$' + quotedCharge.toFixed(2) + '</span>';
        html += '<span class="charge-sep">&middot;</span>';
        html += '<span class="charge-hrs">' + quotedHours.toFixed(2) + ' hrs</span>';
        html += '</div>';

        html += '<div class="charge-line charge-line--actual">';
        html += '<span class="charge-label">Actual</span>';
        if (actualMins > 0) {
            html += '<span class="charge-val">$' + actualCost.toFixed(2) + '</span>';
            html += '<span class="charge-sep">&middot;</span>';
            html += '<span class="charge-hrs">' + actualHours.toFixed(2) + ' hrs</span>';
        } else {
            html += '<span class="charge-val charge-val--none">No time logged</span>';
        }
        html += '</div>';

        valueDiv.innerHTML = html;
    }

    function formatRepName(card) {
        var repEl = card.querySelector('.rep-name');
        if (!repEl || repEl.dataset.formatted) return;
        repEl.dataset.formatted = '1';

        var email = (repEl.dataset.email || repEl.textContent || '').trim();
        if (!email) return;

        var displayName = '';
        for (var name in REP_EMAIL_MAP) {
            if (email.toLowerCase() === REP_EMAIL_MAP[name].toLowerCase()) {
                displayName = name;
                break;
            }
        }

        if (!displayName) {
            var atIndex = email.indexOf('@');
            if (atIndex > 0) {
                var local = email.substring(0, atIndex);
                displayName = local.charAt(0).toUpperCase() + local.slice(1);
            } else {
                displayName = email;
            }
        }

        repEl.textContent = displayName;
        repEl.title = email;
        repEl.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = 'mailto:' + email;
        });
    }

    function cleanEmptyFields(card) {
        var swNum = card.querySelector('.design-num');
        if (swNum && !swNum.textContent.trim()) swNum.style.display = 'none';

        var contactItem = card.querySelector('.info-item-contact');
        if (contactItem) {
            var val = contactItem.querySelector('.value');
            if (val && !val.textContent.trim()) contactItem.style.display = 'none';
        }
    }

    // ── AE-Specific Footer (simplified — View Details only) ─────────

    function injectAEFooter(card) {
        if (card.querySelector('.card-footer-buttons')) return;

        var statusPill = card.querySelector('.status-pill');
        var status = '';
        if (statusPill) {
            status = statusPill.textContent.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().toLowerCase().replace(/\s+/g, '');
        }

        var isCompleted = status === 'completed';
        var isApproved = status === 'approved';
        var isCancelled = status === 'cancel';

        if (isCompleted) {
            var duePill = card.querySelector('.due-status-pill');
            if (duePill) duePill.style.display = 'none';
            card.classList.add('card--completed');
        }
        if (isCancelled) {
            card.classList.add('card--cancel');
        }

        var idDiv = card.querySelector('.id-design');
        if (!idDiv) return;
        var designId = idDiv.textContent.replace(/[^0-9]/g, '');
        if (!designId) return;

        var footer = card.querySelector('.card-footer');
        if (!footer) return;

        var container = document.createElement('div');
        container.className = 'card-footer-buttons';

        // Single row: View Details link
        var infoRow = document.createElement('div');
        infoRow.className = 'footer-info-row';

        var detailsLink = document.createElement('a');
        detailsLink.className = 'card-details-link';
        detailsLink.textContent = 'View Details \u2192';
        detailsLink.href = '/art-request/' + designId + '?view=ae';
        detailsLink.target = '_blank';
        detailsLink.addEventListener('click', function (e) {
            e.stopPropagation();
        });
        infoRow.appendChild(detailsLink);

        // Add Reopen button for Approved/Completed
        if (isApproved || isCompleted) {
            var reopenBtn = document.createElement('button');
            reopenBtn.className = 'card-reopen-btn';
            reopenBtn.textContent = 'Reopen';
            reopenBtn.title = 'Reopen for additional changes';
            reopenBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var b = this;
                if (!confirm('Reopen this request for changes?')) return;
                b.disabled = true;
                b.textContent = 'Reopening...';
                var reopenFromLabel = isApproved ? 'Approved' : 'Completed';
                fetch(API_BASE + '/api/art-requests/' + designId + '/status', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'In Progress' })
                }).then(function (resp) {
                    if (!resp.ok) throw new Error('Status ' + resp.status);
                    fetch(API_BASE + '/api/art-requests/' + designId + '/note', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            noteType: 'Status Change',
                            noteText: 'Reopened from ' + reopenFromLabel + ' by AE',
                            noteBy: 'ae@nwcustomapparel.com'
                        })
                    }).catch(function () {});
                    b.textContent = 'Reopened!';
                    b.style.background = '#28a745';
                    b.style.color = '#fff';
                    setTimeout(function () { location.reload(); }, 800);
                }).catch(function (err) {
                    b.textContent = 'Error';
                    b.style.background = '#dc3545';
                    b.style.color = '#fff';
                    setTimeout(function () { b.textContent = 'Reopen'; b.style.background = ''; b.style.color = ''; b.disabled = false; }, 2000);
                });
            });
            infoRow.appendChild(reopenBtn);
        }

        container.appendChild(infoRow);
        footer.appendChild(container);

        // Make whole card clickable — opens detail page in new tab
        card.style.cursor = 'pointer';
        card.addEventListener('click', function (e) {
            // Don't intercept clicks on links, buttons, or footer
            if (e.target.closest('a, button, .card-footer-buttons, .card-details-link')) return;
            e.preventDefault();
            e.stopPropagation();
            window.open('/art-request/' + designId + '?view=ae', '_blank');
        });
    }

    // ── Image Modal ──────────────────────────────────────────────────
    // Reuse the showModal from Steve's page or create a simple one
    if (!window.showModal) {
        window.showModal = function (src) {
            var modal = document.getElementById('imageModal');
            var modalImg = document.getElementById('modalImage');
            if (modal && modalImg) {
                modalImg.src = src;
                modal.classList.add('show');
            }
        };
    }

    // ── Audit Badge System (IntersectionObserver) ────────────────────

    var auditObserver = null;

    function initAuditObserver() {
        if (auditObserver) return;
        auditObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var card = entry.target;
                auditObserver.unobserve(card);
                loadCardAudit(card);
            });
        }, { rootMargin: '200px' });
    }

    function addAuditIndicator(card) {
        if (card.dataset.auditQueued) return;
        var orderNum = '';
        var cbOrderSpan = card.querySelector('.cb-order-num');
        if (cbOrderSpan) {
            orderNum = cbOrderSpan.textContent.replace(/[^0-9]/g, '').trim();
        }
        if (!orderNum) {
            var labels = card.querySelectorAll('.label, .info-label');
            labels.forEach(function (lbl) {
                if (lbl.textContent.trim() === 'Order #') {
                    var val = lbl.nextElementSibling;
                    if (val) orderNum = val.textContent.replace(/[^0-9]/g, '').trim();
                }
            });
        }
        if (!orderNum) return;

        card.dataset.auditQueued = '1';
        card.dataset.auditOrder = orderNum;
        initAuditObserver();
        auditObserver.observe(card);
    }

    function getSteveCostFromCard(card) {
        var actualMinsSpan = card.querySelector('.actual-minutes');
        var actualMins = actualMinsSpan ? (parseInt(actualMinsSpan.textContent) || 0) : 0;
        var actualHours = actualMins > 0 ? (Math.ceil(actualMins / 15) * 0.25) : 0;
        return actualHours * 75;
    }

    function loadCardAudit(card) {
        var orderNum = card.dataset.auditOrder;
        if (!orderNum) return;

        fetch(API_BASE + '/api/manageorders/lineitems/' + encodeURIComponent(orderNum))
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                var items = data.result || [];
                var ART_PNS = ['Art', 'GRT-50', 'GRT-75'];
                var artItems = items.filter(function (item) {
                    return item.PartNumber && ART_PNS.indexOf(item.PartNumber.trim()) !== -1;
                });

                var steveCost = getSteveCostFromCard(card);

                if (artItems.length === 0) {
                    insertAuditBadge(card, 'No Art Charge', 'amber',
                        'No art charge found on invoice' + (steveCost > 0 ? ' \u2014 Steve: $' + steveCost.toFixed(2) : ''));
                    return;
                }

                var waived = false;
                var billedTotal = 0;
                artItems.forEach(function (item) {
                    var price = item.LineUnitPrice;
                    var desc = (item.PartDescription || '').toLowerCase();
                    if (price === null || price === 0 ||
                        desc.indexOf('waiv') !== -1 || desc.indexOf('no charge') !== -1 ||
                        desc.indexOf('n/c') !== -1 || desc.indexOf('comp') !== -1) {
                        waived = true;
                    } else {
                        billedTotal += parseFloat(price) || 0;
                    }
                });

                if (waived && billedTotal === 0) {
                    insertAuditBadge(card, 'Art Waived', 'red',
                        'Art charge waived on invoice' + (steveCost > 0 ? ' \u2014 Steve: $' + steveCost.toFixed(2) : ''));
                } else if (steveCost > billedTotal) {
                    var overage = steveCost - billedTotal;
                    insertAuditBadge(card, 'Art \u25B2 $' + billedTotal.toFixed(0), 'red',
                        'Steve: $' + steveCost.toFixed(2) + ' \u00B7 Billed: $' + billedTotal.toFixed(2) + ' \u2014 over by $' + overage.toFixed(2));
                } else {
                    insertAuditBadge(card, 'Art \u2713 $' + billedTotal.toFixed(0), 'green',
                        'Steve: $' + steveCost.toFixed(2) + ' \u00B7 Billed: $' + billedTotal.toFixed(2));
                }
            })
            .catch(function () {
                // Silent fail
            });
    }

    function insertAuditBadge(card, text, color, tooltip) {
        var badge = document.createElement('span');
        badge.className = 'audit-badge audit-badge--' + color;
        badge.textContent = text;
        if (tooltip) badge.title = tooltip;
        var headerArea = card.querySelector('.card-header') || card.querySelector('.company-name');
        if (headerArea) {
            headerArea.appendChild(badge);
        }
    }

    // ── Card Processing Pipeline ─────────────────────────────────────

    // ── Sales Rep Filter ──────────────────────────────────────────────
    var currentRepFilter = sessionStorage.getItem('ae_rep_filter') || 'All';

    function injectRepFilter() {
        var viewTab = document.getElementById('view-tab');
        if (!viewTab || document.getElementById('ae-rep-filter-bar')) return;

        var bar = document.createElement('div');
        bar.id = 'ae-rep-filter-bar';
        bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 16px;margin:0 0 12px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);flex-wrap:wrap;';

        var label = document.createElement('label');
        label.textContent = 'Filter by Rep:';
        label.style.cssText = 'font-size:13px;font-weight:600;color:#64748b;white-space:nowrap;';

        var select = document.createElement('select');
        select.id = 'ae-rep-filter-select';
        select.style.cssText = 'padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;color:#1e293b;';

        var options = ['All', 'Taneisha', 'Nika', 'Ruthie', 'Erik'];
        options.forEach(function (name) {
            var opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            if (name === currentRepFilter) opt.selected = true;
            select.appendChild(opt);
        });

        var countSpan = document.createElement('span');
        countSpan.id = 'ae-rep-filter-count';
        countSpan.style.cssText = 'font-size:12px;color:#94a3b8;margin-left:auto;';

        select.addEventListener('change', function () {
            currentRepFilter = this.value;
            sessionStorage.setItem('ae_rep_filter', currentRepFilter);
            applyRepFilter();
        });

        bar.appendChild(label);
        bar.appendChild(select);
        bar.appendChild(countSpan);
        viewTab.insertBefore(bar, viewTab.firstChild);
    }

    function applyRepFilter() {
        var viewTab = document.getElementById('view-tab');
        if (!viewTab) return;

        var cards = viewTab.querySelectorAll('.card');
        var shown = 0;
        var total = cards.length;

        cards.forEach(function (card) {
            if (currentRepFilter === 'All') {
                card.style.display = '';
                shown++;
                return;
            }
            var repEl = card.querySelector('.rep-name');
            var repText = repEl ? repEl.textContent.trim() : '';
            if (repText === currentRepFilter) {
                card.style.display = '';
                shown++;
            } else {
                card.style.display = 'none';
            }
        });

        var countSpan = document.getElementById('ae-rep-filter-count');
        if (countSpan) {
            countSpan.textContent = currentRepFilter === 'All'
                ? total + ' requests'
                : shown + ' of ' + total + ' requests';
        }
    }

    function processCards() {
        var viewTab = document.getElementById('view-tab');
        if (!viewTab) return;

        var cards = viewTab.querySelectorAll('.card');
        cards.forEach(function (card) {
            if (card.dataset.aeProcessed) return;
            card.dataset.aeProcessed = '1';

            addRequestTypeBadge(card);
            styleCardPills(card);
            calculateArtHours(card);
            formatRepName(card);
            cleanEmptyFields(card);
            injectAEFooter(card);
            addAuditIndicator(card);
        });

        // Inject filter bar if not present, then apply filter
        injectRepFilter();
        applyRepFilter();
    }

    // ── MutationObserver: Watch for Caspio gallery cards in view-tab ──

    var viewTab = document.getElementById('view-tab');
    if (viewTab) {
        var processTimer = null;
        var aeObserver = new MutationObserver(function () {
            clearTimeout(processTimer);
            processTimer = setTimeout(processCards, 300);
        });
        aeObserver.observe(viewTab, { childList: true, subtree: true });

        // Also process immediately in case cards are already rendered
        setTimeout(processCards, 500);
    }

})();
