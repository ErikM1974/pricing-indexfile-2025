/**
 * DTG inline form — crm module (Batch 5, 2026-07-09). Moved VERBATIM from the
 * dtg-inline-form.js IIFE; lexical references became the imports below.
 */
// @ts-nocheck — MOVED legacy DOM code (pre-existing checkJs frictions).
/* global */
import { syncDesignThumbnail } from './catalog-search.js';
import { updateSubmitEnabled } from './form-core.js';
import { scheduleStateSave } from './persistence.js';
import { API_BASE, _historyCacheByCustomer, state } from './state.js';
import { recomputeTaxRate } from './tax-shipping.js';
import { escapeHtml, isPickupMethod, markDirty } from './utils.js';

export async function fetchCustomerHistory(idCustomer) {
    if (!idCustomer) return null;
    const idNum = Number(idCustomer);
    if (!Number.isInteger(idNum) || idNum <= 0) return null;
    if (_historyCacheByCustomer.has(idNum)) return _historyCacheByCustomer.get(idNum);
    try {
        const r = await fetch(`${API_BASE}/api/customer-history/${idNum}`);
        if (!r.ok) return null;
        const data = await r.json();
        _historyCacheByCustomer.set(idNum, data);
        return data;
    } catch (e) {
        console.warn('[dtg-inline-form] customer-history fetch failed:', e.message);
        return null;
    }
}

export function renderCustomerHistoryPill(profile) {
    const pill = document.getElementById('dtgHistoryPill');
    const summary = document.getElementById('dtgHistoryPillSummary');
    const body = document.getElementById('dtgHistoryPillBody');
    if (!pill || !summary || !body) return;

    if (!profile || !profile.hasHistory) {
        // Clear stale content from any prior customer's render so the next
        // time this pill is shown there's no flash of old data.
        pill.hidden = true;
        summary.textContent = '';
        body.innerHTML = '';
        return;
    }

    // --- Summary line ---
    const orderCount = profile.orderCount || 0;
    const daysAgo = profile.lastOrderDaysAgo;
    const daysAgoLabel = daysAgo === 0 ? 'today'
        : daysAgo === 1 ? 'yesterday'
        : daysAgo < 30 ? `${daysAgo} days ago`
        : daysAgo < 365 ? `${Math.round(daysAgo / 30)} months ago`
        : `${(daysAgo / 365).toFixed(1)} years ago`;
    summary.textContent = `${orderCount} order${orderCount === 1 ? '' : 's'} on file · last ${daysAgoLabel}`;
    pill.hidden = false;

    // --- Expanded body ---
    const rows = [];

    // Behavior summary
    const usually = [];
    if (profile.topShipMethod) usually.push(profile.topShipMethod);
    if (profile.topTerms) usually.push(profile.topTerms);
    if (usually.length) {
        rows.push(`
            <div class="dhp-row">
                <span class="dhp-label">Usually:</span>
                <span class="dhp-value">${escapeHtml(usually.join(' · '))}</span>
            </div>
        `);
    }

    // Last design
    if (profile.lastDesignId) {
        const designLabel = profile.lastDesignName
            ? `#${profile.lastDesignId} — ${profile.lastDesignName}`
            : `#${profile.lastDesignId}`;
        const isAlreadyPicked = String(state.customer.designNumber || '') === String(profile.lastDesignId);
        rows.push(`
            <div class="dhp-row">
                <span class="dhp-label">Last design:</span>
                <span class="dhp-value">${escapeHtml(designLabel)}</span>
                ${isAlreadyPicked ? '<span class="dhp-applied">✓ selected</span>' : `<button type="button" class="dhp-apply" data-apply="design" data-design="${escapeHtml(profile.lastDesignId)}">Use this</button>`}
            </div>
        `);
    }

    // Top items (read-only — Phase 2 might add quick-add buttons)
    if (profile.topItems && profile.topItems.length) {
        const itemsList = profile.topItems.map(t => `${escapeHtml(t.partNumber)} ${escapeHtml(t.color)} (${t.count}×)`).join(' · ');
        rows.push(`
            <div class="dhp-row">
                <span class="dhp-label">Top items:</span>
                <span class="dhp-value">${itemsList}</span>
            </div>
        `);
    }

    // Phone backfill suggestion — only show when current state has a default/blank phone
    // AND history found a non-default phone in past orders
    const currentPhone = state.customer.phone || '';
    const phoneLooksDefault = !currentPhone || /^253-(922-5793|229-9214)$/.test(currentPhone);
    if (phoneLooksDefault && profile.contactBackfill?.phone) {
        rows.push(`
            <div class="dhp-row dhp-suggest">
                <span class="dhp-label">💡 Phone:</span>
                <span class="dhp-value">${escapeHtml(profile.contactBackfill.phone)}
                    <span class="dhp-meta">from order ${escapeHtml(profile.contactBackfill.phoneFromOrderDate || '')}</span>
                </span>
                <button type="button" class="dhp-apply" data-apply="phone" data-phone="${escapeHtml(profile.contactBackfill.phone)}">Use this</button>
            </div>
        `);
    } else if (phoneLooksDefault && !profile.contactBackfill?.phone) {
        rows.push(`
            <div class="dhp-row dhp-warn">
                <span class="dhp-label">⚠ Phone:</span>
                <span class="dhp-value">No real phone in ${orderCount} past order${orderCount === 1 ? '' : 's'} — Caspio shows "${escapeHtml(currentPhone || 'blank')}". Ask customer.</span>
            </div>
        `);
    }

    // Last ship-to suggestion — only show when not pickup AND ship-to currently blank
    const currentShipMethod = state.shipping?.method || '';
    const isPickupNow = isPickupMethod(currentShipMethod);
    const shipToBlank = !state.shipping?.address1 && !state.shipping?.city;
    if (profile.lastShipTo && shipToBlank && !isPickupNow) {
        const addr = `${profile.lastShipTo.address1}, ${profile.lastShipTo.city}, ${profile.lastShipTo.state} ${profile.lastShipTo.zip}`.trim();
        const dataAttrs = ['address1', 'city', 'state', 'zip']
            .map(k => `data-${k}="${escapeHtml(profile.lastShipTo[k] || '')}"`).join(' ');
        rows.push(`
            <div class="dhp-row dhp-suggest">
                <span class="dhp-label">💡 Last ship-to:</span>
                <span class="dhp-value">${escapeHtml(addr)}
                    <span class="dhp-meta">from order ${escapeHtml(profile.lastShipTo.fromOrderDate || '')}</span>
                </span>
                <button type="button" class="dhp-apply" data-apply="shipto" ${dataAttrs}>Use this</button>
            </div>
        `);
    }

    // Source indicator (for debugging — small + subtle)
    if (profile._source === 'cache') {
        rows.push(`<div class="dhp-row dhp-source"><span class="dhp-meta">(from cache · refreshes every 6 hours)</span></div>`);
    }

    // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
    body.innerHTML = rows.join('');
}

