/**
 * lib/blog-templates.js — server-rendered HTML for /blog and /blog/:slug.
 *
 * Pure template strings (no engine): every page ships complete HTML so search
 * engines get real titles, meta descriptions, canonicals, Open Graph/Twitter
 * cards, and JSON-LD BlogPosting schema without executing a line of JS.
 * Styling rides the site's own 2026 theme (nwca-2026-core.css vars) via
 * /shared_components/css/blog.css.
 */
'use strict';

const { escapeHtml: esc, fmtDate, readingMinutes } = require('./blog');

const SITE = 'https://www.teamnwca.com';
const BRAND = 'Northwest Custom Apparel';
const LOGO = 'https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1';

function pageShell({ title, metaDescription, canonicalPath, ogImage, ogType = 'website', jsonLd = null, bodyHtml, extraHead = '' }) {
  const canonical = `${SITE}${canonicalPath}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(metaDescription)}">
    <link rel="canonical" href="${canonical}">
    <meta property="og:site_name" content="${BRAND}">
    <meta property="og:type" content="${ogType}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(metaDescription)}">
    <meta property="og:url" content="${canonical}">
    ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
    <meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">
    <link rel="icon" href="/favicon.png" type="image/png">
    <link rel="alternate" type="application/rss+xml" title="${BRAND} Blog" href="${SITE}/blog/feed.xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/shared_components/css/nwca-2026-core.css">
    <link rel="stylesheet" href="/shared_components/css/blog.css">
    ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
    ${extraHead}
</head>
<body class="blog-body">
    <header class="blog-topnav">
        <a href="/" class="blog-logo-link"><img src="${LOGO}" alt="${BRAND}" class="blog-logo"></a>
        <nav class="blog-nav">
            <a href="/catalog">Catalog</a>
            <a href="/blog" class="is-here">Blog</a>
            <a href="/pages/request-a-quote.html" class="blog-nav-cta">Get a Quote</a>
        </nav>
    </header>
    ${bodyHtml}
    <footer class="blog-footer">
        <div class="blog-footer-inner">
            <span>© ${new Date().getFullYear()} ${BRAND} · Family-owned since 1977 · Milton, WA</span>
            <span><a href="tel:253-922-5793">253-922-5793</a> · <a href="mailto:sales@nwcustomapparel.com">sales@nwcustomapparel.com</a> · <a href="/pages/request-a-quote.html">Request a quote</a></span>
        </div>
    </footer>
</body>
</html>`;
}

function postCard(p) {
  return `<a class="blog-card" href="/blog/${esc(p.slug)}">
      ${p.heroImageUrl ? `<div class="blog-card-media"><img src="${esc(p.heroImageUrl)}" alt="" loading="lazy"></div>` : '<div class="blog-card-media blog-card-media--empty"></div>'}
      <div class="blog-card-body">
          ${p.category ? `<span class="blog-chip">${esc(p.category)}</span>` : ''}
          <h2>${esc(p.title)}</h2>
          <p>${esc(p.metaDescription)}</p>
          <span class="blog-card-meta">${esc(fmtDate(p.publishedAt))}</span>
      </div>
  </a>`;
}

function renderIndex(posts, { category = '' } = {}) {
  const cats = [...new Set(posts.map((p) => p.category).filter(Boolean))].sort();
  const shown = category ? posts.filter((p) => p.category === category) : posts;
  const [featured, ...rest] = shown;

  const body = `
    <main class="blog-wrap">
        <div class="blog-hero">
            <h1>The ${BRAND} Blog</h1>
            <p>Guides, news, and behind-the-scenes from our Milton, WA shop — embroidery, screen printing, DTG, and DTF since 1977.</p>
        </div>
        ${cats.length ? `<nav class="blog-cats" aria-label="Categories">
            <a href="/blog" class="${category ? '' : 'is-active'}">All</a>
            ${cats.map((c) => `<a href="/blog?category=${encodeURIComponent(c)}" class="${c === category ? 'is-active' : ''}">${esc(c)}</a>`).join('')}
        </nav>` : ''}
        ${shown.length === 0 ? '<p class="blog-empty">No posts here yet — check back soon.</p>' : ''}
        ${featured ? `<section class="blog-featured">${postCard(featured)}</section>` : ''}
        ${rest.length ? `<section class="blog-grid">${rest.map(postCard).join('')}</section>` : ''}
    </main>`;

  return pageShell({
    title: category ? `${category} — ${BRAND} Blog` : `Blog — Custom Apparel Guides & News | ${BRAND}`,
    metaDescription: 'Guides, news, and behind-the-scenes from Northwest Custom Apparel — custom embroidery, screen printing, DTG, and DTF transfers in Milton, WA.',
    canonicalPath: category ? `/blog?category=${encodeURIComponent(category)}` : '/blog',
    ogImage: LOGO,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `${BRAND} Blog`,
      url: `${SITE}/blog`,
      publisher: { '@type': 'Organization', name: BRAND, logo: { '@type': 'ImageObject', url: LOGO } },
    },
    bodyHtml: body,
  });
}

