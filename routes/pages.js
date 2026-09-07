// routes/pages.js — Site pages — staff dashboard, page gates, clean-URL storefront routes and redirects, sitemap
// Extracted VERBATIM from server.js lines 4484-4965 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { SERVER_DIR, express, gateStaffDetailPage, gateStaffPage, noCacheHeaders, path, requireCustomer, requireStaff, sendHashedHtml, staticOptions } = ctx;

// ===== Staff Dashboard (v3 sole survivor, cleanup 2026-05-28) =====
// 2026-05-13: v3 became canonical, v2/v1 kept as safety nets.
// 2026-05-28: v2 + v1 files deleted (no rollback ever needed in soak).
//   The /staff-dashboard-v2.html and /staff-dashboard-legacy.html URLs
//   now 301-redirect to canonical so old bookmarks still land on V3.
//   Recovery: `git show v2026.05.27.5:staff-dashboard.html` (or :staff-dashboard-legacy.html).

// Canonical URL — serves v3 (gated: verified SAML staff session required).
// 2026-09-04: served through sendHashedHtml (lib/hashed-pages DASHBOARD_PAGES) so
// its stylesheets + bundled module entry come from /dist, cached for a year;
// the HTML itself stays no-store. Fails open to the plain file when no manifest.
app.get('/staff-dashboard.html', requireStaff, (req, res) => {
  noCacheHeaders(res);
  sendHashedHtml(res, path.join(SERVER_DIR, 'staff-dashboard-v3', 'index.html'));
});

// Old v2 URL → redirect to canonical (file deleted 2026-05-28)
app.get('/staff-dashboard-v2.html', (req, res) => {
  res.redirect(301, '/staff-dashboard.html');
});

// Old v1 URL → redirect to canonical (file deleted 2026-05-28)
app.get('/staff-dashboard-legacy.html', (req, res) => {
  res.redirect(301, '/staff-dashboard.html');
});

// Old DTG legacy builder → redirect to the flagship (legacy files deleted 2026-06-08:
// dtg-quote-builder-legacy.html + dtg-quote-builder.js + dtg-quote-service.js — superseded by the v14 flagship).
app.get('/quote-builders/dtg-quote-builder-legacy.html', (req, res) => {
  res.redirect(301, '/quote-builders/dtg-quote-builder.html');
});

// v3 dedicated URL — preserved so any direct /staff-dashboard-v3/ bookmarks
// still resolve to the same content as the canonical URL.
app.get('/staff-dashboard-v3/', requireStaff, (req, res) => {
  noCacheHeaders(res);
  sendHashedHtml(res, path.join(SERVER_DIR, 'staff-dashboard-v3', 'index.html'));
});
app.get('/staff-dashboard-v3', (req, res) => {
  res.redirect(301, '/staff-dashboard-v3/');
});
app.get('/staff-dashboard-v3/index.html', requireStaff, (req, res) => {
  noCacheHeaders(res);
  sendHashedHtml(res, path.join(SERVER_DIR, 'staff-dashboard-v3', 'index.html'));
});
// Static assets under /staff-dashboard-v3/ (config.js, quote-launcher.js,
// past-due-badge.js, art-aging-widget.js). Reuse staticOptions so these also
// send no-cache headers. ⚠️ Everything this mount serves is ANONYMOUS — the
// requireStaff gates above cover only the .html; never put internal-only data
// in these files (roster went to lib/ + /api/staff/employees for this reason).
app.use('/staff-dashboard-v3', express.static(path.join(SERVER_DIR, 'staff-dashboard-v3'), staticOptions));

// Employee Bundle Pages
app.get('/DrainPro-Bundle.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'DrainPro-Bundle.html'));
});

app.get('/streich-bros-bundle.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'employee-bundles', 'streich-bros-bundle.html'));
});

app.get('/wcttr-bundle.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'employee-bundles', 'wcttr-bundle.html'));
});

// Art-invoice pages REMOVED 2026-08-16. Art invoicing moved onto the art request
// itself (ArtRequests.Amount_Art_Billed / Invoiced / Invoiced_Date), which the art
// hub and request-detail pages read; the separate Art_Invoices Caspio table was
// deleted, so /api/art-invoices had been 500ing and these pages could not load data.
// The third route here served art-invoice-unified-dashboard.html, a file that does
// not exist in the repo at all — it had been returning an error for an unknown time.

