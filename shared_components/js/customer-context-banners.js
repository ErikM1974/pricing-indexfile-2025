/**
 * Customer Context Banners — shared helper for EMB/DTF/SCP quote builders.
 *
 * When a customer is picked via CustomerLookupService.onSelect, call
 * window.surfaceCustomerContext(contact, { ... }) and this helper will:
 *
 *   1. Render an amber "CUSTOMER WARNING" banner if Customer_Warning is set
 *   2. Render a green "TAX EXEMPT" chip if Is_Tax_Exempt is true
 *   3. Render an indigo Account Tier badge if Account_Tier is set
 *   4. Auto-select the Payment Terms dropdown, mapping legacy CRM terms
 *      (Net 30, Credit Card on File, COD, etc.) to one of the terms the
 *      builder offers. Adds a "⚠ from 'X'" hint when mapping happened.
 *   5. If a phone input is configured, prefer Phone_Best over Phone/Company_Phone.
 *   6. Auto-fill basic contact fields (first/last/email) if their inputs
 *      are configured.
 *
 * Builder responsibilities:
 *  - Add empty container divs to the HTML at the right spot:
 *      <div id="customer-warning-banner"></div>
 *      <div id="customer-tax-chip"></div>
 *      <div id="customer-tier-badge"></div>
 *      <div id="customer-terms-note"></div>   (small ⚠ hint next to terms label)
 *  - Wire CustomerLookupService.onSelect = contact => surfaceCustomerContext(contact, { ... })
 *
 * Backed by the proxy's /api/company-contacts/search response which now
 * includes Customer_Warning / Is_Tax_Exempt / Tax_Exempt_Number / Phone_Best /
 * Account_Tier / Payment_Terms / CustTerms / Preferred_Terms_FromOrders
 * (added 2026-05-23).
 */