export function wireHistoryPillHandlers() {
    const head = document.getElementById('dtgHistoryPillHead');
    const body = document.getElementById('dtgHistoryPillBody');
    const toggle = document.getElementById('dtgHistoryPillToggle');
    if (!head || !body || !toggle) return;

    // Toggle expand/collapse
    const toggleBody = () => {
        const isHidden = body.hidden;
        body.hidden = !isHidden;
        toggle.setAttribute('aria-expanded', String(isHidden));
        toggle.querySelector('i').className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    };
    head.addEventListener('click', (e) => {
        if (e.target.closest('button.dhp-apply')) return; // don't toggle when clicking apply buttons
        toggleBody();
    });

    // "Use this" buttons inside the expanded body — event delegation
    body.addEventListener('click', (e) => {
        const btn = e.target.closest('button.dhp-apply');
        if (!btn) return;
        const action = btn.dataset.apply;
        if (action === 'phone') {
            const newPhone = btn.dataset.phone;
            state.customer.phone = newPhone;
            const f = document.getElementById('dtgPhone');
            if (f) f.value = newPhone;
            btn.replaceWith(Object.assign(document.createElement('span'), { className: 'dhp-applied', textContent: '✓ applied' }));
            markDirty();
            scheduleStateSave();
        } else if (action === 'design') {
            const newDesign = btn.dataset.design;
            state.customer.designNumber = newDesign;
            const f = document.getElementById('dtgDesignNumber');
            if (f) f.value = newDesign;
            if (typeof syncDesignThumbnail === 'function') syncDesignThumbnail();
            btn.replaceWith(Object.assign(document.createElement('span'), { className: 'dhp-applied', textContent: '✓ applied' }));
            markDirty();
            scheduleStateSave();
            updateSubmitEnabled();
        } else if (action === 'shipto') {
            state.shipping.address1 = btn.dataset.address1 || '';
            state.shipping.city = btn.dataset.city || '';
            state.shipping.state = btn.dataset.state || '';
            state.shipping.zip = btn.dataset.zip || '';
            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
            setVal('dtgShipAddress1', state.shipping.address1);
            setVal('dtgShipCity', state.shipping.city);
            setVal('dtgShipState', state.shipping.state);
            setVal('dtgShipZip', state.shipping.zip);
            btn.replaceWith(Object.assign(document.createElement('span'), { className: 'dhp-applied', textContent: '✓ applied' }));
            markDirty();
            scheduleStateSave();
            if (typeof recomputeTaxRate === 'function') recomputeTaxRate();
        }
    });
}