// Removed duplicate route - webstore-info.html is now served from /pages/ directory (see line 328)

app.get('/universal-records-admin.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'admin', 'universal-records-admin.html'));
});

app.get('/art-hub-steve.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'art-hub-steve.html'));
});

app.get('/art-hub-ruth.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'art-hub-ruth.html'));
});

// Ruth mockup detail page (serves for /mockup/123, /mockup/456, etc.)
app.get('/mockup/:id', gateStaffDetailPage, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(SERVER_DIR, 'pages', 'mockup-detail.html'));
});

// Customer Portal — session-gated (#6 Phase 2). The page derives its data from the verified
// customer LOGIN session (no id in the URL), so the old /portal/:customerId guess-the-id
// enumeration is closed. Logged-out visitors are bounced to /customer/login.
app.get('/portal', requireCustomer, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(SERVER_DIR, 'pages', 'customer-portal.html'));
});
// Back-compat: old URL-token links now redirect to the gated portal (then login if needed).
app.get('/portal/:customerId', (req, res) => res.redirect('/portal'));

app.get('/announcements-create.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'admin', 'announcements-create.html'));
});

app.get('/announcements-manage.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'admin', 'announcements-manage.html'));
});

// Serve the embroidery quote builder
// gateStaffPage (2026-08-17): these ROOT aliases serve the same staff builders as
// /quote-builders/*, so the mount gate above does NOT cover them — a different path
// is a different route. Gated individually, same pattern as the /announcements-*
// aliases directly above.
app.get('/embroidery-quote-builder.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'quote-builders', 'embroidery-quote-builder.html'));
});

// Serve the cap embroidery quote builder
app.get('/cap-embroidery-quote-builder.html', gateStaffPage, (req, res) => {
  console.log('Serving cap-embroidery-quote-builder.html page');
  res.sendFile(path.join(SERVER_DIR, 'quote-builders', 'cap-embroidery-quote-builder.html'));
});

// Serve the cap embroidery pricing calculator (alias for integrated version)
app.get('/calculators/cap-embroidery-pricing.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'cap-embroidery-pricing-integrated.html'));
});

// Serve the DTG quote builder
app.get('/dtg-quote-builder.html', gateStaffPage, (req, res) => {
  console.log('Serving dtg-quote-builder.html page');
  res.sendFile(path.join(SERVER_DIR, 'quote-builders', 'dtg-quote-builder.html'));
});

// Serve the screen print quote builder
app.get('/screenprint-quote-builder.html', gateStaffPage, (req, res) => {
  console.log('Serving screenprint-quote-builder.html page');
  res.sendFile(path.join(SERVER_DIR, 'quote-builders', 'screenprint-quote-builder.html'));
});

// 2026-09-06: the two art-tools/ redirect stubs (a JS redirect and a meta refresh) are now real 301s.
app.get(['/ae-art-dashboard.html', '/ae-submit-art.html'], (req, res) => {
  res.redirect(301, '/ae-dashboard.html');
});

app.get('/ae-dashboard.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'dashboards', 'ae-dashboard.html'));
});

app.get('/digitizingform.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'digitizingform.html'));
});

app.get('/purchasingform.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'purchasingform.html'));
});

app.get('/monogramform.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'monogramform.html'));
});

// Removed duplicate route - policies-hub.html is now served from /pages/ directory (see line 314)

// Christmas Bundles Calculator page
app.get('/christmas-bundles.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'christmas-bundles.html'));
});

// Breast Cancer Awareness Bundle page (Archived - October 2025 promotion)
app.get('/breast-cancer-awareness-bundle.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'calculators', 'archive', 'seasonal-2025', 'breast-cancer-awareness-bundle.html'));
});

// Serve the policies directory as static files
app.use('/policies', express.static(path.join(SERVER_DIR, 'policies'), staticOptions));

// Sanmar Vendor Management Pages
// SanMar vendor-portal pages (wholesale invoices/credits/portal) — were PUBLIC; now
// gated by the shared table-driven gate (login + Staff_Page_Access). Manage who sees
// each in the Access-Admin UI. Unlisted → any logged-in staff (login now required).
app.get('/sanmar-invoices.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'vendor-portals', 'sanmar-invoices.html'));
});

app.get('/sanmar-credits.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'vendor-portals', 'sanmar-credits.html'));
});

app.get('/sanmar-vendor-portal.html', gateStaffPage, (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'vendor-portals', 'sanmar-vendor-portal.html'));
});

