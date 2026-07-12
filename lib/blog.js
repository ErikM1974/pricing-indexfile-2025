/**
 * lib/blog.js — data + markdown layer behind the server-rendered blog
 * (/blog, /blog/:slug, feed, sitemap — routes live in server.js).
 *
 * Posts come from the proxy's public /api/blog-posts (Caspio Blog_Posts) with
 * a 5-minute in-memory cache: Erik publishes in the Blog Editor and the live
 * site follows within 5 minutes — no deploy, no restart.
 *
 * Rendering: markdown → marked → xss allowlist. Videos never go through the
 * sanitizer — a line like `@video https://youtu.be/…` (or a bare YouTube/
 * Vimeo URL on its own line) becomes a token BEFORE rendering and is replaced
 * AFTER sanitizing with an iframe WE construct from the parsed video id, so
 * arbitrary iframes can't ride in via post content.
 */
'use strict';

const { marked } = require('marked');
const xss = require('xss');
const fetch = require('node-fetch'); // house standard (server.js does the same; engines: node 18.x)

const CASPIO_PROXY_BASE = process.env.CASPIO_PROXY_BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
const CACHE_TTL_MS = 5 * 60 * 1000;

marked.setOptions({ gfm: true, breaks: false });

// ---------- data (cached) ----------

const cache = new Map(); // key → { at, value }

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await loader();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function fetchJson(url) {
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`proxy ${resp.status} for ${url}`);
  return resp.json();
}

async function listPublished() {
  return cached('list', async () => {
    const body = await fetchJson(`${CASPIO_PROXY_BASE}/api/blog-posts`);
    return (body.posts || []).filter((p) => p.status === 'Published');
  });
}

async function getPublished(slug) {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null;
  return cached(`post:${slug}`, async () => {
    try {
      const body = await fetchJson(`${CASPIO_PROXY_BASE}/api/blog-posts/${slug}`);
      return body.post && body.post.status === 'Published' ? body.post : null;
    } catch (e) {
      if (String(e.message).includes('404')) return null;
      throw e;
    }
  });
}

// ---------- markdown → safe HTML ----------

// strict video-id parsing — only YouTube + Vimeo, only their id shapes
function parseVideo(url) {
  const u = String(url || '').trim();
  let m = u.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([\w-]{6,20})/i);
  if (m) return { kind: 'youtube', id: m[1] };
  m = u.match(/vimeo\.com\/(\d{6,12})/i);
  if (m) return { kind: 'vimeo', id: m[1] };
  return null;
}

function videoIframe(video) {
  const src = video.kind === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${video.id}`
    : `https://player.vimeo.com/video/${video.id}`;
  return `<div class="blog-video"><iframe src="${src}" title="Video" loading="lazy" allowfullscreen ` +
    `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>`;
}

const XSS_OPTIONS = {
  whiteList: {
    a: ['href', 'title', 'target', 'rel'],
    p: [], br: [], hr: [], blockquote: [], strong: [], b: [], em: [], i: [], u: [], s: [], del: [],
    h2: ['id'], h3: ['id'], h4: ['id'],
    ul: [], ol: ['start'], li: [],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    table: [], thead: [], tbody: [], tr: [], th: [], td: [],
    code: ['class'], pre: [],
    figure: [], figcaption: [],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  onTagAttr(tag, name, value) {
    // http(s), site-relative, and mailto links/images only — no javascript: etc.
    if ((name === 'href' || name === 'src') && !/^(https?:\/\/|\/|mailto:)/i.test(value)) return '';
    return undefined; // default handling
  },
};

function renderMarkdown(markdown) {
  const tokens = [];
  // `@video <url>` or a bare YouTube/Vimeo URL alone on a line → token
  const withTokens = String(markdown || '').replace(
    /^(?:@video\s+)?(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)\/\S+)\s*$/gim,
    (line, url) => {
      const video = parseVideo(url);
      if (!video) return line;
      tokens.push(videoIframe(video));
      return `\n%%BLOGVIDEO${tokens.length - 1}%%\n`;
    }
  );

  let html = xss(marked.parse(withTokens), XSS_OPTIONS);
  // lazy-load post images by default
  html = html.replace(/<img (?![^>]*loading=)/g, '<img loading="lazy" ');
  // swap tokens for the iframes we built ourselves
  html = html.replace(/(?:<p>)?%%BLOGVIDEO(\d+)%%(?:<\/p>)?/g, (_, i) => tokens[Number(i)] || '');
  return html;
}

// ---------- small helpers the templates use ----------

function readingMinutes(markdown) {
  const words = String(markdown || '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });
}

const escapeHtml = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

module.exports = {
  listPublished, getPublished, renderMarkdown, parseVideo,
  readingMinutes, fmtDate, escapeHtml, CACHE_TTL_MS,
};
