/* =====================================================
   CONTRACT DTG CALCULATOR — Editorial UI (2026-05-15)
   ----------------------------------------------------------
   Parallel to /calculators/embroidery-contract/embroidery-contract.js.

   Same pattern, DTG-shaped inputs:
     · Quantity input
     · Location checkbox grid (LC, FF, FB, JF, JB)
     · Heavyweight toggle
     · 4 tiers: 1-23, 24-47, 48-71, 72+
     · LTM $50 at qty <= 23 (rolled into per-piece)
     · Heavyweight +$1/pc when checked

   AI assistant calls /api/contract-dtg-ai/chat (parallel to the
   embroidery endpoint). Saved quotes use the CDTG-YYYY-NNN prefix.

   URL params (back-compat with the old hardcoded calculator):
     ?qty=24&locs=LC,FF&hw=1
   ===================================================== */

(function () {
    'use strict';

    var API_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    /* ---------------------- Constants ---------------------- */

    // Hardcoded — no /api/contract-dtg-pricing endpoint exists. If we ever add
    // one, swap to fetchContractDtgPricing() like the embroidery side.
    var TIER_ORDER  = ['1-23', '24-47', '48-71', '72+'];
    var TIER_LABELS = ['1–23', '24–47', '48–71', '72+'];
    var TIER_RATES  = {
        '1-23':  7.50,
        '24-47': 6.75,
        '48-71': 6.00,
        '72+':   5.25,
    };
    var LTM_FEE = 50;
    var LTM_THRESHOLD = 23;          // qty <= 23 triggers LTM
    var HEAVYWEIGHT_UPCHARGE = 1.00;

    var LOC_META = {
        LC: { code: 'LC', name: 'Left Chest', size: '4″ × 4″' },
        FF: { code: 'FF', name: 'Full Front', size: '12″ × 16″' },
        FB: { code: 'FB', name: 'Full Back',  size: '12″ × 16″' },
        JF: { code: 'JF', name: 'Jumbo Front', size: '14″ × 18″' },
        JB: { code: 'JB', name: 'Jumbo Back',  size: '14″ × 18″' },
    };
    var LOC_CODES_ORDER = ['LC', 'FF', 'FB', 'JF', 'JB'];

    /* ---------------------- State ---------------------- */

    var state = {
        qty: 24,
        locs: [],            // array of location codes, e.g. ['LC', 'FF']
        heavyweight: false,
    };

    /* ---------------------- Helpers ---------------------- */

    function fmtMoney(n) {
        if (n == null || isNaN(n)) return '0.00';
        return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtInt(n) { return Number(n || 0).toLocaleString('en-US'); }

    function tierIndexForQty(qty) {
        if (qty <= 23) return 0;
        if (qty <= 47) return 1;
        if (qty <= 71) return 2;
        return 3;
    }

    function calculateUnitPriceWithLTM(baseUnitPrice, quantity, ltmThreshold, ltmFee) {
        if (quantity > 0 && quantity <= ltmThreshold) {
            var ltmPerPiece = ltmFee / quantity;
            return {
                finalUnitPrice: baseUnitPrice + ltmPerPiece,
                baseUnitPrice: baseUnitPrice,
                ltmPerPiece: ltmPerPiece,
                ltmFee: ltmFee,
                hasLtm: true,
            };
        }
        return {
            finalUnitPrice: baseUnitPrice,
            baseUnitPrice: baseUnitPrice,
            ltmPerPiece: 0,
            ltmFee: 0,
            hasLtm: false,
        };
    }

    function computeBaseUnit() {
        var tierIdx = tierIndexForQty(state.qty);
        var tier = TIER_ORDER[tierIdx];
        var perLocRate = TIER_RATES[tier];
        var locCount = state.locs.length;
        var locSubtotal = perLocRate * locCount;
        var hwCharge = state.heavyweight ? HEAVYWEIGHT_UPCHARGE : 0;
        return {
            tierIdx: tierIdx,
            tier: tier,
            perLocRate: perLocRate,
            locCount: locCount,
            locSubtotal: locSubtotal,
            heavyweightCharge: hwCharge,
            baseUnit: locSubtotal + hwCharge,
        };
    }

    function locsLabel(locs) {
        if (!locs.length) return 'no location selected';
        return locs.map(function (c) { return LOC_META[c] ? LOC_META[c].name : c; }).join(' + ');
    }

    /* ---------------------- Calculator render ---------------------- */

    function renderCalculator() {
        var base = computeBaseUnit();
        var ltmCalc = calculateUnitPriceWithLTM(base.baseUnit, state.qty, LTM_THRESHOLD, LTM_FEE);
        var orderTotal = ltmCalc.finalUnitPrice * state.qty;

        // Header summary
        document.getElementById('resLocSummary').textContent = locsLabel(state.locs);
        document.getElementById('resTier').textContent = state.locs.length
            ? 'Tier ' + TIER_LABELS[base.tierIdx]
            : '—';

        if (!state.locs.length) {
            // Empty state — show placeholder
            document.getElementById('unitPrice').textContent = '—';
            document.getElementById('unitSub').innerHTML = 'Pick at least one location to see pricing';
            document.getElementById('orderTotal').textContent = '$—';
            document.getElementById('orderTotalNote').textContent = '—';
            renderPriceTable();
            return;
        }

        document.getElementById('unitPrice').textContent = fmtMoney(ltmCalc.finalUnitPrice);

        // Sub-line shows the breakdown: N loc × $X.XX [+$1 HW] [incl. LTM]
        var subBits = [base.locCount + (base.locCount === 1 ? ' loc × ' : ' locs × ') +
            '<b>$' + base.perLocRate.toFixed(2) + '</b>'];
        if (state.heavyweight) subBits.push('+ <b>$1.00</b> HW');
        if (ltmCalc.hasLtm) {
            subBits.push('incl. $' + fmtMoney(ltmCalc.ltmFee) + ' LTM ÷ ' + state.qty +
                ' = <b>+$' + fmtMoney(ltmCalc.ltmPerPiece) + '/pc</b>');
        }
        document.getElementById('unitSub').innerHTML = subBits.join(' · ');

        document.getElementById('orderTotal').textContent = '$' + fmtMoney(orderTotal);
        document.getElementById('orderTotalNote').textContent =
            fmtInt(state.qty) + ' × $' + fmtMoney(ltmCalc.finalUnitPrice);

        renderPriceTable();
    }

    /* ---------------------- Pricing table ---------------------- */

    function renderPriceTable() {
        var tbody = document.querySelector('#priceTable tbody');
        if (!tbody) return;

        var activeTierIdx = tierIndexForQty(state.qty);
        var activeLocCount = state.locs.length;
        var base = computeBaseUnit();
        var ltmCalcAtActive = calculateUnitPriceWithLTM(base.baseUnit, state.qty, LTM_THRESHOLD, LTM_FEE);

        // Update thead with active column
        var theadCells = document.querySelectorAll('#priceTable thead th');
        for (var i = 0; i < theadCells.length; i++) {
            theadCells[i].classList.toggle('qty-col', (i - 1) === activeTierIdx);
        }
        // Tfoot rate row mirrors column highlight
        var tfootCells = document.querySelectorAll('#priceTable tfoot td');
        for (var f = 0; f < tfootCells.length; f++) {
            tfootCells[f].classList.toggle('qty-col', (f - 1) === activeTierIdx);
        }

        // Body rows: 1 through 5 locations
        var html = '';
        for (var n = 1; n <= 5; n++) {
            var isHi = (n === activeLocCount);
            html += '<tr' + (isHi ? ' class="row-hi"' : '') + '>';
            html += '<td>' + n + ' location' + (n === 1 ? '' : 's') + '</td>';
            TIER_ORDER.forEach(function (tier, ci) {
                var perLoc = TIER_RATES[tier];
                var price = perLoc * n;
                if (state.heavyweight) price += HEAVYWEIGHT_UPCHARGE;
                // Intersection cell shows ALL-IN price (with LTM rolled in)
                var showIntersection = isHi && ci === activeTierIdx;
                if (showIntersection) {
                    price = ltmCalcAtActive.finalUnitPrice;
                }
                var classes = [];
                if (ci === activeTierIdx) classes.push('qty-col');
                if (showIntersection) classes.push('cell-hi');
                html += '<td' + (classes.length ? ' class="' + classes.join(' ') + '"' : '') +
                    '>$' + fmtMoney(price) + '</td>';
            });
            html += '</tr>';
        }
        tbody.innerHTML = html;
    }

    /* ---------------------- URL params ---------------------- */

    function readUrlParams() {
        var params = new URLSearchParams(window.location.search);
        var qty = params.get('qty') || params.get('q');
        var locs = params.get('locs');
        var hw = params.get('hw');

        if (qty && !isNaN(parseInt(qty, 10))) {
            state.qty = Math.max(1, parseInt(qty, 10));
        }
        if (locs) {
            var codes = locs.split(',').map(function (c) { return c.trim().toUpperCase(); });
            state.locs = codes.filter(function (c) { return LOC_META.hasOwnProperty(c); });
        }
        if (hw === '1' || hw === 'true') state.heavyweight = true;
    }

    function buildShareUrl() {
        var url = new URL(window.location.href);
        url.search = '';
        url.searchParams.set('qty', String(state.qty));
        if (state.locs.length) url.searchParams.set('locs', state.locs.join(','));
        if (state.heavyweight) url.searchParams.set('hw', '1');
        return url.toString();
    }

    function showToast(message) {
        var toast = document.getElementById('shareToast');
        if (!toast) return;
        if (message) document.getElementById('shareToastText').textContent = message;
        toast.classList.add('is-visible');
        setTimeout(function () { toast.classList.remove('is-visible'); }, 2400);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); resolve(); }
            catch (e) { reject(e); }
            finally { document.body.removeChild(ta); }
        });
    }

    function copyShareLink() {
        copyToClipboard(buildShareUrl())
            .then(function () { showToast('Quote link copied — paste into your email or chat'); })
            .catch(function () { showToast("Couldn't copy — please copy from the address bar"); });
    }

    /* ---------------------- Event wiring ---------------------- */

    function syncLocCardStates() {
        document.querySelectorAll('.loc[data-loc]').forEach(function (card) {
            var code = card.getAttribute('data-loc');
            card.classList.toggle('is-selected', state.locs.indexOf(code) !== -1);
        });
    }

    function bindEvents() {
        // Quantity input
        var qtyInput = document.getElementById('qty');
        qtyInput.addEventListener('input', function () {
            state.qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
            renderCalculator();
            if (aiState.opened) updateContextPill();
        });

        // Location checkboxes
        document.querySelectorAll('.loc input[type="checkbox"][data-loc]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var code = cb.getAttribute('data-loc');
                if (cb.checked) {
                    if (state.locs.indexOf(code) === -1) state.locs.push(code);
                } else {
                    state.locs = state.locs.filter(function (c) { return c !== code; });
                }
                // Keep state.locs in stable display order
                state.locs.sort(function (a, b) {
                    return LOC_CODES_ORDER.indexOf(a) - LOC_CODES_ORDER.indexOf(b);
                });
                syncLocCardStates();
                renderCalculator();
                if (aiState.opened) updateContextPill();
            });
        });

        // Heavyweight toggle
        var hw = document.getElementById('hwToggle');
        hw.addEventListener('change', function () {
            state.heavyweight = !!hw.checked;
            renderCalculator();
            if (aiState.opened) updateContextPill();
        });

        // Share link
        var shareBtn = document.getElementById('shareBtn');
        if (shareBtn) shareBtn.addEventListener('click', copyShareLink);

        // AI assistant
        var aiBtn = document.getElementById('aiDraftBtn');
        if (aiBtn) aiBtn.addEventListener('click', openAiChatPanel);

        bindAiChat();
    }

    /* =====================================================
       AI Quote Assistant — chat panel + SSE streaming
       Same pattern as embroidery-contract.js (Round 11+).
       ===================================================== */

    var AI_ENDPOINT = API_BASE_URL + '/api/contract-dtg-ai/chat';
    var QUOTE_PREFIX = 'CDTG';
    var aiState = {
        opened: false,
        messages: [],
        isStreaming: false,
        lastLookup: null,
        currentDraft: null,
        quoteID: null,
        quoteIDPromise: null,
    };

    function ensureQuoteID() {
        if (aiState.quoteID) return Promise.resolve(aiState.quoteID);
        if (aiState.quoteIDPromise) return aiState.quoteIDPromise;
        aiState.quoteIDPromise = (async function () {
            try {
                var r = await fetch(API_BASE_URL + '/api/quote-sequence/' + QUOTE_PREFIX);
                if (!r.ok) throw new Error('quote-sequence returned ' + r.status);
                var d = await r.json();
                aiState.quoteID = d.prefix + '-' + d.year + '-' + String(d.sequence).padStart(3, '0');
                return aiState.quoteID;
            } catch (err) {
                console.warn('[ai-chat] ensureQuoteID failed — proceeding without pre-assigned ID:', err);
                aiState.quoteIDPromise = null;
                return null;
            }
        })();
        return aiState.quoteIDPromise;
    }

    function stripCodeFences(text) {
        if (!text) return text;
        var out = String(text);
        out = out.replace(/^\s*```[a-zA-Z]*\s*\n/, '');
        out = out.replace(/\n\s*```\s*$/, '');
        out = out.replace(/^```[a-zA-Z]*\s*$/gm, '');
        out = out.replace(/^```\s*$/gm, '');
        return out.trim();
    }

    function parseEmailDraft(blockText) {
        blockText = stripCodeFences(blockText);
        var toMatch = blockText.match(/^To:\s*(.*)$/m);
        var subjMatch = blockText.match(/^Subject:\s*(.*)$/m);
        var body = blockText
            .replace(/^To:\s*.*$/m, '')
            .replace(/^Subject:\s*.*$/m, '')
            .replace(/^\n+/, '');
        return {
            to: (toMatch && toMatch[1] || '').trim(),
            subject: (subjMatch && subjMatch[1] || '').trim(),
            body: body.trim(),
        };
    }

    function extractGreetingName(body) {
        var m = body.match(/^Hi\s+([^,\n]+),/m);
        return m ? m[1].trim() : '';
    }

    function parseCustomerFinal(fullText) {
        var startMarker = 'CUSTOMER_FINAL START';
        var endMarker = 'CUSTOMER_FINAL END';
        var startIdx = fullText.indexOf(startMarker);
        var endIdx = fullText.indexOf(endMarker);
        if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null;
        var jsonText = fullText.slice(startIdx + startMarker.length, endIdx).trim();
        jsonText = stripCodeFences(jsonText);
        try {
            var parsed = JSON.parse(jsonText);
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed;
        } catch (err) {
            console.warn('[ai-chat] CUSTOMER_FINAL JSON parse failed:', err.message);
            return null;
        }
    }

    function buildMailto(draft) {
        var BODY_CAP = 1800;
        var body = draft.body || '';
        if (body.length > BODY_CAP) {
            body = body.slice(0, BODY_CAP);
            console.warn('[ai-chat] mailto body capped at ' + BODY_CAP + ' chars.');
        }
        var params = [];
        if (draft.subject) params.push('subject=' + encodeURIComponent(draft.subject));
        if (body) params.push('body=' + encodeURIComponent(body));
        var qs = params.length ? '?' + params.join('&') : '';
        var to = (draft.to || '').trim();
        return 'mailto:' + encodeURIComponent(to) + qs;
    }

    async function saveContractDtgQuote(opts) {
        var calcContext = opts.calcContext;
        var customer = opts.customer || {};
        var cfBundle = opts.cfBundle || null;
        if (!calcContext) throw new Error('calcContext required');

        var proxyBase = API_BASE_URL;

        var quoteID = opts.quoteID;
        if (!quoteID) {
            var seqRes = await fetch(proxyBase + '/api/quote-sequence/' + QUOTE_PREFIX);
            if (!seqRes.ok) throw new Error('quote-sequence returned ' + seqRes.status);
            var seqData = await seqRes.json();
            quoteID = seqData.prefix + '-' + seqData.year + '-' + String(seqData.sequence).padStart(3, '0');
        }

        var nowISO = new Date().toISOString().replace(/\.\d{3}Z$/, '');
        var expiresISO = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, '');

        var locationNames = calcContext.locs.map(function (c) {
            return LOC_META[c] ? LOC_META[c].name : c;
        });
        var locationLabel = locationNames.join(', ');

        // Shipping + tax bundle (from pre-flight checklist)
        var shippingAddr = '';
        var shippingCity = '';
        var shippingState = '';
        var shippingZip = '';
        var shipMethod = '';
        var taxable = true;
        if (cfBundle) {
            taxable = cfBundle.taxable !== false;
            var s = cfBundle.shipping || {};
            if (s.pickup) {
                shipMethod = 'Customer Pickup';
            } else if (s.same_as_billing) {
                shipMethod = s.method || 'UPS Ground';
            } else if (s.address || s.city) {
                shippingAddr = s.address || '';
                shippingCity = s.city || '';
                shippingState = s.state || '';
                shippingZip = s.zip || '';
                shipMethod = s.method || 'UPS Ground';
            }
        }

        var notesLines = ['Contract DTG quote · ' + locationLabel +
            (calcContext.heavyweight ? ' · Heavyweight (+$1/pc)' : '')];
        if (cfBundle && !taxable) {
            notesLines.push('Tax-exempt · WA Reseller Permit on file (verify)');
        }

        var session = {
            QuoteID: quoteID,
            SessionID: 'cdtg_ai_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11),
            CustomerEmail: customer.email || '',
            CustomerName: customer.name || 'AI Draft',
            CompanyName: customer.company || '',
            CustomerNumber: customer.customer_number || '',
            Phone: customer.phone || '',
            ShipToAddress: customer.address || '',
            ShipToCity: customer.city || '',
            ShipToState: customer.state || '',
            ShipToZip: customer.zip || '',
            ShippingAddress: shippingAddr,
            ShippingCity: shippingCity,
            ShippingState: shippingState,
            ShippingZip: shippingZip,
            ShipMethod: shipMethod,
            SalesRepEmail: customer.email_salesrep || 'ruth@nwcustomapparel.com',
            SalesRepName: customer.account_owner || 'Ruth Nhoung',
            PaymentTerms: customer.payment_terms || '',
            TaxRate: taxable ? 0.101 : 0,
            TotalQuantity: calcContext.qty,
            SubtotalAmount: parseFloat(calcContext.orderTotal.toFixed(2)),
            LTMFeeTotal: parseFloat((calcContext.ltmFee || 0).toFixed(2)),
            TotalAmount: parseFloat(calcContext.orderTotal.toFixed(2)),
            Status: 'Open',
            CreatedAt_Quote: nowISO,
            ExpiresAt: expiresISO,
            Notes: notesLines.join('\n'),
            PrintLocation: locationLabel,
        };
        var sessRes = await fetch(proxyBase + '/api/quote_sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(session),
        });
        if (!sessRes.ok) {
            var t = await sessRes.text();
            throw new Error('quote_sessions POST returned ' + sessRes.status + ': ' + t.slice(0, 120));
        }

        var productName = 'Contract DTG printing · ' + locationLabel +
            (calcContext.heavyweight ? ' (Heavyweight)' : '');
        var item = {
            QuoteID: quoteID,
            LineNumber: 1,
            StyleNumber: 'DTG-CONTRACT',
            ProductName: productName,
            Color: calcContext.heavyweight ? 'Heavyweight' : 'Standard Weight',
            Quantity: calcContext.qty,
            FinalUnitPrice: parseFloat(calcContext.finalUnit.toFixed(2)),
            LineTotal: parseFloat(calcContext.orderTotal.toFixed(2)),
            SizeBreakdown: '',
            EmbellishmentType: 'customer-supplied',
            PrintLocation: locationLabel,
            PrintLocationName: locationLabel,
            AddedAt: nowISO,
        };
        var itemRes = await fetch(proxyBase + '/api/quote_items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
        });
        if (!itemRes.ok) {
            var t2 = await itemRes.text();
            console.warn('[ai-chat] quote_items POST failed: ' + itemRes.status + ' ' + t2.slice(0, 120));
            throw new Error('quote_items POST returned ' + itemRes.status);
        }
        return quoteID;
    }

    function handleCommitDraft(action, btn, draft) {
        if (!draft) draft = aiState.currentDraft;
        if (!draft) return;

        if (action === 'copy') {
            copyToClipboard(draft.body).then(function () {
                if (btn) {
                    btn.classList.add('copied');
                    var span = btn.querySelector('span');
                    if (span) {
                        var orig = span.textContent;
                        span.textContent = 'Copied!';
                        setTimeout(function () {
                            btn.classList.remove('copied');
                            span.textContent = orig;
                        }, 2200);
                    }
                }
            });
        } else if (action === 'outlook') {
            copyToClipboard(draft.body).catch(function () { /* non-fatal */ });

            if (aiState.quoteID) {
                try {
                    var viewUrl = window.location.origin
                        + '/quote/' + encodeURIComponent(aiState.quoteID)
                        + '?autoPdf=1';
                    var w = window.open(viewUrl, '_blank');
                    if (!w) {
                        showToast('Popup blocked — open the quote view manually to download the PDF.');
                    } else {
                        showToast('PDF downloading in a new tab — drag it into Outlook to attach.');
                    }
                } catch (err) {
                    console.warn('[ai-chat] auto-PDF tab open failed:', err);
                }
            }

            var url = buildMailto(draft);
            window.location.href = url;
            if (btn) {
                btn.classList.add('opened');
                var span2 = btn.querySelector('span');
                if (span2) {
                    var orig2 = span2.textContent;
                    span2.textContent = 'Opening Outlook…';
                    setTimeout(function () {
                        btn.classList.remove('opened');
                        span2.textContent = orig2;
                    }, 2200);
                }
            }
        }

        // Fire-and-forget quote save
        var calcCtx = buildCalcContext();
        if (!calcCtx) {
            console.warn('[ai-chat] no calcContext at save time — skipping quote save');
            return;
        }
        var customer;
        var cfBundle = null;
        if (draft.confirmedCustomer && typeof draft.confirmedCustomer === 'object') {
            var cf = draft.confirmedCustomer;
            var billing = cf.billing || {};
            var shipping = cf.shipping || {};
            customer = {
                email: cf.email || draft.to || '',
                name: cf.name || extractGreetingName(draft.body) || '',
                company: cf.company || '',
                customer_number: cf.customer_number || '',
                phone: cf.phone || '',
                address: billing.address || '',
                city: billing.city || '',
                state: billing.state || '',
                zip: billing.zip || '',
                account_owner: cf.account_owner || '',
                email_salesrep: cf.email_salesrep || '',
                payment_terms: cf.payment_terms || '',
            };
            cfBundle = {
                shipping: shipping,
                taxable: cf.taxable !== false,
            };
        } else {
            var lookup = draft.lookupSnapshot || aiState.lastLookup;
            var draftEmail = (draft.to || '').toLowerCase();
            var lookupEmail = (lookup && lookup.email || '').toLowerCase();
            var lookupTrusted = !!lookup && draftEmail && draftEmail === lookupEmail;
            var greetingFirst = (extractGreetingName(draft.body) || '').toLowerCase();
            var lookupName = (lookup && lookup.contact_name || '');
            var lookupFirst = (lookup && lookup.contact_first || lookupName.split(/\s+/)[0] || '').toLowerCase();
            var nameTrusted = !!lookupName && (
                lookupTrusted ||
                (greetingFirst && lookupFirst && lookupFirst === greetingFirst)
            );
            customer = {
                email: draft.to || (lookupTrusted ? lookup.email : '') || '',
                name: (nameTrusted ? lookupName : '') || extractGreetingName(draft.body) || '',
                company: (lookupTrusted ? lookup.company : '') || '',
                customer_number: (lookupTrusted ? lookup.customer_number : '') || '',
                phone: (lookupTrusted ? lookup.phone : '') || '',
                address: (lookupTrusted ? lookup.address : '') || '',
                city: (lookupTrusted ? lookup.city : '') || '',
                state: (lookupTrusted ? lookup.state : '') || '',
                zip: (lookupTrusted ? lookup.zip : '') || '',
                account_owner: (lookupTrusted ? lookup.account_owner : '') || '',
                email_salesrep: (lookupTrusted ? lookup.email_salesrep : '') || '',
                payment_terms: (lookupTrusted ? lookup.payment_terms : '') || '',
            };
        }
        saveContractDtgQuote({
            calcContext: calcCtx,
            customer: customer,
            quoteID: aiState.quoteID || null,
            cfBundle: cfBundle,
        })
            .then(function (quoteID) { showToast('Saved as ' + quoteID); })
            .catch(function (err) {
                console.warn('[ai-chat] quote save failed:', err);
                showToast("Email ready. (Couldn't save quote — see console.)");
            });
    }

    function buildCalcContext() {
        if (!state.locs.length) return null;
        var base = computeBaseUnit();
        var ltmCalc = calculateUnitPriceWithLTM(base.baseUnit, state.qty, LTM_THRESHOLD, LTM_FEE);
        return {
            qty: state.qty,
            locs: state.locs.slice(),
            locationNames: state.locs.map(function (c) { return LOC_META[c] ? LOC_META[c].name : c; }),
            heavyweight: state.heavyweight,
            tier: base.tier,
            perLocRate: Number(base.perLocRate.toFixed(2)),
            heavyweightCharge: Number(base.heavyweightCharge.toFixed(2)),
            baseUnit: Number(base.baseUnit.toFixed(2)),
            finalUnit: Number(ltmCalc.finalUnitPrice.toFixed(2)),
            ltmFee: ltmCalc.hasLtm ? LTM_FEE : 0,
            ltmPerPiece: Number(ltmCalc.ltmPerPiece.toFixed(2)),
            orderTotal: Number((ltmCalc.finalUnitPrice * state.qty).toFixed(2)),
            quoteID: aiState.quoteID || null,
        };
    }

    function updateContextPill() {
        var pill = document.getElementById('aiChatContextPill');
        if (!pill) return;
        var ctx = buildCalcContext();
        if (!ctx) {
            pill.innerHTML = '<i>Pick at least one location, then I can draft the quote.</i>';
            return;
        }
        var locStr = ctx.locationNames.join(' + ');
        pill.innerHTML =
            '<b>' + fmtInt(ctx.qty) + ' pc' + (ctx.qty === 1 ? '' : 's') + '</b>' +
            ' · ' + locStr +
            (ctx.heavyweight ? ' · HW' : '') +
            ' · <b>$' + fmtMoney(ctx.finalUnit) + '/pc</b>' +
            ' · Total <b>$' + fmtMoney(ctx.orderTotal) + '</b>' +
            (ctx.ltmFee > 0 ? ' · incl. $' + ctx.ltmFee + ' LTM' : '');
    }

    function appendChatBubble(role, text, opts) {
        opts = opts || {};
        var container = document.getElementById('aiChatMessages');
        var msg = document.createElement('div');
        msg.className = 'chat-message ' + role + (opts.error ? ' error' : '');
        var bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.textContent = text;
        msg.appendChild(bubble);
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
        return bubble;
    }

    function appendTypingIndicator() {
        var container = document.getElementById('aiChatMessages');
        var msg = document.createElement('div');
        msg.className = 'chat-message assistant typing-wrap';
        var typing = document.createElement('div');
        typing.className = 'chat-typing';
        typing.innerHTML = '<span></span><span></span><span></span>';
        msg.appendChild(typing);
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
        return msg;
    }

    function removeTypingIndicator(typingEl) {
        if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    }

    function escapeHtml(s) {
        return String(s).replace(/[<>&]/g, function (m) {
            return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[m];
        });
    }

    function renderAssistantReply(bubbleEl, fullText) {
        var startMarker = 'EMAIL DRAFT START';
        var endMarker = 'EMAIL DRAFT END';
        var startIdx = fullText.indexOf(startMarker);
        var endIdx = fullText.indexOf(endMarker);
        if (startIdx === -1) {
            bubbleEl.textContent = fullText;
            return;
        }
        var customerFinal = parseCustomerFinal(fullText);
        var preambleEnd = startIdx;
        var customerFinalStartIdx = fullText.indexOf('CUSTOMER_FINAL START');
        if (customerFinalStartIdx !== -1 && customerFinalStartIdx < preambleEnd) {
            preambleEnd = customerFinalStartIdx;
        }
        var preamble = fullText.slice(0, preambleEnd).trim();
        var emailEnd = endIdx === -1 ? fullText.length : endIdx;
        var blockText = fullText.slice(startIdx + startMarker.length, emailEnd).trim();

        var parsed = parseEmailDraft(blockText);
        var cardDraft = {
            to: parsed.to,
            subject: parsed.subject,
            body: parsed.body,
            lookupSnapshot: aiState.lastLookup ? Object.assign({}, aiState.lastLookup) : null,
            confirmedCustomer: customerFinal,
        };
        aiState.currentDraft = cardDraft;

        bubbleEl.textContent = preamble || '(Email drafted — see below.)';

        var msgEl = bubbleEl.closest('.chat-message');
        var card = document.createElement('div');
        card.className = 'email-draft-card';
        var label = document.createElement('div');
        label.className = 'draft-label';
        label.textContent = 'Email draft';
        var body = document.createElement('div');
        body.className = 'draft-body';
        body.textContent = parsed.body;

        if (parsed.to || parsed.subject) {
            var meta = document.createElement('div');
            meta.className = 'draft-meta';
            if (parsed.to) {
                var toRow = document.createElement('div');
                toRow.className = 'draft-meta-row';
                toRow.innerHTML = '<span class="draft-meta-label">To</span><span class="draft-meta-val">' +
                    escapeHtml(parsed.to) + '</span>';
                meta.appendChild(toRow);
            }
            if (parsed.subject) {
                var subjRow = document.createElement('div');
                subjRow.className = 'draft-meta-row';
                subjRow.innerHTML = '<span class="draft-meta-label">Subject</span><span class="draft-meta-val">' +
                    escapeHtml(parsed.subject) + '</span>';
                meta.appendChild(subjRow);
            }
            card.appendChild(label);
            card.appendChild(meta);
        } else {
            card.appendChild(label);
        }
        card.appendChild(body);

        var actions = document.createElement('div');
        actions.className = 'email-draft-actions';

        var outlookBtn = document.createElement('button');
        outlookBtn.type = 'button';
        outlookBtn.className = 'btn-outlook';
        outlookBtn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>' +
            '<polyline points="22,6 12,13 2,6"/>' +
            '</svg><span>Open in Outlook</span>';
        outlookBtn.addEventListener('click', function () {
            handleCommitDraft('outlook', outlookBtn, cardDraft);
        });
        actions.appendChild(outlookBtn);

        var copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn-copy-email';
        copyBtn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="9" y="9" width="11" height="11" rx="2"/>' +
            '<path d="M5 15V5a2 2 0 0 1 2-2h10"/>' +
            '</svg><span>Copy email</span>';
        copyBtn.addEventListener('click', function () {
            handleCommitDraft('copy', copyBtn, cardDraft);
        });
        actions.appendChild(copyBtn);

        card.appendChild(actions);
        msgEl.appendChild(card);
        document.getElementById('aiChatMessages').scrollTop = document.getElementById('aiChatMessages').scrollHeight;
    }

    async function sendChatMessage() {
        if (aiState.isStreaming) return;
        aiState.isStreaming = true;
        var sendBtn = document.getElementById('aiChatSend');
        if (sendBtn) sendBtn.disabled = true;

        var typingEl = appendTypingIndicator();

        try {
            await ensureQuoteID();

            var response = await fetch(AI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: aiState.messages,
                    calcContext: buildCalcContext(),
                }),
            });

            if (!response.ok) {
                throw new Error('AI server returned ' + response.status);
            }

            removeTypingIndicator(typingEl);
            var bubble = appendChatBubble('assistant', '');

            var reader = response.body.getReader();
            var decoder = new TextDecoder();
            var accumulated = '';
            var sseBuffer = '';

            while (true) {
                var chunk = await reader.read();
                if (chunk.done) break;
                sseBuffer += decoder.decode(chunk.value, { stream: true });

                var events = sseBuffer.split('\n\n');
                sseBuffer = events.pop();

                for (var i = 0; i < events.length; i++) {
                    var lines = events[i].split('\n');
                    var eventType = null, dataJson = null;
                    for (var j = 0; j < lines.length; j++) {
                        if (lines[j].startsWith('event: ')) eventType = lines[j].slice(7).trim();
                        if (lines[j].startsWith('data: ')) dataJson = lines[j].slice(6).trim();
                    }
                    if (!eventType || !dataJson) continue;
                    var data;
                    try { data = JSON.parse(dataJson); } catch (e) { continue; }
                    if (eventType === 'delta' && data.text) {
                        accumulated += data.text;
                        bubble.textContent = accumulated;
                        document.getElementById('aiChatMessages').scrollTop = document.getElementById('aiChatMessages').scrollHeight;
                    } else if (eventType === 'tool_result' && data.tool === 'lookup_customer') {
                        var matches = (data.result && data.result.matches) || [];
                        if (matches.length === 1) {
                            aiState.lastLookup = matches[0];
                        } else if (matches.length > 1 && !aiState.lastLookup) {
                            aiState.lastLookup = matches[0];
                        }
                    } else if (eventType === 'error') {
                        throw new Error(data.message || 'AI stream error');
                    }
                }
            }

            aiState.messages.push({ role: 'assistant', content: accumulated });
            renderAssistantReply(bubble, accumulated);
        } catch (err) {
            console.error('[ai-chat] error:', err);
            removeTypingIndicator(typingEl);
            appendChatBubble(
                'assistant',
                "Hmm, I couldn't reach the AI right now. Please try again in a moment, or copy the quote details from the calculator manually.",
                { error: true }
            );
        } finally {
            aiState.isStreaming = false;
            if (sendBtn) sendBtn.disabled = false;
            var ta = document.getElementById('aiChatTextarea');
            if (ta) ta.focus();
        }
    }

    function openAiChatPanel() {
        var panel = document.getElementById('aiChatPanel');
        if (!panel) return;

        // Guard: need at least one location selected before AI can draft
        if (!state.locs.length) {
            showToast('Pick at least one print location first');
            return;
        }

        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        aiState.opened = true;
        updateContextPill();

        if (aiState.messages.length === 0) {
            aiState.messages.push({
                role: 'user',
                content: '(Open the chat — greet Ruth and ask for the customer details.)',
            });
            sendChatMessage();
        }

        setTimeout(function () {
            var ta = document.getElementById('aiChatTextarea');
            if (ta) ta.focus();
        }, 360);
    }

    function closeAiChatPanel() {
        var panel = document.getElementById('aiChatPanel');
        if (!panel) return;
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        aiState.opened = false;
    }

    function bindAiChat() {
        var closeBtn = document.getElementById('aiChatClose');
        if (closeBtn) closeBtn.addEventListener('click', closeAiChatPanel);

        var form = document.getElementById('aiChatForm');
        var ta = document.getElementById('aiChatTextarea');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var text = (ta.value || '').trim();
                if (!text || aiState.isStreaming) return;
                aiState.messages.push({ role: 'user', content: text });
                appendChatBubble('user', text);
                ta.value = '';
                ta.style.height = 'auto';
                updateContextPill();
                sendChatMessage();
            });
        }
        if (ta) {
            ta.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (form) form.dispatchEvent(new Event('submit'));
                }
            });
            ta.addEventListener('input', function () {
                ta.style.height = 'auto';
                ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && aiState.opened) closeAiChatPanel();
        });
    }

    /* ---------------------- Init ---------------------- */

    function init() {
        readUrlParams();

        // Reflect state into DOM
        document.getElementById('qty').value = state.qty;
        document.getElementById('hwToggle').checked = state.heavyweight;
        state.locs.forEach(function (code) {
            var cb = document.querySelector('.loc input[data-loc="' + code + '"]');
            if (cb) cb.checked = true;
        });
        syncLocCardStates();

        renderCalculator();
        bindEvents();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