// Routes for pages moved to /pages/ directory
app.get('/inventory-details.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'inventory-details.html'));
});

app.get('/policies-hub.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'policies-hub.html'));
});

app.get('/resources.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'resources.html'));
});

app.get('/sale.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'sale.html'));
});

// Legacy webstore info page → consolidated into the SEO hub /company-webstores
// (2026-07-14) so the two don't cannibalize. 301 keeps its link equity.
app.get('/webstore-info.html', (req, res) => {
  res.redirect(301, '/company-webstores');
});

// Top Sellers consolidation (2026-07-06): the standalone showcase + per-style
// sample pages retired into /catalog?topSellers=1 (IsTopSeller-driven view w/
// sample program) and product.html ("Order a sample" CTA). 301s keep old
// bookmarks, emails, and SEO alive. /pages/* forms fall through the static
// mount once the files are gone.
app.get(['/top-sellers-showcase.html', '/pages/top-sellers-showcase.html'], (req, res) => {
  res.redirect(301, '/catalog?topSellers=1');
});

app.get(['/top-sellers-product.html', '/pages/top-sellers-product.html'], (req, res) => {
  const style = (req.query.style || '').toString();
  res.redirect(301, style
    ? `/product.html?style=${encodeURIComponent(style)}`
    : '/catalog?topSellers=1');
});

app.get('/sample-cart.html', (req, res) => {
  sendHashedHtml(res, path.join(SERVER_DIR, 'pages', 'sample-cart.html'));
});

app.get('/dtg-compatible-products.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'dtg-compatible-products.html'));
});

// Richardson 112 one-off page retired with the top-sellers consolidation
// (2026-07-06) — the modern PDP serves style 112 through the shared engine.
app.get(['/richardson-112-product.html', '/pages/richardson-112-product.html'], (req, res) => {
  res.redirect(301, '/product.html?style=112');
});

app.get('/pricing-negotiation-policy.html', (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'pricing-negotiation-policy.html'));
});

// /3-day-tees.html sendFile route removed 2026-06-10 — the cutover 301
// (registered before the /pages static mount) now owns all 3DT entry URLs.

// Custom T-Shirts — multi-style DTG storefront (2026-06-10). Clean URL +
// .html alias; the success page resolves via the static /pages mount.
app.get(['/custom-tees', '/custom-tees.html'], (req, res) => {
  sendHashedHtml(res, path.join(SERVER_DIR, 'pages', 'custom-tees.html'));
});

// Catalog — dedicated URL-driven product discovery page (customer redesign P2,
// 2026-06-11). Clean URL + .html alias; same pattern as /custom-tees.
app.get(['/catalog', '/catalog.html'], (req, res) => {
  sendHashedHtml(res, path.join(SERVER_DIR, 'pages', 'catalog.html'));
});

// Custom Hats — embroidered caps storefront (custom-caps channel, 2026-06-11).
// Clean URL + .html alias; success page resolves via the static /pages mount.
app.get(['/custom-caps', '/custom-caps.html'], (req, res) => {
  sendHashedHtml(res, path.join(SERVER_DIR, 'pages', 'custom-caps.html'));
});

// Custom die-cut stickers — public, indexed storefront page (2026-07-24).
// Zero clicks to a price: the whole 50-SKU grid arrives in one boot call and the
// ladder re-prices from memory. Registered in the SAME commit as the page and
// the sitemap entry (see the zombie-route note at the top of this file).
//
// As of 2026-07-29 this is THE sticker pricing surface — the staff tool that
// used to sit at /pricing/stickers was retired, and the staff dashboard now
// links reps straight here. Both always read the same /api/sticker-pricing
// grid, so there was never a second set of numbers to reconcile.
app.get(['/custom-stickers', '/custom-stickers.html', '/stickers'], (req, res) => {
  sendHashedHtml(res, path.join(SERVER_DIR, 'pages', 'custom-stickers.html'));
});

// Custom vinyl banners — public, indexed storefront page (Phase 3, 2026-07-24).
// Sibling of /custom-stickers and the lane Sticker Mule does not compete in at
// all. The ladder here is SIZES, not quantities: BAN-SQFT is a flat $10/sqft
// with no volume break, so a quantity ladder would imply a discount that does
// not exist. Boot payload: GET /api/public/banner-presets.
app.get(['/custom-banners', '/custom-banners.html', '/banners'], (req, res) => {
  sendHashedHtml(res, path.join(SERVER_DIR, 'pages', 'custom-banners.html'));
});

