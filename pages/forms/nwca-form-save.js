/**
 * nwca-form-save.js — "Save to NWCA" for the fillable form twins.
 *
 * Each saving twin calls NWCAFormSave.init({ formId, build }) after its DOM is
 * ready. A Save button is injected into the toolbar; clicking it runs build()
 * (the form's own serializer), POSTs to the proxy /api/form-submissions, and
 * shows the Submission_ID in a banner. Failures show a visible red banner and
 * NOTHING is lost — the typed form stays as-is (Erik's #1 rule: never silent).
 *
 * build() returns:
 *   {
 *     company, contactName, phone, email, customerNumber, salesRep,
 *     dueDateText,          // free-text date from the form (normalized here)
 *     summary,              // one-line list-view string
 *     payload,              // self-describing: { fields:[[label,value]…],
 *                           //   checks:[label…], tables:[{title,columns,rows}], notes:[[label,text]…] }
 *     items                 // sample-checkout only — rows for Sample_Checkout_Items
 *   }
 */
(function (global) {
    'use strict';

    function apiBase() {
        if (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL) {
            return global.APP_CONFIG.API.BASE_URL.replace(/\/+$/, '');
        }
        return null;
    }

    // "7/25/2026", "07-25-26", "2026-07-25" → "2026-07-25"; anything else → ''
    function toIsoDay(text) {
        var s = String(text == null ? '' : text).trim();
        if (!s) return '';
        var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
        m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
            var year = m[3].length === 2 ? '20' + m[3] : m[3];
            var month = parseInt(m[1], 10);
            var day = parseInt(m[2], 10);
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return year + '-' + pad(month) + '-' + pad(day);
            }
        }
        return '';
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    function val(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function checked(id) {
        var el = document.getElementById(id);
        return !!(el && el.checked);
    }

    function banner(kind, html) {
        var el = document.querySelector('.form-save-banner');
        if (!el) {
            el = document.createElement('div');
            el.className = 'form-save-banner no-print';
            var sheet = document.querySelector('.form-sheet');
            if (sheet.classList.contains('form-sheet--landscape')) el.classList.add('form-save-banner--wide');
            sheet.parentNode.insertBefore(el, sheet);
        }
        el.classList.remove('form-save-banner--ok', 'form-save-banner--error');
        el.classList.add(kind === 'ok' ? 'form-save-banner--ok' : 'form-save-banner--error');
        el.innerHTML = html;
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function init(opts) {
        var actions = document.querySelector('.toolbar-actions');
        var printBtn = document.getElementById('printFormBtn');
        if (!actions || !printBtn || !opts || typeof opts.build !== 'function') return;

        var saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.id = 'saveFormBtn';
        saveBtn.className = 'toolbar-btn toolbar-btn--save';
        saveBtn.innerHTML = '<i class="fas fa-cloud-arrow-up"></i> Save to NWCA';
        actions.insertBefore(saveBtn, printBtn);

        saveBtn.addEventListener('click', function () {
            var data;
            try { data = opts.build(); }
            catch (e) {
                console.error('[form-save] build failed:', e);
                banner('error', '<i class="fas fa-triangle-exclamation"></i> Could not read the form — nothing was saved.');
                return;
            }
            if (!data.company) {
                banner('error', '<i class="fas fa-triangle-exclamation"></i> Enter the <strong>Company</strong> before saving.');
                return;
            }
            var base = apiBase();
            if (!base) {
                banner('error', '<i class="fas fa-triangle-exclamation"></i> Config failed to load — print a paper copy; saving is unavailable.');
                return;
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

            fetch(base + '/api/form-submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formId: opts.formId,
                    company: data.company,
                    contactName: data.contactName || '',
                    phone: data.phone || '',
                    email: data.email || '',
                    customerNumber: data.customerNumber || '',
                    salesRep: data.salesRep || '',
                    dueDateIso: toIsoDay(data.dueDateText),
                    summary: data.summary || '',
                    payload: data.payload || {},
                    items: data.items,
                }),
            })
                .then(function (resp) {
                    return resp.json().catch(function () { return {}; }).then(function (body) {
                        if (!resp.ok) throw new Error(body.error || ('HTTP ' + resp.status));
                        return body;
                    });
                })
                .then(function (body) {
                    NWCAForm.markClean();
                    banner('ok', '<i class="fas fa-circle-check"></i> Saved to NWCA as <strong>' + escapeHtml(body.submissionId) +
                        '</strong> — it\'s in the Forms Inbox. You can still print.');
                })
                .catch(function (err) {
                    console.error('[form-save] save failed:', err);
                    banner('error', '<i class="fas fa-triangle-exclamation"></i> <strong>NOT saved</strong> (' + escapeHtml(err.message) +
                        '). Your typing is still here — print a paper copy and try again in a minute.');
                })
                .finally(function () {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i class="fas fa-cloud-arrow-up"></i> Save to NWCA';
                });
        });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    global.NWCAFormSave = { init: init, toIsoDay: toIsoDay, val: val, checked: checked };
})(window);