export function applyContact(ct) {
    state.customer.firstName = ct.NameFirst || '';
    state.customer.lastName = ct.NameLast || '';
    state.customer.email = ct.Email || ct.ContactNumbersEmail || '';
    // Phone priority (Erik 2026-05-23): Phone_Best (curated "best phone
    // for this contact" in CompanyContactsMerge2026) → Phone → Company_Phone.
    // Phone_Best is the field reps should treat as authoritative when
    // present; the others are legacy/imported values.
    state.customer.phone = ct.Phone_Best || ct.Phone || ct.Company_Phone || '';
    state.customer.contactId = ct.ID_Contact != null ? String(ct.ID_Contact) : '';
    // NOTE: Company-level address (state, city, ship-to pre-fill) is
    // captured in pick() at company-pick time. The per-contact records
    // returned by /api/company-contacts-2026/search don't carry address
    // fields, so applyContact only handles per-contact data.
    const fn = document.getElementById('dtgFirstName'); if (fn) fn.value = state.customer.firstName;
    const ln = document.getElementById('dtgLastName'); if (ln) ln.value = state.customer.lastName;
    const em = document.getElementById('dtgEmail'); if (em) em.value = state.customer.email;
    const ph = document.getElementById('dtgPhone'); if (ph) ph.value = state.customer.phone;
    // Keep the contact picker in sync (highlights which contact is active)
    const picker = document.getElementById('dtgContactPicker');
    if (picker && state.customer.contactId) picker.value = state.customer.contactId;
    updateSubmitEnabled();
}

// Surface curated CRM context (Erik 2026-05-23): Customer Warning banner,
// Tax Exempt chip, Account Tier badge, auto-select Payment Terms dropdown.
// Called from pick() when a customer is selected; also from session
// restore when state.customer is rehydrated from a saved draft.
//
// Phase 10 (2026-05-23): MIGRATED to shared customer-context-banners.js
// helper for sync hygiene with EMB/DTF/SCP. Single code path; one fix
// updates all 4 builders. Behavior preserved — DTG's dtg* DOM IDs still
// used via the helper's config object.
export function renderCustomerContextBadges() {
    if (typeof window.surfaceCustomerContext !== 'function') {
        console.warn('[DTG] customer-context-banners.js not loaded — context badges may not render');
        return;
    }
    // Map DTG's camelCase state back to the raw CRM field shape the
    // shared helper expects (Customer_Warning, Is_Tax_Exempt, etc.)
    window.surfaceCustomerContext({
        Customer_Warning: state.customer.customerWarning,
        Is_Tax_Exempt: state.customer.isTaxExempt,
        Tax_Exempt_Number: state.customer.taxExemptNumber,
        Account_Tier: state.customer.accountTier,
        Payment_Terms: state.customer.paymentTerms,
    }, {
        warningContainerId: 'dtgCustomerWarning',
        taxChipContainerId: 'dtgTaxExemptChip',
        tierBadgeContainerId: 'dtgAccountTierBadge',
        termsSelectId: 'dtgTerms',
        termsNoteId: 'dtgTermsMapNote',
        // NWCA only OFFERS three terms today: Prepaid / Net 10 / Pay On Pickup
        // (Erik 2026-05-23). Legacy CRM terms like NET 30/60 get mapped to
        // Prepaid by the shared helper (most conservative — don't extend
        // credit accidentally) with a ⚠ note surfacing the conversion.
        offeredTerms: ['Prepaid', 'Net 10', 'Pay On Pickup'],
    });
    // The shared helper sets the dropdown value; mirror it to state.customer.terms
    // so downstream save logic picks up the same value.
    const termsSelect = document.getElementById('dtgTerms');
    if (termsSelect && termsSelect.value) {
        state.customer.terms = termsSelect.value;
    }
}

