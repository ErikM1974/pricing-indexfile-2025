/* Access Admin — Erik-only control panel for staff RBAC.
 * Reads/writes the two Caspio tables via same-origin, admin-gated crm-proxy routes:
 *   /api/crm-proxy/admin-rbac/roles   (Staff_App_Roles)
 *   /api/crm-proxy/admin-rbac/pages   (Staff_Page_Access)
 * The browser sends the staff session cookie; the server adds the CRM secret + checks
 * the admin role. No inline script (CLAUDE.md). */
(function () {
  'use strict';
  var API = '/api/crm-proxy/admin-rbac';
  var ROLES = ['admin', 'accountant', 'sales', 'art', 'shipping', 'production', 'staff'];

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function status(msg, kind) {
    var s = el('aa-status');
    s.textContent = msg || '';
    s.className = 'aa-status' + (msg ? ' is-' + (kind || 'info') : '');
    if (msg && kind !== 'error') { setTimeout(function () { if (s.textContent === msg) { s.textContent = ''; s.className = 'aa-status'; } }, 3500); }
  }
  async function api(path, opts) {
    var r = await fetch(API + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
    return data;
  }
  function roleSelect(current) {
    var o = ROLES.map(function (r) { return '<option value="' + r + '"' + (r === current ? ' selected' : '') + '>' + r + '</option>'; }).join('');
    return o;
  }

  // ---------- Roles ----------
  async function loadRoles() {
    var body = el('roles-body');
    try {
      var data = await api('/roles');
      var rows = (data.rows || []).slice().sort(function (a, b) { return (a.Email || '').localeCompare(b.Email || ''); });
      if (!rows.length) { body.innerHTML = '<tr><td colspan="3" class="aa-loading">No roles yet.</td></tr>'; return; }
      body.innerHTML = rows.map(function (row) {
        var email = esc(row.Email);
        return '<tr data-email="' + email + '">' +
          '<td>' + email + '</td>' +
          '<td><select class="aa-role-sel">' + roleSelect((row.Role || '').toLowerCase()) + '</select></td>' +
          '<td class="aa-actions"><button type="button" class="aa-btn aa-save-role">Save</button> ' +
          '<button type="button" class="aa-btn aa-ghost aa-del-role">Remove</button></td></tr>';
      }).join('');
    } catch (e) { body.innerHTML = '<tr><td colspan="3" class="aa-err">Failed to load: ' + esc(e.message) + '</td></tr>'; }
  }
  async function saveRole(email, role) {
    status('Saving ' + email + '…');
    await api('/roles', { method: 'PUT', body: JSON.stringify({ email: email, role: role }) });
    status('Saved ' + email + ' → ' + role, 'ok');
  }
  async function delRole(email) {
    if (!window.confirm('Remove the role for ' + email + '? They drop to basic access.')) return;
    status('Removing ' + email + '…');
    await api('/roles?email=' + encodeURIComponent(email), { method: 'DELETE' });
    status('Removed ' + email, 'ok'); loadRoles();
  }

  // ---------- Pages ----------
  async function loadPages() {
    var body = el('pages-body');
    try {
      var data = await api('/pages');
      var rows = (data.rows || []).slice().sort(function (a, b) { return (a.Page || '').localeCompare(b.Page || ''); });
      if (!rows.length) { body.innerHTML = '<tr><td colspan="5" class="aa-loading">No restricted pages — everything is open to all staff.</td></tr>'; return; }
      body.innerHTML = rows.map(function (row) {
        var page = esc(row.Page);
        return '<tr data-page="' + page + '">' +
          '<td class="aa-page">' + page + '</td>' +
          '<td><input class="aa-roles-in" type="text" value="' + esc(row.Allowed_Roles) + '" placeholder="admin,accountant"></td>' +
          '<td><input class="aa-emails-in" type="text" value="' + esc(row.Allowed_Emails) + '" placeholder="bradley@…"></td>' +
          '<td><input class="aa-desc-in" type="text" value="' + esc(row.Description) + '" placeholder="note"></td>' +
          '<td class="aa-actions"><button type="button" class="aa-btn aa-save-page">Save</button> ' +
          '<button type="button" class="aa-btn aa-ghost aa-del-page">Remove</button></td></tr>';
      }).join('');
    } catch (e) { body.innerHTML = '<tr><td colspan="5" class="aa-err">Failed to load: ' + esc(e.message) + '</td></tr>'; }
  }
  async function savePage(page, roles, emails, desc) {
    status('Saving ' + page + '…');
    await api('/pages', { method: 'PUT', body: JSON.stringify({ page: page, allowedRoles: roles, allowedEmails: emails, description: desc }) });
    status('Saved ' + page, 'ok');
  }
  async function delPage(page) {
    if (!window.confirm('Remove the restriction on ' + page + '? It becomes visible to all staff.')) return;
    status('Removing ' + page + '…');
    await api('/pages?page=' + encodeURIComponent(page), { method: 'DELETE' });
    status('Removed restriction on ' + page, 'ok'); loadPages();
  }

  // ---------- Wire up ----------
  function init() {
    // populate the add-role dropdown
    el('new-role-role').innerHTML = roleSelect('staff');

    // tabs
    Array.prototype.forEach.call(document.querySelectorAll('.aa-tab'), function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.aa-tab').forEach(function (x) { x.classList.remove('is-active'); });
        document.querySelectorAll('.aa-panel').forEach(function (x) { x.classList.remove('is-active'); });
        t.classList.add('is-active');
        el('panel-' + t.dataset.panel).classList.add('is-active');
      });
    });

    // roles table (event delegation)
    el('roles-body').addEventListener('click', function (ev) {
      var tr = ev.target.closest('tr'); if (!tr) return;
      var email = tr.dataset.email;
      if (ev.target.classList.contains('aa-save-role')) {
        saveRole(email, tr.querySelector('.aa-role-sel').value).catch(function (e) { status('Error: ' + e.message, 'error'); });
      } else if (ev.target.classList.contains('aa-del-role')) {
        delRole(email).catch(function (e) { status('Error: ' + e.message, 'error'); });
      }
    });
    el('add-role-btn').addEventListener('click', function () {
      var email = el('new-role-email').value.trim();
      if (!email) { status('Enter an email', 'error'); return; }
      saveRole(email, el('new-role-role').value).then(function () { el('new-role-email').value = ''; loadRoles(); }).catch(function (e) { status('Error: ' + e.message, 'error'); });
    });

    // pages table
    el('pages-body').addEventListener('click', function (ev) {
      var tr = ev.target.closest('tr'); if (!tr) return;
      var page = tr.dataset.page;
      if (ev.target.classList.contains('aa-save-page')) {
        savePage(page, tr.querySelector('.aa-roles-in').value, tr.querySelector('.aa-emails-in').value, tr.querySelector('.aa-desc-in').value).catch(function (e) { status('Error: ' + e.message, 'error'); });
      } else if (ev.target.classList.contains('aa-del-page')) {
        delPage(page).catch(function (e) { status('Error: ' + e.message, 'error'); });
      }
    });
    el('add-page-btn').addEventListener('click', function () {
      var page = el('new-page-name').value.trim();
      if (!page) { status('Enter a page filename (e.g. some-dashboard.html)', 'error'); return; }
      savePage(page, el('new-page-roles').value, el('new-page-emails').value, el('new-page-desc').value)
        .then(function () { el('new-page-name').value = ''; el('new-page-roles').value = ''; el('new-page-emails').value = ''; el('new-page-desc').value = ''; loadPages(); })
        .catch(function (e) { status('Error: ' + e.message, 'error'); });
    });

    loadRoles();
    loadPages();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
