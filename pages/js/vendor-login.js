(function () {
  'use strict';

  // Vendor (subcontractor) login — same flow as customer-login.js but posting to the vendor auth
  // endpoint and carrying /vendor deep links. Shares customer-login.css and the cl-* markup, so a
  // change here usually belongs in customer-login.js too.
  var ENDPOINT = '/auth/vendor/request-link';
  var NEXT_RE = /^\/vendor(\/|\?|#|$)/;
  var EXPIRED = 'That link has expired or is no longer valid. Enter your email to get a new one.';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var params = new URLSearchParams(location.search);
  var form = document.getElementById('cl-form');
  var emailEl = document.getElementById('cl-email');
  var btn = document.getElementById('cl-submit');
  var errEl = document.getElementById('cl-error');
  var formView = document.getElementById('cl-form-view');
  var sentView = document.getElementById('cl-sent-view');
  var BTN_TEXT = btn ? btn.textContent : '';

  var nextPath = params.get('next') || '';
  if (!NEXT_RE.test(nextPath) || /[\s\\<>]/.test(nextPath) || nextPath.length > 400) nextPath = '';

  function showError(msg) { if (!errEl) return; errEl.textContent = msg; errEl.hidden = false; }
  function hideError() { if (errEl) errEl.hidden = true; }
  function resetButton() { if (btn) { btn.disabled = false; btn.textContent = BTN_TEXT; } }

  if (params.get('error') === 'expired') showError(EXPIRED);

  if (!form || !emailEl || !btn) return;

  var again = document.getElementById('cl-again');
  if (again) again.addEventListener('click', function (e) {
    e.preventDefault();
    sentView.hidden = true; formView.hidden = false;
    resetButton(); hideError(); emailEl.value = ''; emailEl.focus();
  });

  emailEl.addEventListener('input', function () { emailEl.removeAttribute('aria-invalid'); hideError(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = (emailEl.value || '').trim();
    if (!EMAIL_RE.test(email)) {
      emailEl.setAttribute('aria-invalid', 'true');
      showError('Enter a valid email address, like you@yourshop.com.');
      emailEl.focus();
      return;
    }
    emailEl.removeAttribute('aria-invalid'); hideError();
    btn.disabled = true;
    btn.textContent = 'Sending…';

    var body = { email: email };
    if (nextPath) body.next = nextPath;
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    }).then(function (r) { return r.status; }, function () { return 0; }).then(function (status) {
      // Same "check your email" state whether or not the email is on file (no enumeration);
      // rate limits, network failures and server outages are surfaced without account details.
      if (status === 429) { resetButton(); showError('Too many sign-in requests. Please wait a few minutes and try again.'); return; }
      if (status === 0) { resetButton(); showError('We couldn’t reach the server. Check your connection and try again.'); return; }
      // An infrastructure outage is independent of whether an account exists. Keep 200 identical for everyone.
      if (status >= 500) { resetButton(); showError('Sign-in is temporarily unavailable. Please try again in a moment.'); return; }
      formView.hidden = true;
      sentView.hidden = false;
      var h = sentView.querySelector('h1');
      if (h) h.focus();
    });
  });
})();
