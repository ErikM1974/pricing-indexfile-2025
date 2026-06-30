/**
 * customer-portal-admin.js — controller for dashboards/customer-portal-admin.html
 *
 * Staff console for the customer portal invite registry (Customer_Portal_Access).
 * CRUD goes through the same-origin, role-gated CRM proxy (/api/crm-proxy/...),
 * which injects the server-side secret — the public proxy is never hit directly for
 * writes. Errors surface to the dash error banner (DashPage.showError) — never a
 * silent failure (Erik's #1 rule).
 */
(function () {
  'use strict';

  var ACCESS_API = '/api/crm-proxy/customer-portal-access';
  var SEARCH_API = '/api/crm-proxy/company-contacts/search';
  var SENDLINK_API = '/api/portal-admin/send-link';

  var invites = [];          // last-loaded rows
  var filterTerm = '';
  var searchTimer = null;
  var me = null;             // logged-in staff identity (for the "My customers" filter)
  var myOnly = false;        // when true, show only the logged-in rep's accounts

  function esc(s) { if (s == null) return ''; var d = document.createElement('div'); d.appendChild(document.createTextNode(String(s))); return d.innerHTML; }

  function fmtLastLogin(s) {
    if (!s) return '<span class="cpa-lastlogin cpa-never">Never</span>';
    var d = new Date(s);
    if (isNaN(d.getTime())) return '<span class="cpa-lastlogin cpa-never">—</span>';
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '<span class="cpa-lastlogin">' + m[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + '</span>';
  }

  // ---- network helper: same-origin, JSON, 401 → re-login ----
  async function api(path, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    var r = await fetch(path, opts);
    if (r.status === 401) { window.location.href = '/auth/saml/login?next=' + encodeURIComponent(location.pathname); throw new Error('auth'); }
    var data = null;
    try { data = await r.json(); } catch (e) { /* non-JSON */ }
    if (!r.ok) {
      var msg = (data && (data.error || data.message)) || ('Request failed (' + r.status + ')');
      var err = new Error(msg); err.status = r.status; throw err;
    }
    return data;
  }

  function toast(msg, isError) {
    var t = document.getElementById('cpa-toast');
    t.textContent = msg;
    t.className = 'cpa-toast show' + (isError ? ' cpa-toast-error' : '');
    setTimeout(function () { t.className = 'cpa-toast' + (isError ? ' cpa-toast-error' : ''); }, 3200);
  }

  // Who am I? Reveals the "My customers" filter when the logged-in staffer owns accounts.
  async function loadMe() {
    try {
      me = await api('/api/portal-admin/me');
      if (me && me.repName) document.getElementById('cpa-mine-btn').style.display = '';
    } catch (e) { if (e.message !== 'auth') console.warn('[portal-admin] whoami failed:', e.message); }
  }

  // ---- load + render ----
  async function loadInvites() {
    var root = document.getElementById('content-root');
    root.className = 'dash-loading';
    root.textContent = 'Loading…';
    try {
      var data = await api(ACCESS_API);
      invites = (data && data.rows) || [];
      invites.sort(function (a, b) { return String(a.company_name || '').localeCompare(String(b.company_name || '')); });
      renderStats();
      renderTable();
    } catch (err) {
      if (err.message === 'auth') return;
      console.error('[portal-admin] load failed:', err);
      DashPage.showError('Unable to load customer portals: ' + err.message);
      root.className = '';
      root.innerHTML = '<div class="cpa-empty"><i class="fas fa-triangle-exclamation"></i>Could not load the list. Please refresh.</div>';
    }
  }

  function renderStats() {
    var enabled = invites.filter(function (r) { return r.enabled; }).length;
    var loggedin = invites.filter(function (r) { return r.last_login; }).length;
    document.getElementById('stat-total').textContent = invites.length;
    document.getElementById('stat-enabled').textContent = enabled;
    document.getElementById('stat-disabled').textContent = invites.length - enabled;
    document.getElementById('stat-loggedin').textContent = loggedin;
  }

  function filtered() {
    var list = invites;
    if (myOnly && me && me.repName) {
      var rn = me.repName.trim().toLowerCase();
      list = list.filter(function (r) { return String(r.account_rep || '').trim().toLowerCase() === rn; });
    }
    if (filterTerm) {
      var t = filterTerm.toLowerCase();
      list = list.filter(function (r) {
        return String(r.company_name || '').toLowerCase().indexOf(t) >= 0 ||
               String(r.email || '').toLowerCase().indexOf(t) >= 0 ||
               String(r.account_rep || '').toLowerCase().indexOf(t) >= 0 ||
               String(r.id_Customer || '').indexOf(t) >= 0;
      });
    }
    return list;
  }

  function renderTable() {
    var root = document.getElementById('content-root');
    root.className = '';
    var rows = filtered();
    document.getElementById('cpa-rowcount').textContent = rows.length + (rows.length === 1 ? ' customer' : ' customers');

    if (!invites.length) {
      root.innerHTML = '<div class="cpa-empty"><i class="fas fa-user-group"></i>No customers invited yet. Click <strong>Add Customer</strong> to invite your first one.</div>';
      return;
    }
    if (!rows.length) {
      root.innerHTML = '<div class="cpa-empty"><i class="fas fa-magnifying-glass"></i>No customers match "' + esc(filterTerm) + '".</div>';
      return;
    }

    var body = rows.map(function (r) {
      var badge = r.enabled
        ? '<span class="cpa-badge cpa-badge--enabled">Active</span>'
        : '<span class="cpa-badge cpa-badge--disabled">Disabled</span>';
      var toggleLabel = r.enabled ? 'Disable' : 'Enable';
      var toggleIcon = r.enabled ? 'fa-ban' : 'fa-circle-check';
      return '<tr>' +
        '<td><div class="cpa-company">' + (esc(r.company_name) || '<em>—</em>') + '</div></td>' +
        '<td class="cpa-hide-sm cpa-rep">' + (r.account_rep ? esc(r.account_rep) : '<span class="cpa-rep-none">—</span>') + '</td>' +
        '<td><div class="cpa-email">' + esc(r.email) + '</div></td>' +
        '<td class="cpa-hide-sm"><span class="cpa-cid">' + esc(r.id_Customer) + '</span></td>' +
        '<td>' + badge + '</td>' +
        '<td class="cpa-hide-sm">' + fmtLastLogin(r.last_login) + '</td>' +
        '<td><div class="cpa-actions">' +
          '<button class="cpa-btn-icon" data-action="preview" data-id="' + esc(r.id_Customer) + '" title="Preview their portal"><i class="fas fa-eye"></i></button>' +
          '<button class="cpa-btn-icon" data-action="sendlink" data-email="' + esc(r.email) + '" title="Email a login link"><i class="fas fa-paper-plane"></i></button>' +
          '<button class="cpa-btn-icon" data-action="toggle" data-pk="' + esc(r.PK_ID) + '" data-enabled="' + (r.enabled ? '1' : '0') + '" title="' + toggleLabel + ' access"><i class="fas ' + toggleIcon + '"></i></button>' +
          '<button class="cpa-btn-icon cpa-danger" data-action="delete" data-pk="' + esc(r.PK_ID) + '" data-email="' + esc(r.email) + '" title="Remove access"><i class="fas fa-trash"></i></button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    root.innerHTML =
      '<div style="overflow-x:auto"><table class="cpa-table"><thead><tr>' +
      '<th>Company</th><th class="cpa-hide-sm">Account Rep</th><th>Email</th><th class="cpa-hide-sm">Customer #</th><th>Status</th>' +
      '<th class="cpa-hide-sm">Last Sign-In</th><th style="text-align:right">Actions</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  // ---- row actions (event delegation) ----
  async function onTableClick(e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');

    if (action === 'preview') {
      window.open('/portal-admin/preview/' + encodeURIComponent(btn.getAttribute('data-id')), '_blank', 'noopener');
      return;
    }
    if (action === 'sendlink') {
      var email = btn.getAttribute('data-email');
      btn.disabled = true;
      try {
        await api(SENDLINK_API, { method: 'POST', body: JSON.stringify({ email: email }) });
        toast('Login link emailed to ' + email);
      } catch (err) {
        if (err.message !== 'auth') toast(err.message, true);
      } finally { btn.disabled = false; }
      return;
    }
    if (action === 'toggle') {
      var pk = btn.getAttribute('data-pk');
      var nowEnabled = btn.getAttribute('data-enabled') === '1';
      btn.disabled = true;
      try {
        await api(ACCESS_API + '/' + encodeURIComponent(pk), { method: 'PUT', body: JSON.stringify({ enabled: nowEnabled ? 'No' : 'Yes' }) });
        toast(nowEnabled ? 'Access disabled' : 'Access enabled');
        await loadInvites();
      } catch (err) {
        if (err.message !== 'auth') { toast(err.message, true); btn.disabled = false; }
      }
      return;
    }
    if (action === 'delete') {
      var dpk = btn.getAttribute('data-pk');
      var demail = btn.getAttribute('data-email');
      if (!window.confirm('Remove portal access for ' + demail + '?\n\nThey will no longer be able to log in. (You can always re-invite them later.)')) return;
      btn.disabled = true;
      try {
        await api(ACCESS_API + '/' + encodeURIComponent(dpk), { method: 'DELETE' });
        toast('Access removed for ' + demail);
        await loadInvites();
      } catch (err) {
        if (err.message !== 'auth') { toast(err.message, true); btn.disabled = false; }
      }
      return;
    }
  }

  // ---- Add Customer modal ----
  function openModal() {
    document.getElementById('cpa-lookup').value = '';
    document.getElementById('cpa-lookup-results').innerHTML = '<div class="cpa-lookup-hint">Start typing to search your customers…</div>';
    document.getElementById('cpa-email').value = '';
    document.getElementById('cpa-idcustomer').value = '';
    document.getElementById('cpa-company').value = '';
    document.getElementById('cpa-sendlink').checked = true;
    document.getElementById('cpa-modal-error').textContent = '';
    document.getElementById('cpa-modal').style.display = 'flex';
    setTimeout(function () { document.getElementById('cpa-lookup').focus(); }, 50);
  }
  function closeModal() { document.getElementById('cpa-modal').style.display = 'none'; }

  function onLookupInput() {
    var q = document.getElementById('cpa-lookup').value.trim();
    clearTimeout(searchTimer);
    var box = document.getElementById('cpa-lookup-results');
    if (q.length < 2) { box.innerHTML = '<div class="cpa-lookup-hint">Type at least 2 characters…</div>'; return; }
    box.innerHTML = '<div class="cpa-lookup-hint">Searching…</div>';
    searchTimer = setTimeout(async function () {
      try {
        var data = await api(SEARCH_API + '?q=' + encodeURIComponent(q) + '&limit=8');
        var contacts = (data && data.contacts) || [];
        if (!contacts.length) { box.innerHTML = '<div class="cpa-lookup-hint">No matches — you can still type the details below manually.</div>'; return; }
        box.innerHTML = contacts.map(function (c) {
          var name = c.ct_NameFull || [c.NameFirst, c.NameLast].filter(Boolean).join(' ');
          var email = c.ContactNumbersEmail || '';
          // Surface the account owner/rep so a rep recognises their OWN live account
          // (the table is full of DEAD/House rows). 'DEAD' shown as a plain "inactive" flag.
          var owner = c.Account_Owner || c.CustomerCustomerServiceRep || '';
          var ownerTxt = owner ? (/^dead$/i.test(owner.trim()) ? 'inactive account' : owner) : '';
          return '<div class="cpa-lookup-item" data-id="' + esc(c.id_Customer) + '" data-company="' + esc(c.CustomerCompanyName) + '" data-email="' + esc(email) + '">' +
            '<div class="li-co">' + esc(c.CustomerCompanyName || '(no company name)') + '</div>' +
            '<div class="li-meta">' + (name ? esc(name) + ' &middot; ' : '') + (email ? esc(email) : '<em>no email on file</em>') + ' &middot; #' + esc(c.id_Customer) +
              (ownerTxt ? ' &middot; ' + esc(ownerTxt) : '') + '</div>' +
          '</div>';
        }).join('');
      } catch (err) {
        if (err.message !== 'auth') box.innerHTML = '<div class="cpa-lookup-hint">Search failed: ' + esc(err.message) + '</div>';
      }
    }, 280);
  }

  function onLookupPick(e) {
    var item = e.target.closest('.cpa-lookup-item');
    if (!item) return;
    document.getElementById('cpa-idcustomer').value = item.getAttribute('data-id') || '';
    document.getElementById('cpa-company').value = item.getAttribute('data-company') || '';
    document.getElementById('cpa-email').value = item.getAttribute('data-email') || '';
    document.getElementById('cpa-modal-error').textContent = '';
    var emailEl = document.getElementById('cpa-email');
    if (!emailEl.value) { emailEl.focus(); } else { document.getElementById('cpa-save').focus(); }
  }

  async function saveInvite() {
    var email = document.getElementById('cpa-email').value.trim().toLowerCase();
    var idCustomer = document.getElementById('cpa-idcustomer').value.trim();
    var company = document.getElementById('cpa-company').value.trim();
    var sendLink = document.getElementById('cpa-sendlink').checked;
    var errEl = document.getElementById('cpa-modal-error');
    errEl.textContent = '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = 'Please enter a valid email.'; return; }
    if (!/^\d+$/.test(idCustomer)) { errEl.textContent = 'Customer # must be the numeric ShopWorks id (use the search above to fill it in).'; return; }

    var saveBtn = document.getElementById('cpa-save');
    saveBtn.disabled = true;
    try {
      await api(ACCESS_API, { method: 'POST', body: JSON.stringify({ email: email, id_Customer: idCustomer, company_name: company, enabled: 'Yes' }) });
      if (sendLink) {
        try { await api(SENDLINK_API, { method: 'POST', body: JSON.stringify({ email: email }) }); toast('Invited ' + email + ' — login link sent'); }
        catch (e2) { toast('Invited ' + email + ' (link not sent: ' + e2.message + ')', true); }
      } else {
        toast('Invited ' + email);
      }
      closeModal();
      await loadInvites();
    } catch (err) {
      if (err.message === 'auth') return;
      errEl.textContent = err.message;
    } finally {
      saveBtn.disabled = false;
    }
  }

  // ---- wire up ----
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('content-root').addEventListener('click', onTableClick);
    document.getElementById('cpa-filter').addEventListener('input', function (e) { filterTerm = e.target.value.trim(); renderTable(); });
    document.getElementById('cpa-mine-btn').addEventListener('click', function () {
      myOnly = !myOnly;
      this.classList.toggle('cpa-btn-active', myOnly);
      renderTable();
    });
    document.getElementById('cpa-add-btn').addEventListener('click', openModal);
    document.getElementById('cpa-modal-close').addEventListener('click', closeModal);
    document.getElementById('cpa-cancel').addEventListener('click', closeModal);
    document.getElementById('cpa-modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    document.getElementById('cpa-lookup').addEventListener('input', onLookupInput);
    document.getElementById('cpa-lookup-results').addEventListener('click', onLookupPick);
    document.getElementById('cpa-save').addEventListener('click', saveInvite);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    loadMe();
    loadInvites();
  });
})();
