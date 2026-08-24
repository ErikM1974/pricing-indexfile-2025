/*
 * Drive Access Center — renders the file-server drive map for admins.
 *
 * 🔴 THE DATA IS NOT IN THIS FILE, AND MUST NOT BE.
 * /dashboards gates *.html only (server.js — `if (!p.endsWith('.html')) return next()`),
 * so this .js and its .css are served anonymously to anyone who guesses the URL. Verified
 * live: /dashboards/js/past-due-orders.js returns 200 with no session. UNC paths, share
 * names and the file-admin account names therefore live behind
 * GET /api/staff/drive-access, gated with requirePageAccess('drive-access.html') — the
 * house rule that ONE Caspio Staff_Page_Access row governs both the page and its data.
 *
 * Read-only by design. No control here changes a mapping, an ACL or an account.
 */
(() => {
  'use strict';

  const grid = document.getElementById('da-grid');
  const search = document.getElementById('da-search');
  const status = document.getElementById('da-status');
  const countEl = document.getElementById('da-count');
  const tabs = [...document.querySelectorAll('[data-view]')];

  let snapshot = null;
  let activeView = 'people';

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const arr = (v) => (Array.isArray(v) ? v : []);

  function fail(message) {
    status.className = 'da-status is-error';
    status.textContent = message;
    grid.innerHTML = '<div class="da-empty">No access data loaded.</div>';
    countEl.textContent = '';
  }

  const driveList = (letters) => (letters.length
    ? letters.map((l) => `<span class="da-drive">${esc(l)}:</span>`).join('')
    : '<span class="da-none">No DATA drives</span>');

  const chips = (items, kind, suffix) => (arr(items).length
    ? `<div class="da-chips">${arr(items)
        .map((i) => `<span class="da-chip da-chip--${kind}">${esc(i)}${suffix || ''}</span>`).join('')}</div>`
    : '<span class="da-none">None recorded</span>');

  const rights = (o, suffix) => [
    arr(o.modify).length ? `<div class="da-section"><p class="da-section-title">Modify</p>${chips(o.modify, 'modify', suffix)}</div>` : '',
    arr(o.readOnly).length ? `<div class="da-section"><p class="da-section-title">Read only</p>${chips(o.readOnly, 'read', suffix)}</div>` : '',
    arr(o.fullControl).length ? `<div class="da-section"><p class="da-section-title">Full control</p>${chips(o.fullControl, 'full', suffix)}</div>` : '',
  ].join('');

  function peopleCard(p) {
    // A group whose members hold DIFFERENT rights is broken out per person. Rolled up,
    // the design-library card claimed Modify AND Read only on the same two drives.
    const perPerson = p.perPerson && Object.keys(p.perPerson).length
      ? Object.keys(p.perPerson).map((name) => {
        const r = rights(p.perPerson[name], ':');
        return `<div class="da-person"><p class="da-person-name">${esc(name)}</p>${r || '<span class="da-none">None recorded</span>'}</div>`;
      }).join('')
      : '';

    return `<article class="da-card${p.retired ? ' da-card--retired' : ''}">
      <div class="da-card-head"><div>
        <h3>${esc(arr(p.names).join(', '))}${p.retired ? ' — RETIRED' : ''}</h3>
        <p class="da-purpose">${esc(p.purpose)}</p>
      </div></div>
      <div class="da-section"><p class="da-section-title">Mapped drives</p>${driveList(arr(p.drives))}</div>
      ${perPerson || rights(p, ':')}
      ${p.notes ? `<p class="da-note">${esc(p.notes)}</p>` : ''}
    </article>`;
  }

  function driveCard(d) {
    const retired = arr(d.mappedFor).some((n) => isRetiredName(n));
    return `<article class="da-card${retired ? ' da-card--retired' : ''}">
      <div class="da-card-head">
        <div><h3>${esc(d.label)}</h3><p class="da-purpose">Network drive</p></div>
        <span class="da-drive da-drive--large">${esc(d.letter)}:</span>
      </div>
      <div class="da-section"><p class="da-section-title">Mapped automatically for</p>${chips(d.mappedFor, 'full')}</div>
      ${rights(d, '')}
      <p class="da-path">${esc(d.path)}</p>
      ${d.notes ? `<p class="da-note">${esc(d.notes)}</p>` : ''}
    </article>`;
  }

  function isRetiredName(name) {
    return snapshot.profiles.some((p) => p.retired && arr(p.names)
      .some((n) => String(n).toLowerCase() === String(name).toLowerCase()));
  }

  function render() {
    if (!snapshot) return;
    const q = search.value.trim().toLowerCase();
    const source = activeView === 'people' ? snapshot.profiles : snapshot.drives;
    const filtered = source.filter((item) => !q || JSON.stringify(item).toLowerCase().includes(q));
    grid.innerHTML = filtered.length
      ? filtered.map(activeView === 'people' ? peopleCard : driveCard).join('')
      : '<div class="da-empty">No matching people or drives. Try a different search.</div>';
    countEl.textContent = `${filtered.length} ${activeView === 'people' ? 'profile group' : 'drive'}${filtered.length === 1 ? '' : 's'} shown`;
  }

  function renderHeader() {
    const fmt = (d) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ''));
      if (!m) return String(d || '—');
      return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    };
    document.getElementById('da-server').textContent = snapshot.server || '—';
    document.getElementById('da-policy').textContent = snapshot.policy || '—';
    document.getElementById('da-verified').textContent = fmt(snapshot.verifiedAt);
    document.getElementById('da-default-login').textContent =
      String(snapshot.defaultProductionLogin || '—').toUpperCase();

    // Every figure is derived. A hand-typed count drifts the moment the snapshot changes,
    // and a stale "1 account action flag" beside two retired logins is worse than none.
    const audited = snapshot.drives.filter((d) =>
      arr(d.modify).length || arr(d.readOnly).length || arr(d.fullControl).length);
    const production = snapshot.profiles.find((p) => p.id === 'production-art');
    const retired = snapshot.profiles.filter((p) => p.retired);
    const stats = [
      [snapshot.drives.length, 'managed drive letters'],
      [audited.length, 'audited folders'],
      [arr(production && production.drives).length, 'production equipment drives'],
      [retired.length, `account action flag${retired.length === 1 ? '' : 's'}`],
    ];
    document.getElementById('da-stats').innerHTML = stats
      .map(([n, label]) => `<div class="da-stat"><b>${n}</b><span>${esc(label)}</span></div>`).join('');

    document.getElementById('da-alerts').innerHTML = retired.map((p) => `
      <div class="da-alert" role="alert">
        <span class="da-alert-mark" aria-hidden="true">!</span>
        <div><strong>Action needed: retired ${esc(arr(p.names).join(', '))} login</strong>
        <p>${esc(p.notes)}</p></div>
      </div>`).join('');
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => {
    activeView = tab.dataset.view;
    tabs.forEach((b) => b.setAttribute('aria-pressed', String(b === tab)));
    render();
  }));
  search.addEventListener('input', render);
  document.querySelector('[data-print]').addEventListener('click', () => window.print());

  (async () => {
    let r;
    try {
      r = await fetch('/api/staff/drive-access', { credentials: 'same-origin' });
    } catch (e) {
      return fail('Could not reach the server to load the drive map. Check your connection and refresh. (' + e.message + ')');
    }
    if (r.status === 401) return fail('Your session has expired. Please sign in again and reload this page.');
    if (r.status === 403) return fail('Your account does not have access to the drive map. Ask Erik if you need it.');
    if (!r.ok) return fail('The drive map could not be loaded (HTTP ' + r.status + '). Nothing below is current — please refresh or tell Erik.');
    try {
      snapshot = await r.json();
    } catch (e) {
      return fail('The drive map came back unreadable. Please refresh, and tell Erik if it keeps happening.');
    }
    if (!snapshot || !Array.isArray(snapshot.profiles) || !Array.isArray(snapshot.drives)) {
      return fail('The drive map came back in an unexpected shape. Nothing is being shown rather than showing a partial map.');
    }
    status.className = 'da-status';
    status.textContent = '';
    search.disabled = false;
    renderHeader();
    render();
  })();
})();
