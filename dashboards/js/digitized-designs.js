/* digitized-designs.js — page script (extracted from inline <script>, 2026.09.05.7) */

// ── moved from inline <script> in dashboards/digitized-designs.html (Rule 3, 2026.09.05.7) ──
(function() {
            var modal = document.getElementById('image-modal');
            var modalImg = modal.querySelector('img');
            var container = document.querySelector('.caspio-container');
            var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
                || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

            /* Image modal — click (or Enter on) a thumbnail to enlarge; focus returns on close */
            var imageReturnFocus = null;
            function openImageModal(src) {
                imageReturnFocus = document.activeElement;
                modalImg.src = src;
                modal.classList.add('active');
                setTimeout(function () { var c = document.getElementById('image-modal-close'); if (c) c.focus(); }, 30);
            }
            function closeImageModal() {
                if (!modal.classList.contains('active')) return;
                modal.classList.remove('active');
                modalImg.src = '';
                if (imageReturnFocus && document.body.contains(imageReturnFocus)) { try { imageReturnFocus.focus(); } catch (e) { /* gone */ } }
                imageReturnFocus = null;
            }
            container.addEventListener('click', function(e) {
                if (e.target.closest('.mockup-link')) return;
                var img = e.target.closest('img');
                if (img && !img.classList.contains('broken-image') && img.src) openImageModal(img.src);
            });
            container.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                var btn = e.target.closest && e.target.closest('.img-btn');
                if (!btn) return;
                var img = btn.querySelector('img');
                if (img && img.src) { e.preventDefault(); openImageModal(img.src); }
            });

            modal.addEventListener('click', function(e) {
                if (e.target !== modalImg) closeImageModal();
            });

            /* Broken thumbnails (Rule 3 — was an inline onerror=): `error` does not bubble → capture phase */
            document.addEventListener('error', function (e) {
                var img = e.target;
                if (img && img.tagName === 'IMG' && img.dataset && img.dataset.onerror === 'hide') img.hidden = true;
            }, true);

            document.addEventListener('keydown', function(e) {
                if (e.key !== 'Escape') return;
                if (modal.classList.contains('active')) closeImageModal();
                else if (alModal.classList.contains('active')) closeALModal();
            });

            /* === AL Pricing Modal ===
               Prices come from the proxy's /api/al-pricing (Caspio Embroidery_Costs, the same source the
               embroidery quote builder uses). The tables below are the FALLBACK only, and #al-source-note
               says so whenever they are what is shown (Erik's rule: never a silent typed price). */
            var alModal = document.getElementById('al-modal');
            var alReturnFocus = null;
            var AL_TIERS = ['1-7', '8-23', '24-47', '48-71', '72+'];
            var AL_FALLBACK = {
                garments: { basePrices: { '1-7': 10.00, '8-23': 9.00, '24-47': 8.00, '48-71': 7.50, '72+': 7.00 }, perThousandUpcharge: 1.25, baseStitches: 8000, ltmFee: 50, ltmThreshold: 7 },
                caps:     { basePrices: { '1-7': 6.50, '8-23': 5.50, '24-47': 4.75, '48-71': 4.50, '72+': 4.25 }, perThousandUpcharge: 1.00, baseStitches: 5000, ltmFee: 50, ltmThreshold: 7 },
                fullBack: { ltmFee: 100 }
            };
            var alPricing = null;      // live data once it lands
            var alPricingError = '';
            function loadALPricing() {
                return fetch(API_BASE + '/api/al-pricing')
                    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                    .then(function (d) {
                        if (!d || !d.garments || !d.garments.basePrices || !d.caps || !d.caps.basePrices) throw new Error('unexpected shape');
                        alPricing = d; alPricingError = '';
                    })
                    .catch(function (err) {
                        alPricingError = (err && err.message) || 'unreachable';
                        console.warn('[digitized-designs] AL pricing unavailable — showing reference tables:', alPricingError);
                    });
            }
            loadALPricing();
            function alData() { return alPricing || AL_FALLBACK; }
            function tiersFor(cat) {
                var d = alData()[cat];
                return AL_TIERS.map(function (t) {
                    return { qty: t + ' pcs', price: Number(d.basePrices[t]), ltm: t === '1-7' && Number(d.ltmFee) > 0, ltmFee: Number(d.ltmFee) || 0 };
                });
            }
            function money(n) { return '$' + Number(n).toFixed(2); }
            function kLabel(n) { return (Math.round(n / 100) / 10) + 'K'; }

            function closeALModal() {
                if (!alModal.classList.contains('active')) return;
                alModal.classList.remove('active');
                if (alReturnFocus && document.body.contains(alReturnFocus)) { try { alReturnFocus.focus(); } catch (e) { /* gone */ } }
                alReturnFocus = null;
            }

            function openALModal(stitchCount, designNum) {
                document.getElementById('al-design-label').textContent = '#' + designNum;
                alReturnFocus = document.activeElement;
                var d = alData();
                var note = document.getElementById('al-source-note');
                if (note) {
                    note.textContent = alPricing
                        ? 'Prices live from Caspio Embroidery_Costs.'
                        : '\u26a0 Showing reference prices — Caspio pricing unavailable (' + (alPricingError || 'still loading') + ').';
                    note.classList.toggle('al-source-note--warn', !alPricing);
                }

                var garmentBase = Number(d.garments.baseStitches) || 8000;
                var capBase = Number(d.caps.baseStitches) || 5000;
                var garmentRate = Number(d.garments.perThousandUpcharge) || 1.25;
                var capRate = Number(d.caps.perThousandUpcharge) || 1.00;
                var setText = function (id, t) { var el = document.getElementById(id); if (el) el.textContent = t; };
                setText('al-garment-base', 'Base ' + kLabel(garmentBase) + ' stitches');
                setText('al-cap-base', 'Base ' + kLabel(capBase) + ' stitches');
                setText('al-garment-footnote', 'Logos up to ' + garmentBase.toLocaleString() + ' stitches. Larger logos add ' + money(garmentRate) + '/1K.');
                setText('al-cap-footnote', 'Logos up to ' + capBase.toLocaleString() + ' stitches. Larger logos add ' + money(capRate) + '/1K.');

                var garmentOverK = Math.max(0, Math.ceil((stitchCount - garmentBase) / 1000));
                var capOverK = Math.max(0, Math.ceil((stitchCount - capBase) / 1000));
                var garmentOverage = garmentOverK * garmentRate;
                var capOverage = capOverK * capRate;

                /* Stitch info banner */
                var infoEl = document.getElementById('al-stitch-info');
                var sc = stitchCount.toLocaleString();
                var infoHtml = 'This design has <strong>' + sc + ' stitches</strong>. ';
                if (garmentOverage > 0) {
                    infoHtml += 'Garment AL: <span class="overage-amount">+' + money(garmentOverage) + '/piece overage</span> (' + garmentOverK + 'K over ' + kLabel(garmentBase) + ' base). ';
                } else {
                    infoHtml += 'Garment AL: <span class="within-base">within ' + kLabel(garmentBase) + ' base</span>. ';
                }
                if (capOverage > 0) {
                    infoHtml += 'Cap AL: <span class="overage-amount">+' + money(capOverage) + '/piece overage</span> (' + capOverK + 'K over ' + kLabel(capBase) + ' base).';
                } else {
                    infoHtml += 'Cap AL: <span class="within-base">within ' + kLabel(capBase) + ' base</span>.';
                }
                infoEl.innerHTML = infoHtml;

                /* Populate tables */
                populateALTable('al-garment-table', tiersFor('garments'), garmentOverage);
                populateALTable('al-cap-table', tiersFor('caps'), capOverage);

                /* Show/hide overage column */
                document.querySelectorAll('#al-garment-table .al-total-col').forEach(function(el) { el.hidden = !(garmentOverage > 0); });
                document.querySelectorAll('#al-cap-table .al-total-col').forEach(function(el) { el.hidden = !(capOverage > 0); });

                alModal.classList.add('active');
                setTimeout(function () { var c = alModal.querySelector('.al-modal-close'); if (c) c.focus(); }, 30);
            }

            function populateALTable(tableId, tiers, overage) {
                var tbody = document.getElementById(tableId).querySelector('tbody');
                var html = '';
                tiers.forEach(function(t) {
                    html += '<tr>';
                    html += '<td class="tier-label">' + t.qty;
                    if (t.ltm) html += ' <span class="ltm-tag">+' + money(t.ltmFee) + ' LTM</span>';
                    html += '</td>';
                    html += '<td class="tier-price">$' + t.price.toFixed(2) + ' each</td>';
                    if (overage > 0) {
                        html += '<td class="tier-total">$' + (t.price + overage).toFixed(2) + ' each</td>';
                    } else {
                        html += '<td class="tier-total no-overage al-total-col">&mdash;</td>';
                    }
                    html += '</tr>';
                });
                tbody.innerHTML = html;
            }

            /* AL modal event delegation */
            container.addEventListener('click', function(e) {
                var btn = e.target.closest('.al-pricing-btn');
                if (btn) {
                    e.stopPropagation();
                    var stitches = parseInt(btn.getAttribute('data-stitches'), 10) || 0;
                    var design = btn.getAttribute('data-design') || '';
                    openALModal(stitches, design);
                }
            });

            alModal.addEventListener('click', function(e) {
                if (e.target === alModal || e.target.closest('.al-modal-close')) closeALModal();
            });
            document.getElementById('image-modal-close').addEventListener('click', closeImageModal);
    /* Caspio embed watchdog — a DataPage that never renders used to leave a silent blank card.
       After 15 s with neither a search form nor a result row, say so and offer a reload. */
    setTimeout(function () {
        if (container.querySelector('form, [data-cb-name="data-row"], .cbResultSetError')) return;
        var note = document.createElement('div');
        note.className = 'caspio-fail';
        note.setAttribute('role', 'alert');
        note.textContent = 'The Caspio list did not load. Check your connection, then ';
        var retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'caspio-fail-retry';
        retry.textContent = 'Reload the page';
        retry.addEventListener('click', function () { window.location.reload(); });
        note.appendChild(retry);
        container.appendChild(note);
    }, 15000);


            /* Extract "Updated" date from Caspio header before CSS hides it */
            function extractUpdatedDate() {
                var headerEl = container.querySelector('header');
                if (!headerEl) return;
                var text = headerEl.textContent || '';
                var match = text.match(/Updated\s+(.+)/i);
                if (match) {
                    var subtitle = document.querySelector('.page-subtitle');
                    if (!subtitle) {
                        subtitle = document.createElement('span');
                        subtitle.className = 'page-subtitle';
                        var pageTitle = document.querySelector('.page-title');
                        if (pageTitle) pageTitle.after(subtitle);
                    }
                    subtitle.textContent = 'Last updated ' + match[1].trim();
                }
            }

            /* === Card Restructure === */
            var PRIMARY_FIELDS = ['Stitch Tier', 'Company', 'Stitch Count', 'Color Changes', 'Date Modified'];
            var DETAIL_FIELDS = ['Cust_ID', 'Width Inches', 'Height Inches', 'DST Filename', 'Has EMB', 'Over 4 Thread Color Charge'];
            var FB_PRICE_FIELDS = [
                { key: 'FB Price 1 7', label: '1-7' },
                { key: 'FB Price 8 23', label: '8-23' },
                { key: 'FB Price 24 47', label: '24-47' },
                { key: 'FB Price 48 71', label: '48-71' },
                { key: 'FB Price 72plus', label: '72+' }
            ];

            function escapeHtml(str) {
                var d = document.createElement('div');
                d.textContent = str;
                return d.innerHTML;
            }

            function formatStitchCount(val) {
                var n = parseInt(val, 10);
                return isNaN(n) ? val : n.toLocaleString();
            }

            function parseCurrency(str) {
                return parseFloat(str.replace(/[$,]/g, ''));
            }

            function extractFields(dl) {
                var fields = {};
                var dts = dl.querySelectorAll('dt');
                dts.forEach(function(dt) {
                    var label = dt.textContent.trim();
                    var dd = dt.nextElementSibling;
                    if (!dd) return;
                    fields[label] = {
                        text: dd.textContent.trim(),
                        html: dd.innerHTML,
                        el: dd
                    };
                });
                return fields;
            }

            function buildCard(fields, dl) {
                var designNum = fields['Design Number'] ? fields['Design Number'].text : '';
                var description = fields['Design Description'] ? fields['Design Description'].text : '';
                var company = fields['Company'] ? fields['Company'].text : '';
                // Some Caspio rows carry NO Design Number (the unfiltered search returns dozens); the DST
                // filename ("26664.dst") holds it — derive it and say where it came from.
                var designFromFile = false;
                if (!designNum && fields['DST Filename']) {
                    var dstm = /^(\d{3,7})\b/.exec(fields['DST Filename'].text.trim());
                    if (dstm) { designNum = dstm[1]; designFromFile = true; }
                }

                /* Collect ALL images from dl — DST preview + mockup
                   (Caspio puts each img in an orphan dd with no dt) */
                var imgSrcs = [];
                var mockupHref = '';
                var linkEl = dl.querySelector('a.cbResultSetDataLink');
                if (linkEl) mockupHref = linkEl.href;
                var allImgs = dl.querySelectorAll('img');
                for (var i = 0; i < allImgs.length; i++) {
                    var img = allImgs[i];
                    if (img.src && img.src !== window.location.href) {
                        imgSrcs.push(img.src);
                    }
                }
                if (!imgSrcs.length && mockupHref) imgSrcs.push(mockupHref);

                var html = '';

                /* Header */
                html += '<div class="card-header">';
                html += '<h3>#' + (designNum ? escapeHtml(designNum) : '<span class="no-design-num">no design number</span>');
                if (designFromFile) html += ' <span class="design-from-file" title="Design Number is blank in Caspio — read from the DST filename">(from DST file)</span>';
                if (company) html += ' <span>' + escapeHtml(company) + '</span>';
                html += '</h3>';
                if (description) html += '<p class="card-description">' + escapeHtml(description) + '</p>';
                html += '</div>';

                /* AS Surcharge badge — prominent */
                var stitchTier = fields['Stitch Tier'] ? fields['Stitch Tier'].text : '';
                var asField = fields['AS-Garm & AS-CAP'];
                var asVal = asField ? parseFloat(asField.text) : 0;
                if (stitchTier === 'Full Back') {
                    var fbLtm = (alPricing && alPricing.fullBack && Number(alPricing.fullBack.ltmFee)) || AL_FALLBACK.fullBack.ltmFee;
                    html += '<div class="as-surcharge-badge warn">Full Back LTM Fee: ' + money(fbLtm) + ' (orders of 1-23 pieces)</div>';
                } else if (asVal > 0) {
                    html += '<div class="as-surcharge-badge warn">Stitch Surcharge: $' + asVal.toFixed(2) + '</div>';
                } else {
                    html += '<div class="as-surcharge-badge none">No Stitch Surcharge</div>';
                }

                /* Images — side by side if two, centered if one */
                // Thumbnails are buttons (keyboard-openable preview); a failed image hides itself via data-onerror
                var imgBtn = function (src, alt) {
                    return '<button type="button" class="img-btn" aria-label="Enlarge ' + escapeHtml(alt) + '">'
                        + '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '" loading="lazy" data-onerror="hide"></button>';
                };
                html += '<div class="card-images' + (imgSrcs.length <= 1 ? ' single' : '') + '">';
                if (imgSrcs.length >= 2) {
                    html += '<div class="card-image-item"><span class="image-label">DST Preview</span>';
                    html += imgBtn(imgSrcs[0], 'DST ' + designNum);
                    html += '</div>';
                    html += '<div class="card-image-item"><span class="image-label">Mockup</span>';
                    html += imgBtn(imgSrcs[1], 'Mockup ' + designNum);
                    if (mockupHref) html += '<br><a href="' + escapeHtml(mockupHref) + '" target="_blank" rel="noopener" class="mockup-link">View Full</a>';
                    html += '</div>';
                } else if (imgSrcs.length === 1) {
                    html += '<div class="card-image-item">';
                    html += imgBtn(imgSrcs[0], 'Design ' + designNum);
                    if (mockupHref) html += '<br><a href="' + escapeHtml(mockupHref) + '" target="_blank" rel="noopener" class="mockup-link">View Full Mockup</a>';
                    html += '</div>';
                } else {
                    html += '<span class="no-image">No preview available</span>';
                }
                html += '</div>';

                /* Full Back pricing table — only if at least one tier has a price */
                var hasFB = FB_PRICE_FIELDS.some(function(t) {
                    var f = fields[t.key];
                    return f && parseCurrency(f.text) > 0;
                });
                if (hasFB) {
                    html += '<div class="fb-pricing"><span class="fb-pricing-title">Full Back Pricing</span>';
                    html += '<div class="fb-pricing-grid">';
                    FB_PRICE_FIELDS.forEach(function(t) {
                        var f = fields[t.key];
                        var val = f ? parseCurrency(f.text) : 0;
                        html += '<div class="fb-tier"><span class="fb-tier-qty">' + t.label + '</span>';
                        html += '<span class="fb-tier-price">' + (val > 0 ? '$' + val.toFixed(2) : '\u2014') + '</span></div>';
                    });
                    html += '</div></div>';
                }

                /* Primary metadata */
                html += '<div class="card-meta">';
                PRIMARY_FIELDS.forEach(function(label) {
                    var f = fields[label];
                    if (!f) return;
                    var val = f.text;
                    if (label === 'Stitch Count') val = formatStitchCount(val);
                    html += '<span class="meta-label">' + escapeHtml(label) + '</span>';
                    html += '<span class="meta-value">' + escapeHtml(val) + '</span>';
                });
                html += '</div>';

                /* Collapsible details */
                var hasDetails = DETAIL_FIELDS.some(function(l) { return fields[l]; });
                if (hasDetails) {
                    var detailsId = 'card-details-' + (designNum || Math.random().toString(36).slice(2, 8));
                    html += '<button class="card-details-toggle" type="button" aria-expanded="false" aria-controls="' + detailsId + '">Details</button>';
                    html += '<div class="card-details" id="' + detailsId + '">';
                    DETAIL_FIELDS.forEach(function(label) {
                        var f = fields[label];
                        if (!f) return;
                        var displayLabel = label;
                        if (label === 'Width Inches') displayLabel = 'Width';
                        if (label === 'Height Inches') displayLabel = 'Height';
                        if (label === 'DST Filename') displayLabel = 'DST File';
                        if (label === 'Over 4 Thread Color Charge') displayLabel = 'Color Surcharge';
                        var val = f.text;
                        if (label === 'Width Inches' || label === 'Height Inches') val += '"';
                        if (label === 'Over 4 Thread Color Charge') { var n = parseCurrency(val); val = isNaN(n) ? val : '$' + n.toFixed(2); }
                        html += '<span class="meta-label">' + escapeHtml(displayLabel) + '</span>';
                        html += '<span class="meta-value">' + escapeHtml(val) + '</span>';
                    });
                    html += '</div>';
                }

                /* AL Pricing button — hide for Full Back (has its own pricing grid) */
                if (stitchTier !== 'Full Back') {
                    var stitchRaw = fields['Stitch Count'] ? fields['Stitch Count'].text : '0';
                    var stitchNum = parseInt(stitchRaw.replace(/,/g, ''), 10) || 0;
                    html += '<button class="al-pricing-btn" type="button" data-stitches="' + stitchNum + '" data-design="' + escapeHtml(designNum) + '" aria-label="Additional logo pricing for #' + escapeHtml(designNum || '?') + '">AL Pricing</button>';
                }

                return html;
            }

            function restructureCards() {
                var rows = container.querySelectorAll('[data-cb-name="data-row"]:not(.restructured)');
                if (!rows.length) return;

                rows.forEach(function(row) {
                    var dl = row.querySelector('dl.cbResultSetPanelDataContainer');
                    if (!dl) return;

                    var fields = extractFields(dl);
                    if (!fields['Design Number']) return;

                    var cardHtml = buildCard(fields, dl);
                    var wrapper = document.createElement('div');
                    wrapper.className = 'card-content';
                    wrapper.innerHTML = cardHtml;
                    row.appendChild(wrapper);
                    row.classList.add('restructured');
                });

                /* Wire up details toggles */
                container.querySelectorAll('.card-details-toggle:not([data-wired])').forEach(function(btn) {
                    btn.setAttribute('data-wired', '1');
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var open = this.classList.toggle('open');
                        this.setAttribute('aria-expanded', open ? 'true' : 'false');
                        var details = this.nextElementSibling;
                        if (details) details.classList.toggle('open', open);
                    });
                });
            }

            /* Observe DOM for Caspio content loading */
            var debounceTimer;
            var observer = new MutationObserver(function() {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(function() {
                    extractUpdatedDate();
                    restructureCards();
                }, 100);
            });
            observer.observe(container, { childList: true, subtree: true });

            /* Immediate + safety fallbacks for content already rendered */
            extractUpdatedDate();
            restructureCards();
            setTimeout(function() { extractUpdatedDate(); restructureCards(); }, 500);
            setTimeout(function() { extractUpdatedDate(); restructureCards(); }, 2000);
        })();