(function () {
    'use strict';

    function escapeHtml(str) {
        if (str == null) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    /**
     * Map a customer's CRM payment term to one of the terms the BUILDER offers.
     * Returns { term, mappedFrom } where mappedFrom is non-null only when
     * conversion happened (so the UI can show a "⚠ mapped" note).
     *
     * @param {string} crmTerm        - Raw CRM value (e.g., "Net 30")
     * @param {string[]} offeredTerms - Terms the builder actually offers (e.g., ["Prepaid", "Net 10", "Pay On Pickup"])
     * @param {string} [fallback]     - Default when no match (defaults to first offered term, usually Prepaid)
     */
    function mapToOfferedTerms(crmTerm, offeredTerms, fallback) {
        const offered = (offeredTerms || []).map(t => String(t || '').trim()).filter(Boolean);
        const defaultTerm = fallback || offered[0] || 'Prepaid';
        if (!crmTerm) return { term: defaultTerm, mappedFrom: null };

        const original = String(crmTerm).trim();
        const t = original.toLowerCase().replace(/\s+/g, ' ');

        // Exact (case-insensitive) match against builder's offered terms
        for (const off of offered) {
            if (off.toLowerCase() === t) {
                return { term: off, mappedFrom: null };
            }
        }

        // Soft-match common synonyms to canonical NWCA terms
        const synonyms = {
            'prepaid':          'Prepaid',
            'pre-paid':         'Prepaid',
            'pre paid':         'Prepaid',
            'pp':               'Prepaid',
            'pay on pickup':    'Pay On Pickup',
            'pay-on-pickup':    'Pay On Pickup',
            'on pickup':        'Pay On Pickup',
            'pop':              'Pay On Pickup',
            'net 10':           'Net 10',
            'net10':            'Net 10',
            'n10':              'Net 10',
            'net-10':           'Net 10',
        };
        const synonym = synonyms[t];
        if (synonym && offered.some(o => o.toLowerCase() === synonym.toLowerCase())) {
            return { term: synonym, mappedFrom: null };
        }

        // Legacy/unsupported terms NWCA no longer offers → fallback to Prepaid
        // (most conservative — don't accidentally extend credit). Rep can
        // manually switch via the dropdown if they want to honor a legacy
        // agreement. Surface the original so the rep knows what was on file.
        return { term: defaultTerm, mappedFrom: original };
    }

    /**
     * Surface the CRM-curated context of a picked customer.
     *
     * @param {Object} contact - Result from CustomerLookupService.onSelect
     * @param {Object} [config]
     * @param {string} [config.warningContainerId='customer-warning-banner']
     * @param {string} [config.taxChipContainerId='customer-tax-chip']
     * @param {string} [config.tierBadgeContainerId='customer-tier-badge']
     * @param {string} [config.termsSelectId]    - <select> for payment terms (auto-select)
     * @param {string} [config.termsNoteId]      - <span> next to label for the ⚠ mapping note
     * @param {string[]} [config.offeredTerms]   - Terms the builder offers (REQUIRED for terms autofill)
     * @param {string} [config.phoneInputId]     - <input> for phone (prefers Phone_Best)
     * @param {string} [config.firstNameInputId] - <input> for first name (optional auto-fill)
     * @param {string} [config.lastNameInputId]  - <input> for last name
     * @param {string} [config.emailInputId]     - <input> for email
     * @param {string} [config.companyInputId]   - <input> for company name
     */
    function surfaceCustomerContext(contact, config) {
        if (!contact) return;
        config = config || {};

        // 1. Customer Warning banner — amber
        const warningEl = document.getElementById(config.warningContainerId || 'customer-warning-banner');
        if (warningEl) {
            const cw = String(contact.Customer_Warning || '').trim();
            if (cw) {
                warningEl.style.cssText =
                    'display:flex;align-items:flex-start;gap:10px;background:#fef3c7;border:1px solid #fde68a;' +
                    'border-left:4px solid #d97706;border-radius:4px;padding:10px 14px;margin:8px 0;' +
                    'color:#78350f;font-size:13px;line-height:1.45;';
                warningEl.innerHTML =
                    '<span style="font-size:18px;line-height:1;color:#d97706;">⚠️</span>' +
                    '<div>' +
                    '<div style="font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.04em;font-size:11px;">Customer Warning</div>' +
                    '<div>' + escapeHtml(cw) + '</div>' +
                    '</div>';
                warningEl.hidden = false;
            } else {
                warningEl.hidden = true;
                warningEl.innerHTML = '';
                warningEl.style.cssText = '';
            }
        }

        // 2. Tax Exempt chip — green
        const taxEl = document.getElementById(config.taxChipContainerId || 'customer-tax-chip');
        if (taxEl) {
            if (contact.Is_Tax_Exempt === true || contact.Is_Tax_Exempt === 1 || contact.Is_Tax_Exempt === '1') {
                const cert = String(contact.Tax_Exempt_Number || '').trim();
                taxEl.style.cssText =
                    'display:inline-flex;align-items:center;gap:6px;background:#dcfce7;border:1px solid #bbf7d0;' +
                    'color:#166534;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;margin:4px 6px 4px 0;';
                taxEl.innerHTML = '<span>🏛️</span><span>TAX EXEMPT' + (cert ? ' · Cert # ' + escapeHtml(cert) : '') + '</span>';
                taxEl.hidden = false;
            } else {
                taxEl.hidden = true;
                taxEl.innerHTML = '';
                taxEl.style.cssText = '';
            }
        }

        // 3. Account Tier badge — indigo (info-only)
        const tierEl = document.getElementById(config.tierBadgeContainerId || 'customer-tier-badge');
        if (tierEl) {
            const at = String(contact.Account_Tier || '').trim();
            if (at) {
                tierEl.style.cssText =
                    'display:inline-flex;align-items:center;gap:6px;background:#e0e7ff;border:1px solid #c7d2fe;' +
                    'color:#3730a3;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;margin:4px 0;';
                tierEl.innerHTML = '<span>⭐</span><span>' + escapeHtml(at) + '</span>';
                tierEl.hidden = false;
            } else {
                tierEl.hidden = true;
                tierEl.innerHTML = '';
                tierEl.style.cssText = '';
            }
        }

        // 4. Auto-select Payment Terms with mapping
        if (config.termsSelectId) {
            const termsSelect = document.getElementById(config.termsSelectId);
            const noteEl = config.termsNoteId ? document.getElementById(config.termsNoteId) : null;
            if (termsSelect) {
                const offered = config.offeredTerms || Array.from(termsSelect.options).map(o => o.value);
                const raw = contact.Preferred_Terms_FromOrders
                    || contact.Payment_Terms
                    || contact.CustTerms
                    || '';
                const result = mapToOfferedTerms(raw, offered);
                if (result.term) {
                    termsSelect.value = result.term;
                    termsSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
                if (noteEl) {
                    if (result.mappedFrom) {
                        noteEl.textContent = '⚠ CRM had "' + result.mappedFrom + '" — mapped to ' + result.term;
                        noteEl.style.cssText = 'font-size:11px;color:#92400e;font-weight:600;margin-left:6px;';
                        noteEl.title = "CRM term didn't match what this builder offers — defaulted conservatively. Manually switch in the dropdown if you want to override.";
                        noteEl.hidden = false;
                    } else {
                        noteEl.hidden = true;
                        noteEl.textContent = '';
                    }
                }
            }
        }

        // 5. Phone — prefer Phone_Best (curated) over Phone/Company_Phone
        if (config.phoneInputId) {
            const phoneEl = document.getElementById(config.phoneInputId);
            if (phoneEl) {
                const best = contact.Phone_Best || contact.Phone || contact.Company_Phone || '';
                if (best) {
                    phoneEl.value = best;
                    phoneEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }

        // 6. Basic contact info auto-fill (optional — only if configured)
        const setIf = (id, val) => {
            if (!id) return;
            const el = document.getElementById(id);
            if (el && val) {
                el.value = val;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        setIf(config.firstNameInputId, contact.NameFirst || '');
        setIf(config.lastNameInputId,  contact.NameLast || '');
        setIf(config.emailInputId,     contact.ContactNumbersEmail || contact.Company_Email || '');
        setIf(config.companyInputId,   contact.CustomerCompanyName || '');
    }

    // Expose globally — quote builders are loaded as plain <script>s, no module system
    window.surfaceCustomerContext = surfaceCustomerContext;
    window.mapToOfferedTerms = mapToOfferedTerms;
})();