// Custom Carhartt — static SEO brand landing page (2026-07-12): curated
// top-sellers grid + FAQ + ItemList/FAQPage schema. Targets "custom carhartt
// embroidered" buying-intent queries; content is fully static on purpose.
app.get(['/custom-carhartt', '/custom-carhartt.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-carhartt.html'));
});

// Custom Richardson — static SEO brand landing page (2026-07-13): the 112
// trucker + full Richardson cap lineup, leather/laser patches (NWCA specialty).
// Same static pattern as /custom-carhartt (shares its landing CSS/JS).
app.get(['/custom-richardson', '/custom-richardson.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-richardson.html'));
});

// Custom Nike — static SEO brand landing page (2026-07-13): Dri-FIT polos,
// Club Fleece, and caps embroidered in-house (the swoosh premium/gift play).
app.get(['/custom-nike', '/custom-nike.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-nike.html'));
});

// Custom New Era — static SEO brand landing page (2026-07-13): structured
// caps, flat-bill snapbacks, and beanies embroidered/patched in-house.
app.get(['/custom-new-era', '/custom-new-era.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-new-era.html'));
});

// Custom Sport-Tek — static SEO brand landing page (2026-07-13): performance
// polos, Competitor tees, and Sport-Wick 1/4-zips for teams & spirit wear.
app.get(['/custom-sport-tek', '/custom-sport-tek.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-sport-tek.html'));
});

// Custom OGIO — static SEO brand landing page (2026-07-13): premium performance
// polos, signature bags/packs, and soft-shell jackets, decorated in-house.
app.get(['/custom-ogio', '/custom-ogio.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-ogio.html'));
});

// Custom District — static SEO brand landing page (2026-07-13): retail-soft
// Very Important Tees, tri-blends, and fleece for merch & events.
app.get(['/custom-district', '/custom-district.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-district.html'));
});

// Custom Port Authority — static SEO brand landing page (2026-07-13): the
// corporate-apparel workhorse — caps, performance polos, soft-shell jackets.
app.get(['/custom-port-authority', '/custom-port-authority.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-port-authority.html'));
});

// Custom Port & Company — static SEO brand landing page (2026-07-13): value
// tees & Core Fleece for big orders, fundraisers, and events.
app.get(['/custom-port-and-company', '/custom-port-and-company.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-port-and-company.html'));
});

// Custom CornerStone — static SEO brand landing page (2026-07-13): ANSI hi-vis
// safety apparel, snag-proof tactical polos, Class 3 outerwear.
app.get(['/custom-cornerstone', '/custom-cornerstone.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-cornerstone.html'));
});

// Custom The North Face — static SEO brand landing page (2026-07-13): premium
// DryVent jackets, Skyline fleece, insulated vests — the gift people keep.
app.get(['/custom-north-face', '/custom-north-face.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-north-face.html'));
});

// Custom Gildan — static SEO brand landing page (2026-07-13): value screen-print
// blanks — Ultra Cotton tees & Heavy Blend hoodies for big runs.
app.get(['/custom-gildan', '/custom-gildan.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-gildan.html'));
});

// Custom Eddie Bauer — static SEO brand landing page (2026-07-13): premium
// outerwear — soft shell, rain & quilted jackets, executive-gift tier.
app.get(['/custom-eddie-bauer', '/custom-eddie-bauer.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-eddie-bauer.html'));
});

// Custom TravisMathew — static SEO brand landing page (2026-07-13): premium golf
// polos, 1/4-zips, and signature caps for tournaments & outings.
app.get(['/custom-travismathew', '/custom-travismathew.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-travismathew.html'));
});

// Custom Bella+Canvas — static SEO brand landing page (2026-07-13): premium
// soft jersey tees, tri-blends, and sponge fleece for merch & fashion drops.
app.get(['/custom-bella-canvas', '/custom-bella-canvas.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-bella-canvas.html'));
});

// Use-case landing pages (2026-07-13) — intent/occasion pages that cut across
// brands. Clean URLs so they're indexable; the file itself keeps its name.
// Golf tournament apparel page was built 2026-07-12 but had no clean URL/sitemap.
app.get(['/golf-tournament-apparel', '/golf-tournaments'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'golf-tournaments-2026.html'));
});

