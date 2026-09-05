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
  // Reward-dollar balances for the Rewards column — ONE call for every customer (proxy sums the
  // ledger), refreshed after any posting from the rewards modal. Sort by clicking the column head.
  var BALANCES_API = '/api/crm-proxy/customer-rewards/balances';
  var balances = {};          // id_Customer → balance
  var balancesLoaded = false;
  var sortByRewards = false;  // false = company A→Z (default), true = balance high→low
  function balanceOf(id) { var b = balances[String(id)]; return typeof b === 'number' ? b : 0; }
  function fmtMoney(n) { return '$' + (Math.round(n * 100) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  async function loadRewardBalances() {
    try {
      var data = await api(BALANCES_API);
      balances = (data && data.balances) || {};
      balancesLoaded = true;
    } catch (err) {
      if (err.message === 'auth') return;
      balances = {}; balancesLoaded = false;
      console.error('[portal-admin] reward balances failed:', err);
      toast('Reward balances unavailable: ' + err.message, true);   // never a silent $0 (Erik #1 rule)
    }
    renderStats();
    renderTable();
  }
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
    var now = new Date();
    var isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (isToday) {
      // Same-day rows show the time so staff can prioritize the newest re-order requests.
      var h = d.getHours(), min = d.getMinutes();
      var ampm = h >= 12 ? 'PM' : 'AM';
      var h12 = h % 12; if (h12 === 0) h12 = 12;
      var tstr = h12 + ':' + (min < 10 ? '0' + min : min) + ' ' + ampm;
      return '<span class="cpa-lastlogin cpa-today">Today ' + tstr + '</span>';
    }
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
      if (me && me.repName) {
        document.getElementById('cpa-mine-btn').hidden = false;
        document.getElementById('cpa-req-mine-btn').hidden = false;
      }
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
      loadRewardBalances();
    } catch (err) {
      if (err.message === 'auth') return;
      console.error('[portal-admin] load failed:', err);
      DashPage.showError('Unable to load customer portals: ' + err.message);
      root.className = '';
      root.innerHTML = '<div class="cpa-empty"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i>Could not load the list.<br><button type="button" class="cpa-btn cpa-btn-ghost cpa-btn-sm" id="cpa-retry-invites"><i class="fas fa-rotate-right" aria-hidden="true"></i> Retry</button></div>';
    }
  }

  function renderStats() {
    var enabled = invites.filter(function (r) { return r.enabled; }).length;
    var loggedin = invites.filter(function (r) { return r.last_login; }).length;
    document.getElementById('stat-total').textContent = invites.length;
    document.getElementById('stat-enabled').textContent = enabled;
    document.getElementById('stat-disabled').textContent = invites.length - enabled;
    document.getElementById('stat-loggedin').textContent = loggedin;
    var rw = document.getElementById('stat-rewards');
    if (rw) {
      if (!balancesLoaded) rw.textContent = '—';
      else rw.textContent = fmtMoney(invites.reduce(function (s, r) { return s + balanceOf(r.id_Customer); }, 0));
    }
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
    if (sortByRewards) {
      list = list.slice().sort(function (a, b) {
        return (balanceOf(b.id_Customer) - balanceOf(a.id_Customer)) || String(a.company_name || '').localeCompare(String(b.company_name || ''));
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
      root.innerHTML = '<div class="cpa-empty"><i class="fas fa-user-group" aria-hidden="true"></i>No customers invited yet. Click <strong>Add Customer</strong> to invite your first one.</div>';
      return;
    }
    if (!rows.length) {
      var why = filterTerm ? 'No customers match "' + esc(filterTerm) + '"' + (myOnly ? ' among your accounts' : '') + '.' : 'None of the invited customers are on your accounts.';
      root.innerHTML = '<div class="cpa-empty"><i class="fas fa-magnifying-glass" aria-hidden="true"></i>' + why + '</div>';
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
        '<td class="cpa-rw-cell">' + (function () {
          if (!balancesLoaded) return '<span class="cpa-rep-none">…</span>';
          var b = balanceOf(r.id_Customer);
          return b > 0.005
            ? '<button class="cpa-rw-chip" data-action="rewards" data-id="' + esc(r.id_Customer) + '" data-company="' + esc(r.company_name) + '" title="Open reward dollars" aria-label="Reward dollars for ' + esc(r.company_name) + ': ' + fmtMoney(b) + '">' + fmtMoney(b) + '</button>'
            : '<span class="cpa-rep-none">—</span>';
        })() + '</td>' +
        '<td>' + badge + '</td>' +
        '<td class="cpa-hide-sm">' + fmtLastLogin(r.last_login) + '</td>' +
        '<td><div class="cpa-actions">' +
          '<button class="cpa-btn-icon" data-action="preview" data-id="' + esc(r.id_Customer) + '" title="Preview their portal" aria-label="Preview portal for ' + esc(r.company_name) + '"><i class="fas fa-eye" aria-hidden="true"></i></button>' +
          '<button class="cpa-btn-icon" data-action="rewards" data-id="' + esc(r.id_Customer) + '" data-company="' + esc(r.company_name) + '" title="Reward dollars" aria-label="Reward dollars for ' + esc(r.company_name) + '"><i class="fas fa-coins" aria-hidden="true"></i></button>' +
          '<button class="cpa-btn-icon" data-action="sendlink" data-email="' + esc(r.email) + '" title="Email a login link" aria-label="Email a login link to ' + esc(r.email) + '"><i class="fas fa-paper-plane" aria-hidden="true"></i></button>' +
          '<button class="cpa-btn-icon" data-action="toggle" data-pk="' + esc(r.PK_ID) + '" data-enabled="' + (r.enabled ? '1' : '0') + '" data-email="' + esc(r.email) + '" title="' + toggleLabel + ' access" aria-label="' + toggleLabel + ' access for ' + esc(r.email) + '"><i class="fas ' + toggleIcon + '" aria-hidden="true"></i></button>' +
          '<button class="cpa-btn-icon cpa-danger" data-action="delete" data-pk="' + esc(r.PK_ID) + '" data-email="' + esc(r.email) + '" title="Remove access" aria-label="Remove access for ' + esc(r.email) + '"><i class="fas fa-trash" aria-hidden="true"></i></button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    root.innerHTML =
      '<div class="cpa-table-scroll"><table class="cpa-table"><thead><tr>' +
      '<th>Company</th><th class="cpa-hide-sm">Account Rep</th><th>Email</th><th class="cpa-hide-sm">Customer #</th>' +
      '<th><button type="button" class="cpa-th-sort' + (sortByRewards ? ' cpa-th-sort--on' : '') + '" id="cpa-sort-rewards" title="Sort by reward balance" aria-pressed="' + (sortByRewards ? 'true' : 'false') + '">Rewards <i class="fas ' + (sortByRewards ? 'fa-arrow-down-wide-short' : 'fa-sort') + '" aria-hidden="true"></i></button></th><th>Status</th>' +
      '<th class="cpa-hide-sm">Last Sign-In</th><th class="cpa-th-right">Actions</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  // ---- row actions (event delegation) ----
  async function onTableClick(e) {
    if (e.target.closest('#cpa-retry-invites')) { loadInvites(); return; }
    if (e.target.closest('#cpa-sort-rewards')) { sortByRewards = !sortByRewards; renderTable(); return; }
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');

    if (action === 'preview') {
      window.open('/portal-admin/preview/' + encodeURIComponent(btn.getAttribute('data-id')), '_blank', 'noopener');
      return;
    }
    if (action === 'rewards') {
      openRewardsModal(btn.getAttribute('data-id'), btn.getAttribute('data-company'));
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
      var temail = btn.getAttribute('data-email');
      var nowEnabled = btn.getAttribute('data-enabled') === '1';
      btn.disabled = true;
      // Immediate feedback before the re-fetch so staff see the action registered.
      toast((nowEnabled ? 'Disabling access' : 'Enabling access') + (temail ? ' for ' + temail : '') + '…');
      try {
        await api(ACCESS_API + '/' + encodeURIComponent(pk), { method: 'PUT', body: JSON.stringify({ enabled: nowEnabled ? 'No' : 'Yes' }) });
        toast((nowEnabled ? 'Access disabled' : 'Access enabled') + (temail ? ' for ' + temail : ''));
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
      // Immediate feedback, then the real outcome — never a success toast before the DELETE returns.
      toast('Removing access for ' + demail + '…');
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
    lookupActive = -1;
    lastFocus = document.activeElement;
    document.getElementById('cpa-modal').hidden = false;
    setTimeout(function () { document.getElementById('cpa-lookup').focus(); }, 50);
  }
  function closeModal() {
    var m = document.getElementById('cpa-modal');
    if (m.hidden) return;
    m.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  var lastFocus = null;
  var lookupActive = -1;   // keyboard-highlighted lookup result
  function setLookupActive(idx) {
    var items = document.querySelectorAll('.cpa-lookup-item');
    if (!items.length) { lookupActive = -1; return; }
    lookupActive = Math.max(0, Math.min(items.length - 1, idx));
    var inp = document.getElementById('cpa-lookup');
    Array.prototype.forEach.call(items, function (it, i) {
      var on = i === lookupActive;
      it.classList.toggle('is-active', on);
      it.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) { inp.setAttribute('aria-activedescendant', it.id); it.scrollIntoView({ block: 'nearest' }); }
    });
  }
  function onLookupKeydown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setLookupActive(lookupActive + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setLookupActive(lookupActive - 1); }
    else if (e.key === 'Enter') {
      var it = document.querySelectorAll('.cpa-lookup-item')[lookupActive];
      if (it) { e.preventDefault(); onLookupPick({ target: it }); }
    }
  }

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
        if (!contacts.length) { document.getElementById('cpa-lookup').setAttribute('aria-expanded', 'false'); box.innerHTML = '<div class="cpa-lookup-hint">No matches — you can still type the details below manually.</div>'; return; }
        document.getElementById('cpa-lookup').setAttribute('aria-expanded', 'true');
        lookupActive = -1;
        box.innerHTML = contacts.map(function (c, i) {
          var name = c.ct_NameFull || [c.NameFirst, c.NameLast].filter(Boolean).join(' ');
          var email = c.ContactNumbersEmail || '';
          // Surface the account owner/rep so a rep recognises their OWN live account
          // (the table is full of DEAD/House rows). 'DEAD' shown as a plain "inactive" flag.
          var owner = c.Account_Owner || c.CustomerCustomerServiceRep || '';
          var ownerTxt = owner ? (/^dead$/i.test(owner.trim()) ? 'inactive account' : owner) : '';
          return '<div class="cpa-lookup-item" role="option" aria-selected="false" id="cpa-lookup-opt-' + i + '" tabindex="-1" data-id="' + esc(c.id_Customer) + '" data-company="' + esc(c.CustomerCompanyName) + '" data-email="' + esc(email) + '">' +
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

  // ═══ Re-order Requests tab (Phase 4) ═══
  var REQ_API = '/api/crm-proxy/portal-reorder/requests';
  var requests = [];
  var reqFilter = '', reqStatusFilter = '', reqMyOnly = false;
  var STATUSES = ['New', 'In Progress', 'Quoted', 'Closed'];

  function switchTab(tab) {
    var isReq = tab === 'requests';
    document.getElementById('cpa-view-access').hidden = isReq;
    document.getElementById('cpa-view-requests').hidden = !isReq;
    Array.prototype.forEach.call(document.querySelectorAll('.cpa-tab'), function (b) {
      var on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('cpa-tab-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.title = (isReq ? 'Re-order Requests' : 'Portal Access') + ' - Northwest Custom Apparel';
    if (isReq) loadRequests();
  }

  async function loadRequests() {
    var root = document.getElementById('requests-root');
    root.className = 'dash-loading'; root.textContent = 'Loading…';
    try {
      var data = await api(REQ_API);
      requests = (data && data.rows) || [];
      requests.sort(function (a, b) { return String(b.Created || '').localeCompare(String(a.Created || '')); });
      updateReqBadge();
      renderRequests();
    } catch (err) {
      if (err.message === 'auth') return;
      DashPage.showError('Unable to load requests: ' + err.message);
      root.className = ''; root.innerHTML = '<div class="cpa-empty"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i>Could not load requests.<br><button type="button" class="cpa-btn cpa-btn-ghost cpa-btn-sm" id="cpa-retry-requests"><i class="fas fa-rotate-right" aria-hidden="true"></i> Retry</button></div>';
    }
  }

  function updateReqBadge() {
    var open = requests.filter(function (r) { return r.Status === 'New'; }).length;
    var b = document.getElementById('cpa-req-badge');
    b.textContent = open;
    b.hidden = open <= 0;
    b.setAttribute('aria-label', open + ' new request' + (open === 1 ? '' : 's'));
  }

  function reqFiltered() {
    var list = requests;
    if (reqMyOnly && me && me.repName) { var rn = me.repName.trim().toLowerCase(); list = list.filter(function (r) { return String(r.Rep || '').trim().toLowerCase() === rn; }); }
    if (reqStatusFilter) list = list.filter(function (r) { return r.Status === reqStatusFilter; });
    if (reqFilter) { var t = reqFilter.toLowerCase(); list = list.filter(function (r) { return [r.Company_Name, r.Style, r.Product_Title, r.Design_Number, r.Rep, r.Color].some(function (v) { return String(v || '').toLowerCase().indexOf(t) >= 0; }); }); }
    return list;
  }

  function renderRequests() {
    var root = document.getElementById('requests-root'); root.className = '';
    var rows = reqFiltered();
    document.getElementById('cpa-req-rowcount').textContent = rows.length + (rows.length === 1 ? ' request' : ' requests');
    if (!requests.length) { root.innerHTML = '<div class="cpa-empty"><i class="fas fa-cart-shopping" aria-hidden="true"></i>No re-order requests yet. They appear here when customers request from their portal.</div>'; return; }
    if (!rows.length) { root.innerHTML = '<div class="cpa-empty"><i class="fas fa-magnifying-glass" aria-hidden="true"></i>No requests match your filters.</div>'; return; }
    var body = rows.map(function (r) {
      var prod = r.Product_Title || r.Style;
      var sub = [r.Style, r.Color, (r.Qty ? 'qty ' + r.Qty : '')].filter(Boolean).join(' · ');
      var slug = String(r.Status || 'New').replace(/\s+/g, '-').toLowerCase();
      var opts = STATUSES.map(function (s) { return '<option' + (s === r.Status ? ' selected' : '') + '>' + s + '</option>'; }).join('');
      return '<tr>' +
        '<td><div class="cpa-company">' + (esc(r.Company_Name) || '—') + '</div><div class="cpa-email">' + esc(r.Email) + '</div></td>' +
        '<td><div class="cpa-req-prod">' + esc(prod) + '</div><div class="cpa-req-sub">' + esc(sub) + '</div>' + (r.Note ? '<div class="cpa-req-note">&ldquo;' + esc(r.Note) + '&rdquo;</div>' : '') + '</td>' +
        '<td class="cpa-hide-sm">' + (r.Design_Number ? '#' + esc(r.Design_Number) : '—') + '</td>' +
        '<td class="cpa-hide-sm cpa-rep">' + (esc(r.Rep) || '—') + '</td>' +
        '<td><select class="cpa-status-select cpa-status-' + slug + '" data-pk="' + esc(r.PK_ID) + '" aria-label="Status for ' + esc(r.Company_Name || r.Email) + '">' + opts + '</select></td>' +
        '<td class="cpa-hide-sm">' + fmtLastLogin(r.Created) + '</td>' +
        '<td><div class="cpa-actions"><button type="button" class="cpa-btn-icon cpa-danger" data-req-action="delete" data-pk="' + esc(r.PK_ID) + '" title="Delete request" aria-label="Delete request from ' + esc(r.Company_Name || r.Email) + '"><i class="fas fa-trash" aria-hidden="true"></i></button></div></td>' +
      '</tr>';
    }).join('');
    root.innerHTML = '<div class="cpa-table-scroll"><table class="cpa-table"><thead><tr><th>Customer</th><th>Product</th><th class="cpa-hide-sm">Design</th><th class="cpa-hide-sm">Rep</th><th>Status</th><th class="cpa-hide-sm">Requested</th><th class="cpa-th-right">Actions</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  async function onRequestsClick(e) {
    if (e.target.closest('#cpa-retry-requests')) { loadRequests(); return; }
    var del = e.target.closest('button[data-req-action="delete"]');
    if (!del) return;
    if (!window.confirm('Delete this re-order request?')) return;
    del.disabled = true;
    try { await api(REQ_API + '/' + encodeURIComponent(del.getAttribute('data-pk')), { method: 'DELETE' }); toast('Request deleted'); await loadRequests(); }
    catch (err) { if (err.message !== 'auth') { toast(err.message, true); del.disabled = false; } }
  }
  async function onRequestsChange(e) {
    var sel = e.target.closest('select.cpa-status-select');
    if (!sel) return;
    var pk = sel.getAttribute('data-pk'), status = sel.value;
    sel.disabled = true;
    try {
      await api(REQ_API + '/' + encodeURIComponent(pk), { method: 'PUT', body: JSON.stringify({ status: status }) });
      toast('Status → ' + status);
      var r = requests.find(function (x) { return String(x.PK_ID) === String(pk); });
      if (r) r.Status = status;
      updateReqBadge(); renderRequests();
    } catch (err) { if (err.message !== 'auth') toast(err.message, true); sel.disabled = false; }
  }

  // ═══ Reward dollars (Phase 5) ═══
  var REWARDS_LEDGER_API = '/api/crm-proxy/customer-rewards/ledger';
  var REWARDS_ENTRY_API = '/api/portal-admin/rewards/entry';
  var rwCustomer = null;

  function money2(n) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function openRewardsModal(id, company) {
    rwCustomer = { id: id, company: company || '' };
    document.getElementById('cpa-rw-title').textContent = 'Reward Dollars — ' + (company || ('#' + id));
    document.getElementById('cpa-rw-balance').textContent = '…';
    document.getElementById('cpa-rw-amount').value = '';
    document.getElementById('cpa-rw-reason').value = '';
    document.getElementById('cpa-rw-order').value = '';
    document.getElementById('cpa-rw-type').value = 'grant';
    document.getElementById('cpa-rw-error').textContent = '';
    document.getElementById('cpa-rw-ledger').innerHTML = 'Loading…';
    resetAccrualBox();
    rwLastFocus = document.activeElement;
    document.getElementById('cpa-rewards-modal').hidden = false;
    setTimeout(function () { document.getElementById('cpa-rw-amount').focus(); }, 50);
    loadRewardLedger();
  }
  var rwLastFocus = null;
  function closeRewardsModal() {
    var m = document.getElementById('cpa-rewards-modal');
    if (m.hidden) return;
    m.hidden = true;
    // The table re-renders while the modal is open (balances refresh), so the opener element is
    // usually detached by now — fall back to the same customer's chip/coins button in the new table.
    if (rwLastFocus && !document.contains(rwLastFocus) && rwCustomer) {
      rwLastFocus = document.querySelector('.cpa-rw-chip[data-id="' + rwCustomer.id + '"]') ||
        document.querySelector('button[data-action="rewards"][data-id="' + rwCustomer.id + '"]');
    }
    if (rwLastFocus && rwLastFocus.focus) rwLastFocus.focus();
  }

  async function loadRewardLedger() {
    loadRewardBalances();
    if (!rwCustomer) return;
    try {
      var data = await api(REWARDS_LEDGER_API + '/' + encodeURIComponent(rwCustomer.id));
      document.getElementById('cpa-rw-balance').textContent = money2(data.balance);
      var entries = (data && data.entries) || [];
      var el = document.getElementById('cpa-rw-ledger');
      if (!entries.length) { el.innerHTML = '<div class="cpa-rw-empty">No activity yet.</div>'; return; }
      el.innerHTML = entries.map(function (e) {
        var pos = Number(e.amount) >= 0;
        return '<div class="cpa-rw-entry">' +
          '<div class="cpa-rw-amt ' + (pos ? 'pos' : 'neg') + '">' + (pos ? '+' : '−') + money2(Math.abs(e.amount)) + '</div>' +
          '<div class="cpa-rw-mid"><div>' + (esc(e.reason) || esc(e.type)) + '</div><div class="cpa-rw-meta">' + esc(e.type) + (e.orderRef ? ' · order #' + esc(e.orderRef) : '') + (e.by ? ' · ' + esc(e.by) : '') + '</div></div>' +
          '<div class="cpa-rw-when">' + fmtLastLogin(e.created) + '</div>' +
        '</div>';
      }).join('');
    } catch (err) {
      if (err.message !== 'auth') document.getElementById('cpa-rw-ledger').innerHTML = '<div class="cpa-rw-empty">Could not load: ' + esc(err.message) + '</div>';
    }
  }

  async function submitRewardEntry() {
    if (!rwCustomer) return;
    var amount = parseFloat(document.getElementById('cpa-rw-amount').value);
    var type = document.getElementById('cpa-rw-type').value;
    var reason = document.getElementById('cpa-rw-reason').value.trim();
    var orderRef = document.getElementById('cpa-rw-order').value.trim();
    var err = document.getElementById('cpa-rw-error');
    err.textContent = '';
    if (!isFinite(amount) || amount === 0) { err.textContent = 'Enter a non-zero amount.'; return; }
    if (orderRef && !/^\d{3,10}$/.test(orderRef)) { err.textContent = 'Order # must be the numeric ShopWorks order number.'; return; }
    if (type === 'redeem' && !orderRef) { err.textContent = 'A redemption needs the ShopWorks order # it was applied to.'; return; }
    var saveBtn = document.getElementById('cpa-rw-save');
    saveBtn.disabled = true;
    try {
      var res = await api(REWARDS_ENTRY_API, { method: 'POST', body: JSON.stringify({ id_Customer: rwCustomer.id, company_name: rwCustomer.company, amount: amount, type: type, reason: reason, order_ref: orderRef }) });
      toast('Balance now ' + money2(res.balance));
      document.getElementById('cpa-rw-amount').value = '';
      document.getElementById('cpa-rw-reason').value = '';
      document.getElementById('cpa-rw-order').value = '';
      await loadRewardLedger();
    } catch (e2) {
      if (e2.message !== 'auth') err.textContent = e2.message;
    } finally { saveBtn.disabled = false; }
  }

  // ═══ Earned rewards — accrual calculator (Erik 2026-09-01) ═══
  // Reward $ from GARMENT lines on invoiced + paid orders inside the program window, rated by
  // SanMar piece-cost band. The server does every calculation; this only renders the breakdown
  // and asks the server to post the pending grants (one ledger entry per order, Order_Ref = #).
  var REWARDS_ACCRUAL_API = '/api/portal-admin/rewards/accrual';
  var rwAccrual = null;
  var ACCRUAL_IDLE_HTML = '<button class="cpa-btn cpa-btn-ghost cpa-btn-sm" id="cpa-rw-calc" type="button"><i class="fas fa-calculator" aria-hidden="true"></i> Calculate earned rewards</button>' +
    '<div class="cpa-rw-meta cpa-rw-acc-hint">Garment lines on invoiced <em>and</em> paid orders in the program window, rated by SanMar piece-cost band. Rates live in Caspio &rarr; Service_Codes (ServiceType <code>REWARD</code>, code <code>RWD-EARN</code>).</div>';
  function resetAccrualBox() {
    rwAccrual = null;
    var box = document.getElementById('cpa-rw-accrual'); if (box) box.innerHTML = ACCRUAL_IDLE_HTML;
    var w = document.getElementById('cpa-rw-acc-window'); if (w) w.textContent = '';
  }
  async function calcAccrual() {
    if (!rwCustomer) return;
    var box = document.getElementById('cpa-rw-accrual');
    box.innerHTML = '<div class="cpa-rw-empty"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Calculating from ManageOrders + catalog costs…</div>';
    try {
      // Each call fetches at most ~9 uncached orders (Heroku's 30 s limit) and says partial:true;
      // loop until complete, showing progress. The server caches what it fetched.
      var rounds = 0;
      do {
        rwAccrual = await api(REWARDS_ACCRUAL_API + '/' + encodeURIComponent(rwCustomer.id));
        if (rwAccrual.partial) box.innerHTML = '<div class="cpa-rw-empty"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Fetching order details… ' + esc(String(rwAccrual.progress.fetched)) + ' of ' + esc(String(rwAccrual.progress.total)) + ' orders</div>';
      } while (rwAccrual.partial && ++rounds < 40);
      renderAccrual();
    } catch (err) {
      if (err.message !== 'auth') box.innerHTML = '<div class="cpa-rw-empty">Could not calculate: ' + esc(err.message) + '</div><button class="cpa-btn cpa-btn-ghost cpa-btn-sm" id="cpa-rw-calc" type="button">Try again</button>';
    }
  }
  function renderAccrual() {
    var a = rwAccrual, box = document.getElementById('cpa-rw-accrual');
    document.getElementById('cpa-rw-acc-window').textContent = a.window ? ((a.program && a.program.name ? a.program.name + ' · ' : '') + a.window.from + ' → ' + a.window.to + (a.program && a.program.spend ? ' · spend ' + a.program.spend.from + ' → ' + a.program.spend.to : '')) : '';
    if (!a.program || !a.program.configured) {
      box.innerHTML = '<div class="cpa-rw-notconf"><strong>Reward program not configured.</strong> Add rows to Caspio &rarr; <code>Service_Codes</code>: ServiceType <code>REWARD</code>, ServiceCode <code>RWD-EARN</code>, PricingMethod <code>TIERED</code>, IsActive Yes, Visible No — one row per SanMar piece-cost band with TierLabel like <code>0-39.99</code> and <code>40+</code> and SellPrice = the % back. Optional <code>RWD-WINDOW</code> row with UnitCost = months (default 12). Nothing is granted until this exists.</div>' +
        '<div class="cpa-rw-acc-actions"><button class="cpa-btn cpa-btn-ghost cpa-btn-sm" id="cpa-rw-calc" type="button">Recalculate</button></div>';
      return;
    }
    var t = a.totals;
    var html = '<div class="cpa-rw-acc-sum">Earned <strong>' + money2(t.earned) + '</strong> on ' + money2(t.eligibleRevenue) + ' of eligible garments &middot; granted ' + money2(t.granted) + ' &middot; <strong class="' + (t.pending > 0 ? 'pos' : '') + '">pending ' + money2(t.pending) + '</strong>' +
      (t.redeemedOnOrders ? ' &middot; redeemed on orders ' + money2(t.redeemedOnOrders) + (t.redeemPending ? ' (<strong class="neg">' + money2(t.redeemPending) + ' not in ledger yet</strong>)' : '') : '') +
      (t.overGranted > 0.005 ? ' &middot; <strong class="neg">granted ' + money2(t.overGranted) + ' more than now earned</strong> (re-invoiced lower — reverse per order below, or leave it)' : '') +
      (a.program.boosts && a.program.boosts.length ? '<div class="cpa-rw-meta">Boost: ' + a.program.boosts.map(function (b) { return esc(b.label) + ' &times;' + esc(String(b.multiplier)); }).join(' &middot; ') + '</div>' : '') +
      '<div class="cpa-rw-meta">Bands: ' + a.program.tiers.map(function (x) { return esc(x.label) + ' &rarr; ' + esc(String(x.ratePct)) + '%'; }).join(' &middot; ') + ' &middot; ' + esc(String(a.program.months)) + '-month window' + (a.unavailable && a.unavailable.length ? ' &middot; <span class="neg">' + a.unavailable.length + ' order(s) still missing line items — recalculate</span>' : '') +
      (a.excludedWebstore && a.excludedWebstore.count ? ' &middot; ' + esc(String(a.excludedWebstore.count)) + ' web-store order(s) (' + money2(a.excludedWebstore.revenue) + ') excluded' : '') +
      (a.source ? ' &middot; lines from Caspio mirror ' + esc(String(a.source.mirrored)) + ', ManageOrders ' + esc(String(a.source.manageOrders)) : '') + '</div></div>';
    if (!a.orders.length) html += '<div class="cpa-rw-empty">No invoiced + paid orders in the window.</div>';
    else html += '<table class="cpa-rw-acc-table"><thead><tr><th>Order</th><th>Invoiced</th><th class="num">Eligible</th><th class="num">Reward</th><th class="num">Granted</th><th class="num">Pending</th></tr></thead><tbody>' + a.orders.map(function (o) {
      var lines = (o.lines || []).map(function (l) {
        return esc(l.style) + ' ' + esc(l.color) + ' &times;' + esc(String(l.qty)) + ' @ ' + money2(l.unitPrice) + (l.cost != null ? ' &middot; cost ' + money2(l.cost) : '') + (l.tier ? ' &middot; ' + esc(l.tier) + ' ' + esc(String(l.ratePct)) + '% = <strong>' + money2(l.reward) + '</strong>' : ' &middot; ' + esc(l.note || 'no reward'));
      }).join('<br>');
      var extra = (o.boost ? ' <span class="cpa-rw-meta">&times;' + esc(String(o.boost.multiplier)) + ' boost</span>' : '') +
        (o.redemption ? ' <span class="cpa-rw-meta neg">redeemed ' + money2(o.redemption.onOrder) + (o.redemption.pending ? ' (unposted)' : '') + '</span>' : '');
      return '<tr><td><details><summary>#' + esc(o.orderNumber) + (o.designName ? ' <span class="cpa-rw-meta">' + esc(o.designName) + '</span>' : '') + extra + '</summary><div class="cpa-rw-acc-lines">' + (o.linesUnavailable ? 'Line items unavailable — recalculate.' : (lines || 'No garment lines (decoration / fees only).')) + '</div></details></td>' +
        '<td>' + esc(String(o.invoiceDate || '').slice(0, 10)) + '</td><td class="num">' + money2(o.eligibleRevenue) + '</td><td class="num">' + money2(o.reward) + '</td><td class="num">' + money2(o.granted) + '</td><td class="num' + (o.pending > 0 ? ' pos' : '') + '">' + money2(o.pending) +
        (o.overGranted > 0.005 ? '<div class="cpa-rw-meta neg">over by ' + money2(o.overGranted) + '</div><button class="cpa-btn cpa-btn-ghost cpa-btn-sm cpa-rw-reverse" type="button" data-order="' + esc(String(o.orderNumber)) + '" data-amount="' + esc(String(o.overGranted)) + '" title="Post an adjustment of up to −' + money2(o.overGranted) + ' (never below the unspent balance)"><i class="fas fa-undo" aria-hidden="true"></i> Reverse</button>' : '') +
        '</td></tr>';
    }).join('') + '</tbody></table>';
    var n = a.orders.filter(function (o) { return o.pending > 0 && !o.linesUnavailable; }).length;
    var nr = a.orders.filter(function (o) { return o.redemption && o.redemption.pending > 0 && !o.linesUnavailable; }).length;
    html += '<div class="cpa-rw-acc-actions">' +
      ((n || nr) ? '<button class="cpa-btn cpa-btn-primary cpa-btn-sm" id="cpa-rw-post" type="button"><i class="fas fa-coins" aria-hidden="true"></i> Post ' + (n ? money2(t.pending) + ' as ' + n + ' grant' + (n === 1 ? '' : 's') : '') + (n && nr ? ' + ' : '') + (nr ? nr + ' redemption' + (nr === 1 ? '' : 's') + ' (' + money2(t.redeemPending) + ')' : '') + '</button>' : '<span class="cpa-rw-meta">Nothing pending — grants and redemptions are all in the ledger.</span>') +
      ' <button class="cpa-btn cpa-btn-ghost cpa-btn-sm" id="cpa-rw-calc" type="button">Recalculate</button>' +
      (a.program && a.program.spend && new Date().toISOString().slice(0, 10) > a.program.spend.to && t.ledgerBalance > 0.005
        ? ' <button class="cpa-btn cpa-btn-ghost cpa-btn-sm" id="cpa-rw-expire" type="button" title="Spend window closed ' + esc(a.program.spend.to) + '"><i class="fas fa-hourglass-end" aria-hidden="true"></i> Expire unused ' + money2(t.ledgerBalance) + '</button>'
        : '') + '</div>';
    box.innerHTML = html;
  }
  async function expireAccrual() {
    if (!rwCustomer || !rwAccrual || !rwAccrual.program) return;
    if (!window.confirm('Remove the unused ' + money2(rwAccrual.totals.ledgerBalance) + ' balance for ' + (rwCustomer.company || '#' + rwCustomer.id) + '? (' + rwAccrual.program.name + ' expired ' + rwAccrual.program.spend.to + ')')) return;
    try {
      var res = await api(REWARDS_ACCRUAL_API.replace('/accrual', '/expire') + '/' + encodeURIComponent(rwCustomer.id), { method: 'POST', body: JSON.stringify({ company_name: rwCustomer.company }) });
      toast('Expired ' + money2(res.expired) + ' — balance now ' + money2(res.balance));
      await loadRewardLedger(); await calcAccrual();
    } catch (e) { if (e.message !== 'auth') toast(e.message, true); }
  }
  async function reverseAccrual(orderNo, over) {
    if (!rwCustomer || !rwAccrual) return;
    if (!window.confirm('Reverse up to ' + money2(over) + ' granted on order #' + orderNo + ' for ' + (rwCustomer.company || '#' + rwCustomer.id) + '?\n\nThe order now earns less than it was granted (re-invoiced lower). Only the unspent balance can be taken back; dollars already redeemed stay redeemed.')) return;
    try {
      var res = await api(REWARDS_ACCRUAL_API + '/' + encodeURIComponent(rwCustomer.id) + '/reverse', { method: 'POST', body: JSON.stringify({ orderNumber: orderNo, company_name: rwCustomer.company }) });
      toast('Reversed ' + money2(res.reversed) + ' on #' + orderNo + (res.reversed + 0.005 < res.overGranted ? ' (' + money2(res.overGranted - res.reversed) + ' was already redeemed)' : '') + ' — balance now ' + money2(res.balance));
      await loadRewardLedger(); await calcAccrual();
    } catch (e) { if (e.message !== 'auth') toast(e.message, true); }
  }
  async function postAccrual() {
    if (!rwCustomer || !rwAccrual) return;
    var btn = document.getElementById('cpa-rw-post'); if (btn) { btn.disabled = true; btn.textContent = 'Posting…'; }
    try {
      var res = await api(REWARDS_ACCRUAL_API + '/' + encodeURIComponent(rwCustomer.id) + '/post', { method: 'POST', body: JSON.stringify({ company_name: rwCustomer.company }) });
      toast('Posted ' + res.posted.length + ' grant' + (res.posted.length === 1 ? '' : 's') + ' (' + money2(res.total) + ')' + (res.redeemed && res.redeemed.length ? ' + ' + res.redeemed.length + ' redemption' + (res.redeemed.length === 1 ? '' : 's') + ' (' + money2(res.redeemTotal) + ')' : '') + (res.failed && res.failed.length ? ' — ' + res.failed.length + ' failed: ' + esc(res.failed.map(function (f) { return '#' + f.orderNumber + ' ' + f.error; }).join('; ')) : ''), !!(res.failed && res.failed.length));
      await loadRewardLedger();
      await calcAccrual();
    } catch (e) { if (e.message !== 'auth') toast(e.message, true); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-coins" aria-hidden="true"></i> Post pending grants'; } }
  }

  // ---- wire up ----
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('content-root').addEventListener('click', onTableClick);
    document.getElementById('cpa-filter').addEventListener('input', function (e) { filterTerm = e.target.value.trim(); renderTable(); });
    document.getElementById('cpa-mine-btn').addEventListener('click', function () {
      myOnly = !myOnly;
      this.classList.toggle('cpa-btn-active', myOnly);
      this.setAttribute('aria-pressed', myOnly ? 'true' : 'false');
      renderTable();
    });
    document.getElementById('cpa-add-btn').addEventListener('click', openModal);
    document.getElementById('cpa-modal-close').addEventListener('click', closeModal);
    document.getElementById('cpa-cancel').addEventListener('click', closeModal);
    document.getElementById('cpa-modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    document.getElementById('cpa-lookup').addEventListener('input', onLookupInput);
    document.getElementById('cpa-lookup').addEventListener('keydown', onLookupKeydown);
    document.getElementById('cpa-lookup-results').addEventListener('click', onLookupPick);
    document.getElementById('cpa-save').addEventListener('click', saveInvite);
    // Tabs + Re-order Requests view
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.cpa-tab'));
    tabs.forEach(function (b, i) {
      b.addEventListener('click', function () { switchTab(b.getAttribute('data-tab')); });
      b.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        n.focus(); switchTab(n.getAttribute('data-tab'));
      });
    });
    document.getElementById('cpa-req-filter').addEventListener('input', function (e) { reqFilter = e.target.value.trim(); renderRequests(); });
    document.getElementById('cpa-req-status').addEventListener('change', function (e) { reqStatusFilter = e.target.value; renderRequests(); });
    document.getElementById('cpa-req-mine-btn').addEventListener('click', function () { reqMyOnly = !reqMyOnly; this.classList.toggle('cpa-btn-active', reqMyOnly); this.setAttribute('aria-pressed', reqMyOnly ? 'true' : 'false'); renderRequests(); });
    document.getElementById('requests-root').addEventListener('click', onRequestsClick);
    document.getElementById('requests-root').addEventListener('change', onRequestsChange);
    // Reward dollars modal
    document.getElementById('cpa-rw-close').addEventListener('click', closeRewardsModal);
    document.getElementById('cpa-rewards-modal').addEventListener('click', function (e) { if (e.target === this) closeRewardsModal(); });
    document.getElementById('cpa-rw-save').addEventListener('click', submitRewardEntry);
    document.getElementById('cpa-rw-accrual').addEventListener('click', function (e) {
      if (e.target.closest('#cpa-rw-calc')) calcAccrual();
      else if (e.target.closest('#cpa-rw-post')) postAccrual();
      else if (e.target.closest('#cpa-rw-expire')) expireAccrual();
      else if (e.target.closest('.cpa-rw-reverse')) { var rb = e.target.closest('.cpa-rw-reverse'); reverseAccrual(rb.getAttribute('data-order'), Number(rb.getAttribute('data-amount')) || 0); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('cpa-rewards-modal').hidden) closeRewardsModal();
      else closeModal();
    });
    loadMe();
    loadInvites();
    loadRequests(); // populate the "New" badge on the Requests tab
  });
})();
