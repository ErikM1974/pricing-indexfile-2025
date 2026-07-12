/**
 * nwca-public-form.js — submit helper for CUSTOMER-facing public forms
 * (request-a-quote, webstore-inquiry). Staff twins use nwca-form-save.js;
 * this is the customer flavor:
 *   - required-field validation (focus + inline banner; email format checked)
 *   - honeypot: hidden #hpWebsite rides as body.hp — the server fakes success
 *     for bots and stores nothing
 *   - success replaces the form with a thank-you panel + reference number
 *   - failure keeps everything typed and says exactly what to do (call us)
 *
 * NWCAPublicForm.init({ formId, submitId, required: [[id,label]…], build })
 * build() returns the same shape the twins produce (see nwca-form-save.js).
 */
(function (global) {
    'use strict';

    function apiBase() {
        if (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL) {
            return global.APP_CONFIG.API.BASE_URL.replace(/\/+$/, '');
        }
        return null;
    }

    function val(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function checked(id) {
        var el = document.getElementById(id);
        return !!(el && el.checked);
    }

    function banner(kind, html) {
        var el = document.querySelector('.public-form-banner');
        if (!el) {
            el = document.createElement('div');
            el.className = 'public-form-banner';
            var sheet = document.querySelector('.form-sheet');
            sheet.insertBefore(el, sheet.firstChild);
        }
        el.classList.remove('is-ok', 'is-error');
        el.classList.add(kind === 'ok' ? 'is-ok' : 'is-error');
        el.innerHTML = html;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    // "7/25/2026", "2026-07-25" → ISO day (same normalizer the twins use)
    function toIsoDay(text) {
        var s = String(text == null ? '' : text).trim();
        if (!s) return '';
        var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
        m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
            var year = m[3].length === 2 ? '20' + m[3] : m[3];
            var month = parseInt(m[1], 10), day = parseInt(m[2], 10);
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return year + '-' + pad(month) + '-' + pad(day);
        }
        return '';
    }
    function pad(n) { return String(n).padStart(2, '0'); }

    function init(opts) {
        var btn = document.getElementById(opts.submitId);
        if (!btn || typeof opts.build !== 'function') return;

        btn.addEventListener('click', function () {
            // required fields — say which one, put the cursor there
            for (var i = 0; i < (opts.required || []).length; i++) {
                var id = opts.required[i][0], label = opts.required[i][1];
                var el = document.getElementById(id);
                var v = el ? el.value.trim() : '';
                var bad = !v || (/email/i.test(id) && !/.+@.+\..+/.test(v));
                if (bad) {
                    banner('error', '<i class="fas fa-circle-exclamation"></i> Please enter ' + label + ' so we can get back to you.');
                    if (el) el.focus();
                    return;
                }
            }

            var data;
            try { data = opts.build(); }
            catch (e) {
                console.error('[public-form] build failed:', e);
                banner('error', '<i class="fas fa-circle-exclamation"></i> Something went wrong reading the form — call us at 253-922-5793 and we\'ll take it by phone.');
                return;
            }

            var base = apiBase();
            if (!base) {
                banner('error', '<i class="fas fa-circle-exclamation"></i> We couldn\'t load our connection — call 253-922-5793 or email sales@nwcustomapparel.com.');
                return;
            }

            btn.disabled = true;
            var oldLabel = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';

            fetch(base + '/api/form-submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formId: opts.formId,
                    company: data.company,
                    contactName: data.contactName || '',
                    phone: data.phone || '',
                    email: data.email || '',
                    salesRep: '',
                    dueDateIso: toIsoDay(data.dueDateText),
                    summary: data.summary || '',
                    payload: data.payload || {},
                    hp: val('hpWebsite'), // honeypot — humans never see the field
                }),
            })
                .then(function (resp) {
                    return resp.json().catch(function () { return {}; }).then(function (body) {
                        if (!resp.ok) throw new Error(body.error || ('HTTP ' + resp.status));
                        return body;
                    });
                })
                .then(function (body) {
                    // swap the form for the thank-you panel
                    document.querySelectorAll('.form-sheet .form-section, .form-sheet .public-submit-row').forEach(function (el) { el.hidden = true; });
                    var ok = document.querySelector('.public-success');
                    if (ok) {
                        ok.hidden = false;
                        var ref = ok.querySelector('.public-success-ref');
                        if (ref) ref.textContent = body.submissionId || '';
                    }
                    var b = document.querySelector('.public-form-banner');
                    if (b) b.remove();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                })
                .catch(function (err) {
                    console.error('[public-form] submit failed:', err);
                    banner('error', '<i class="fas fa-circle-exclamation"></i> <strong>That didn\'t go through.</strong> Nothing you typed was lost — try again in a minute, or call 253-922-5793 / email sales@nwcustomapparel.com.');
                })
                .finally(function () {
                    btn.disabled = false;
                    btn.innerHTML = oldLabel;
                });
        });
    }

    global.NWCAPublicForm = { init: init, val: val, checked: checked };
})(window);
