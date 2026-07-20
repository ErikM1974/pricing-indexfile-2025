(function () {
  'use strict';

  // Vendor (subcontractor) login — same flow as customer-login.js but posting to the
  // vendor auth endpoint. Shares customer-login.css and the cl-* markup.

  // Show the "expired/invalid link" notice when bounced back from verify.
  var params = new URLSearchParams(location.search);
  if (params.get('error') === 'expired') {
    var err = document.getElementById('cl-error');
    if (err) err.hidden = false;
  }

  var form = document.getElementById('cl-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = (document.getElementById('cl-email').value || '').trim();
    if (!email) return;

    var btn = document.getElementById('cl-submit');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    // Fire-and-forget. ALWAYS show the same "check your email" state regardless of the
    // response, so the page never reveals whether an email is on file (no enumeration).
    fetch('/auth/vendor/request-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: email })
    }).catch(function () {}).finally(function () {
      document.getElementById('cl-form-view').hidden = true;
      document.getElementById('cl-sent-view').hidden = false;
    });
  });
})();