// Map a customer's CRM payment term (which may be a legacy / no-longer-offered
// value like NET 30 / NET 60 / COD) to one of the three terms NWCA currently
// OFFERS: Prepaid / Net 10 / Pay On Pickup. Returns null when no match.
//
// Rationale per Erik (2026-05-23): customer table preserves historical
// payment-term agreements from past years. NWCA no longer extends NET 30+
// credit to all customers — only Net 10 max. Unknown net-X terms default
// to Prepaid (safest — most conservative). Rep can manually switch via
// the dropdown if they want to honor a legacy agreement.
export function mapToOfferedTerms(crmTerm) {
    if (!crmTerm) return null;
    const t = String(crmTerm).trim().toLowerCase().replace(/\s+/g, ' ');
    // Exact matches to NWCA's offered set
    if (t === 'prepaid' || t === 'pre-paid' || t === 'pre paid' || t === 'pp') return 'Prepaid';
    if (t === 'pay on pickup' || t === 'pay-on-pickup' || t === 'on pickup' || t === 'pop') return 'Pay On Pickup';
    if (t === 'net 10' || t === 'net10' || t === 'n10' || t === 'net-10') return 'Net 10';
    // Legacy/unsupported terms NWCA no longer offers — default conservatively
    // to Prepaid (don't accidentally extend credit). Includes any other Net X.
    if (/^net[\s-]*\d+$/.test(t)) return 'Prepaid';
    if (t === 'cod' || t === 'c.o.d.' || t === 'cash on delivery') return 'Prepaid';
    if (t === 'cash' || t === 'check') return 'Prepaid';
    // Credit card variants — all imply prepaid (we charge upfront / on file)
    if (t.includes('credit card')) return 'Prepaid';
    // Unknown — return null so caller can decide (we default to Prepaid)
    return null;
}

// Populate the contact dropdown with the picked company's contacts so the
// rep can switch between them. Called from pick() in attachCompanyCombobox
// (when a company is picked from search) and from previewCustomer() (when
// the chat fills the customer). Hidden when no contacts on file.
export function populateContactPicker(contacts) {
    const row = document.getElementById('dtgContactRow');
    const picker = document.getElementById('dtgContactPicker');
    const counter = document.getElementById('dtgContactCount');
    if (!row || !picker) return;
    const list = Array.isArray(contacts) ? contacts : [];
    if (!list.length) {
        row.hidden = true;
        picker.innerHTML = '<option value="">— pick a contact —</option>';
        return;
    }
    row.hidden = false;
    if (counter) counter.textContent = `(${list.length} on file)`;
    // Sort: contacts with email first (emailable = useful), then alphabetically
    const sorted = list.slice().sort((a, b) => {
        const ea = !!(a.Email || a.ContactNumbersEmail);
        const eb = !!(b.Email || b.ContactNumbersEmail);
        if (ea !== eb) return ea ? -1 : 1; // emailable first
        return String(a.ct_NameFull || `${a.NameFirst || ''} ${a.NameLast || ''}`).localeCompare(
            String(b.ct_NameFull || `${b.NameFirst || ''} ${b.NameLast || ''}`));
    });
    // eslint-disable-next-line no-unsanitized/property -- audited (Batch 5 move): every interpolation is escapeHtml()d, numeric, or static config
    picker.innerHTML = sorted.map((ct) => {
        const name = ct.ct_NameFull || `${ct.NameFirst || ''} ${ct.NameLast || ''}`.trim() || '(unnamed)';
        const email = ct.Email || ct.ContactNumbersEmail || '';
        const tag = email ? ` — ${email}` : ' (no email)';
        const id = ct.ID_Contact != null ? String(ct.ID_Contact) : '';
        const selected = id === state.customer.contactId ? ' selected' : '';
        return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(name)}${escapeHtml(tag)}</option>`;
    }).join('');
}