function renderPost(post, bodyHtml, related = []) {
  const minutes = readingMinutes(post.bodyMarkdown);
  const body = `
    <main class="blog-wrap blog-wrap--post">
        <article class="blog-post">
            <nav class="blog-breadcrumb"><a href="/blog">← All posts</a></nav>
            ${post.category ? `<span class="blog-chip">${esc(post.category)}</span>` : ''}
            <h1>${esc(post.title)}</h1>
            <div class="blog-post-meta">
                ${post.author ? `<span>${esc(post.author)}</span> · ` : ''}
                <time datetime="${esc(post.publishedAt)}">${esc(fmtDate(post.publishedAt))}</time>
                · ${minutes} min read
            </div>
            ${post.heroImageUrl ? `<figure class="blog-post-hero"><img src="${esc(post.heroImageUrl)}" alt="${esc(post.title)}"></figure>` : ''}
            <div class="blog-prose">${bodyHtml}</div>
            <aside class="blog-cta">
                <h2>Have a project like this?</h2>
                <p>We've decorated apparel for Northwest teams and companies since 1977 — tell us what you're making and a real person will reply within one business day.</p>
                <a class="blog-cta-btn" href="/pages/request-a-quote.html">Request a quote</a>
                <span class="blog-cta-alt">or call <a href="tel:253-922-5793">253-922-5793</a></span>
            </aside>
        </article>
        ${related.length ? `<section class="blog-related">
            <h2>Keep reading</h2>
            <div class="blog-grid">${related.map(postCard).join('')}</div>
        </section>` : ''}
    </main>`;

  return pageShell({
    title: `${post.title} | ${BRAND}`,
    metaDescription: post.metaDescription || post.title,
    canonicalPath: `/blog/${post.slug}`,
    ogImage: post.heroImageUrl || LOGO,
    ogType: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.metaDescription || undefined,
      image: post.heroImageUrl || LOGO,
      datePublished: post.publishedAt || undefined,
      dateModified: post.updatedAt || post.publishedAt || undefined,
      author: { '@type': 'Organization', name: post.author || BRAND },
      publisher: { '@type': 'Organization', name: BRAND, logo: { '@type': 'ImageObject', url: LOGO } },
      mainEntityOfPage: `${SITE}/blog/${post.slug}`,
    },
    bodyHtml: body,
  });
}

function renderFeed(posts) {
  const items = posts.slice(0, 20).map((p) => `
    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE}/blog/${esc(p.slug)}</link>
      <guid>${SITE}/blog/${esc(p.slug)}</guid>
      <pubDate>${new Date(p.publishedAt || Date.now()).toUTCString()}</pubDate>
      <description>${esc(p.metaDescription)}</description>
    </item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${BRAND} Blog</title>
  <link>${SITE}/blog</link>
  <description>Guides, news, and behind-the-scenes from ${BRAND}.</description>
  ${items}
</channel></rss>`;
}

function renderSitemap(posts) {
  const urls = [`  <url><loc>${SITE}/blog</loc><changefreq>weekly</changefreq></url>`]
    .concat(posts.map((p) => `  <url><loc>${SITE}/blog/${esc(p.slug)}</loc>${p.updatedAt ? `<lastmod>${esc(p.updatedAt.slice(0, 10))}</lastmod>` : ''}</url>`));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

module.exports = { renderIndex, renderPost, renderFeed, renderSitemap };