// Custom Safety STRIPE Apparel — use-case landing page (2026-07-13): screen-
// printed hi-vis safety-stripes program (stripe-layout gallery + recommended
// hi-vis blanks + Steve custom stripes) in golf-page showcase style.
app.get(['/custom-safety-apparel', '/custom-safety-apparel.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'custom-safety-apparel.html'));
});

// Company & Team Webstores — SEO hub (2026-07-14): the B2B "company store / team
// store / employee uniform store" cluster; hub-and-spoke (8 store-type cards) in
// golf-page showcase style. Supersedes the legacy /webstore-info.html (301'd below).
app.get(['/company-webstores', '/company-webstores.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'company-webstores.html'));
});

// Webstore SPOKE pages (2026-07-14) — niche stores prioritized by real InkSoft
// order data (id_OrderType=31): construction is #1 by volume. Each shows the
// products that niche actually orders. Flat keyword URLs; hub = /company-webstores.
app.get(['/construction-webstores', '/construction-webstores.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'construction-webstores.html'));
});
// Restaurant & hospitality spoke.
app.get(['/restaurant-webstores', '/restaurant-webstores.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'restaurant-webstores.html'));
});
// Remaining B2B webstore spokes (2026-07-14) — property mgmt, industrial, retail, government.
app.get(['/property-management-webstores', '/property-management-webstores.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'property-management-webstores.html'));
});
app.get(['/industrial-webstores', '/industrial-webstores.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'industrial-webstores.html'));
});
app.get(['/retail-webstores', '/retail-webstores.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'retail-webstores.html'));
});
app.get(['/government-webstores', '/government-webstores.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'government-webstores.html'));
});
// Webstore spokes wave 2 (2026-07-14) — team, school spirit, fundraising, college, event.
app.get(['/team-webstores', '/team-webstores.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'team-webstores.html'));
});
app.get(['/school-spirit-webstores', '/school-spirit-webstores.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'school-spirit-webstores.html'));
});
app.get(['/fundraising-webstores', '/fundraising-webstores.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'fundraising-webstores.html'));
});
app.get(['/college-webstores', '/college-webstores.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'college-webstores.html'));
});
app.get(['/event-webstores', '/event-webstores.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'event-webstores.html'));
});

// Core-pages sitemap (2026-07-12) — the handful of hand-built landing/tool
// pages that aren't in the blog or product sitemaps. Listed in robots.txt.
app.get('/sitemap-pages.xml', (req, res) => {
  const pages = [
    '/', '/custom-carhartt', '/custom-richardson', '/custom-nike', '/custom-new-era', '/custom-sport-tek', '/custom-ogio', '/custom-district', '/custom-port-authority', '/custom-port-and-company', '/custom-cornerstone', '/custom-north-face', '/custom-gildan', '/custom-eddie-bauer', '/custom-travismathew', '/custom-bella-canvas', '/golf-tournament-apparel', '/custom-safety-apparel', '/company-webstores', '/construction-webstores', '/restaurant-webstores', '/property-management-webstores', '/industrial-webstores', '/retail-webstores', '/government-webstores', '/team-webstores', '/school-spirit-webstores', '/fundraising-webstores', '/college-webstores', '/event-webstores', '/custom-tees', '/custom-caps', '/custom-stickers', '/custom-banners', '/blog',
    '/brands.html', '/catalog?topSellers=1',
    '/pages/request-a-quote.html', '/pages/webstore-inquiry.html',
  ];
  const urls = pages.map((p) =>
    `  <url><loc>https://www.teamnwca.com${p.replace(/&/g, '&amp;')}</loc><changefreq>weekly</changefreq></url>`);
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
});

// Customer quote cart — sessionStorage quote builder (quote-cart Phase 2,
// 2026-06-11). Clean URL + .html alias; same pattern as /custom-tees.
app.get(['/quote-cart', '/quote-cart.html'], (req, res) => {
  sendHashedHtml(res, path.join(SERVER_DIR, 'pages', 'quote-cart.html'));
});

// ── Customer order-status page (token link, no login — 2026-06-10) ──────────
// Linked from the confirmation emails as {{order_status_url}}. Same clean-URL
// pattern as /custom-tees; the page uses absolute /pages/... asset paths.
app.get(['/order-status', '/order-status.html'], (req, res) => {
  res.sendFile(path.join(SERVER_DIR, 'pages', 'order-status.html'));
});


};
