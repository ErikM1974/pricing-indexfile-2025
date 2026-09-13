'use strict';

// Pure response templates. Authorization and HTTP status remain in each caller.
// Semantic HTML and ordinary links remain usable if the stylesheets fail.
function escapeText(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function shell(title, content, { restricted = false, retired = false } = {}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${retired ? '<meta name="robots" content="noindex, nofollow">' : ''}
<title>${escapeText(title)}</title>
<link rel="stylesheet" href="/shared_components/css/tokens.css?v=2026.09.12.2">
<link rel="stylesheet" href="/shared_components/css/components.css?v=2026.09.12.2">
<link rel="stylesheet" href="/shared_components/css/status-pages.css?v=2026.09.12.2">
</head>
<body data-ui="unified" class="status-page${retired ? ' status-page--retired' : ''}">
<main class="status-card">
${restricted ? `<img class="status-logo" src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png" alt="Northwest Custom Apparel">
<div class="status-icon" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div>` : ''}
${content}
</main></body></html>`;
}

function roleDenied(firstName) {
  return shell('Access Denied', `
<h1>Access Denied</h1>
<p>You don't have permission to view this dashboard, ${escapeText(firstName || 'User')}.</p>
<a class="btn btn-primary" href="/staff-dashboard.html">Return to Staff Dashboard</a>`);
}

function restricted(firstName) {
  const greeting = firstName ? `Sorry, ${escapeText(firstName)} — this` : 'This';
  return shell('Access Restricted — Northwest Custom Apparel', `
<h1>Access Restricted</h1>
<p>${greeting} page is restricted, and your account doesn’t have access to it.</p>
<p class="status-help">If you need access, please ask <strong>Erik</strong>.</p>
<a class="btn btn-primary" href="/staff-dashboard.html">← Back to Dashboard</a>`, { restricted: true });
}

function retiredStickers() {
  return shell('This page moved', `
<h1>The sticker &amp; banner quote page was retired</h1>
<p>Its three sections each have a better home now:</p>
<ul>
  <li><a href="/custom-stickers">Sticker pricing (2&times;2 &ndash; 6&times;6)</a> &mdash; the customer page, same prices</li>
  <li><a href="/custom-banners">Banner pricing</a> &mdash; the customer page</li>
  <li><a href="/pricing/decals">Custom &amp; oversize decals</a> &mdash; staff calculator</li>
</ul>
<p><a class="btn btn-primary" href="/staff-dashboard.html">Back to the dashboard</a></p>`, { retired: true });
}

module.exports = { roleDenied, restricted, retiredStickers };
