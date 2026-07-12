/**
 * lib/product-seo.js — server-side SEO head for product.html + the product
 * sitemap (routes live in server.js, same hybrid-SSR pattern as the blog).
 *
 * Problem it solves: product.html is client-rendered, so every one of the
 * ~569 product URLs served the SAME generic <title>/meta and ZERO mentions
 * of the product in raw HTML — invisible to search engines. This module
 * injects a per-product title, meta description, canonical (color variants
 * canonicalize to the base style), Open Graph tags, and Product JSON-LD
 * into the EXISTING static file before it leaves the server. The client JS
 * then runs unchanged — zero visual difference.
 *
 * Pricing rule: JSON-LD deliberately carries NO offers/price. Real pricing
 * is decorated pricing from the engine; a stale blank-garment price in
 * schema would be a public wrong price (CLAUDE.md rule #4/#9 territory).
 *
 * Fail-open everywhere: any fetch/parse hiccup serves the untouched static
 * file — SEO must never take the product page down.
 */
'use strict';

const fetch = require('node-fetch');

const CASPIO_PROXY_BASE = process.env.CASPIO_PROXY_BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const SITE = 'https://www.teamnwca.com';
const BRAND_SUFFIX = ' | Northwest Custom Apparel';
const HEAD_TTL_MS = 10 * 60 * 1000;   // per-style head cache
const STYLES_TTL_MS = 6 * 60 * 60 * 1000; // sitemap style list

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const headCache = new Map(); // STYLE → { at, head|null }
let stylesCache = { at: 0, styles: null };

function cleanText(s, max) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .replace(/\s+\S*$/, (m) => (m.length > 20 ? '' : m)); // avoid chopping mid-word badly
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

// ---------- per-product head ----------

async function headForStyle(styleRaw) {
  const style = String(styleRaw || '').trim().toUpperCase().slice(0, 40);
  if (!/^[A-Z0-9._/-]{2,40}$/.test(style)) return null;

  const hit = headCache.get(style);
  if (hit) {
    // successful heads live 10 min; misses retry after 60s (a cold proxy or
    // Caspio blip must not pin a style to the generic head for long)
    const ttl = hit.head ? HEAD_TTL_MS : 60 * 1000;
    if (Date.now() - hit.at < ttl) return hit.head;
  }

  let head = null;
  try {
    const rows = await fetchJson(
      `${CASPIO_PROXY_BASE}/api/product-details?styleNumber=${encodeURIComponent(style)}`, 2500);
    if (Array.isArray(rows) && rows.length) head = buildHead(style, rows[0]);
  } catch (e) {
    console.error(`[product-seo] head fetch failed for ${style}:`, e.message);
  }
  headCache.set(style, { at: Date.now(), head });
  if (headCache.size > 1500) headCache.clear(); // crude but sufficient bound
  return head;
}

function buildHead(style, r) {
  const brand = String(r.BRAND_NAME || '').trim();
  let name = String(r.PRODUCT_TITLE || '').trim() || style;
  // SanMar titles end with ". STYLE" (e.g. "…Safety Vest. CSV405") — strip it
  // so the composed title doesn't say the style twice
  const styleTail = new RegExp(`[.\\s]*${style.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
  name = name.replace(styleTail, '').trim().replace(/[.,\s]+$/, '');
  if (!name) name = style;
  if (brand && !name.toLowerCase().startsWith(brand.slice(0, 6).toLowerCase())) {
    name = `${brand} ${name}`;
  }
  const title = `${name} (${style}) — Custom Embroidery & Printing${BRAND_SUFFIX}`;
  const descBody = cleanText(r.PRODUCT_DESCRIPTION, 110);
  const description = `${descBody ? descBody + ' — ' : ''}decorated in-house by Northwest Custom Apparel in Milton, WA: embroidery, screen printing, DTG & DTF.`;
  const image = String(r.FRONT_MODEL || r.PRODUCT_IMAGE || '').trim();
  const canonical = `${SITE}/product.html?style=${encodeURIComponent(style)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `Custom ${name}`,
    sku: style,
    brand: brand ? { '@type': 'Brand', name: brand } : undefined,
    image: image || undefined,
    description,
    url: canonical,
  };

  return { title, description, image, canonical, jsonLd };
}

// Swap the static head for the per-product one. Marker strings must match
// product.html EXACTLY — if the file's head is edited, update these.
function injectHead(html, head) {
  let out = html;
  out = out.replace(
    '<title>Product Details | Northwest Custom Apparel</title>',
    `<title>${esc(head.title)}</title>`);
  out = out.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${esc(head.description)}">`);
  out = out.replace(
    /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${esc(head.title)}">`);
  out = out.replace(
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${esc(head.description)}">`);
  if (head.image) {
    out = out.replace(
      /<meta property="og:image" content="[^"]*">/,
      `<meta property="og:image" content="${esc(head.image)}">`);
  }
  out = out.replace(
    /<link rel="canonical" id="canonicalLink" href="[^"]*">/,
    `<link rel="canonical" id="canonicalLink" href="${esc(head.canonical)}">`);
  out = out.replace(
    '</head>',
    `    <script type="application/ld+json">${JSON.stringify(head.jsonLd)}</script>\n</head>`);
  return out;
}

// ---------- sitemap ----------

async function listStyles() {
  if (stylesCache.styles && Date.now() - stylesCache.at < STYLES_TTL_MS) return stylesCache.styles;
  const body = await fetchJson(`${CASPIO_PROXY_BASE}/api/all-styles`, 20000);
  const styles = (body.styles || []).filter((s) => /^[A-Za-z0-9._/-]{2,40}$/.test(s.style));
  stylesCache = { at: Date.now(), styles };
  return styles;
}

function renderProductSitemap(styles) {
  const urls = styles.map((s) =>
    `  <url><loc>${SITE}/product.html?style=${encodeURIComponent(s.style)}</loc><changefreq>weekly</changefreq></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

module.exports = { headForStyle, injectHead, listStyles, renderProductSitemap };
