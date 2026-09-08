// routes/blog.js — Blog — server-rendered for SEO, sitemaps, robots, static mounts
// Extracted VERBATIM from server.js lines 4621-5182 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { HASHED_CALCULATOR_PATHS, HASHED_PAGES, HASHED_PAGES_UNDER_PAGES_MOUNT, HASHED_STAFF_UNDER_MOUNT, SERVER_DIR, express, fs, gateStaffPage, loadAssetManifest, path, requireStaff, sendHashedHtml, staticOptions } = ctx;

// =============================================================================
// BLOG — server-rendered for SEO (2026-07-12). Posts live in Caspio Blog_Posts
// (Erik publishes via /dashboards/blog-editor.html — no deploy); lib/blog.js
// fetches through the proxy with a 5-min cache and renders markdown → safe
// HTML (marked + xss allowlist; YouTube/Vimeo embeds built server-side).
// Routes: GET /blog · GET /blog/feed.xml · GET /sitemap-blog.xml ·
//         GET /blog/:slug · POST /api/blog-preview (staff — editor live preview)
// =============================================================================
const blog = require('../lib/blog');
const blogTemplates = require('../lib/blog-templates');

app.get('/blog', async (req, res) => {
  try {
    const posts = await blog.listPublished();
    const category = String(req.query.category || '').slice(0, 60);
    res.type('html').send(blogTemplates.renderIndex(posts, { category }));
  } catch (e) {
    console.error('[blog] index failed:', e.message);
    res.status(503).type('html').send('<h1>Blog temporarily unavailable</h1><p>Please try again in a minute.</p>');
  }
});

app.get('/blog/feed.xml', async (req, res) => {
  try {
    res.type('application/rss+xml').send(blogTemplates.renderFeed(await blog.listPublished()));
  } catch (e) { res.status(503).send('feed unavailable'); }
});

app.get('/sitemap-blog.xml', async (req, res) => {
  try {
    res.type('application/xml').send(blogTemplates.renderSitemap(await blog.listPublished()));
  } catch (e) { res.status(503).send('sitemap unavailable'); }
});

// Style → published-posts map for the product page's "From our blog" block
// (lib/blog.js productMap — live-derived from post bodies, so new posts wire
// themselves in with no deploy). Failure = 503; the PDP module silently skips
// the block (progressive enhancement, not customer data).
app.get('/api/blog-product-map', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=600');
    res.json(await blog.productMap());
  } catch (e) { res.status(503).json({ error: 'map unavailable' }); }
});

app.get('/blog/:slug', async (req, res) => {
  try {
    const post = await blog.getPublished(String(req.params.slug || ''));
    if (!post) {
      return res.status(404).type('html').send(
        '<h1>Post not found</h1><p><a href="/blog">Back to the blog</a></p>');
    }
    const all = await blog.listPublished();
    const related = all.filter((p) => p.slug !== post.slug &&
      (!post.category || p.category === post.category)).slice(0, 3);
    res.type('html').send(blogTemplates.renderPost(post, blog.renderMarkdown(post.bodyMarkdown), related));
  } catch (e) {
    console.error('[blog] post failed:', e.message);
    res.status(503).type('html').send('<h1>Blog temporarily unavailable</h1><p>Please try again in a minute.</p>');
  }
});

// Editor live preview — SAME renderer as the live pages so preview never lies.
// Staff-only (it renders arbitrary markdown; keep it off the public surface).
app.post('/api/blog-preview', requireStaff, express.json({ limit: '256kb' }), (req, res) => {
  res.json({ html: blog.renderMarkdown(String((req.body || {}).markdown || '')) });
});

// ── Tenant config (roadmap 0.3) ─────────────────────────────────────────────
// Runtime tenant hydration for config/tenant.js. Backed by config/tenants/
// <id>.json today; the Phase 2 admin console swaps the backing store without
// changing this contract. Strict id allowlist pattern — the param never
// touches the filesystem un-validated.
app.get('/api/tenants/:id/config', (req, res) => {
  const id = String(req.params.id || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid tenant id' });
  }
  const tenantPath = path.join(SERVER_DIR, 'config', 'tenants', `${id}.json`);
  fs.readFile(tenantPath, 'utf8', (err, raw) => {
    if (err) return res.status(404).json({ error: 'Unknown tenant' });
    try {
      res.setHeader('Cache-Control', 'no-cache');
      res.json(JSON.parse(raw));
    } catch (parseErr) {
      console.error(`[tenants] config/tenants/${id}.json is not valid JSON:`, parseErr.message);
      res.status(500).json({ error: 'Tenant config unreadable' });
    }
  });
});

// ── Build pipeline (roadmap 0.1/0.2) ────────────────────────────────────────
// scripts/build.js emits content-hashed, minified copies of the quote-builder
// assets into /dist + dist/asset-manifest.json. Hashed filenames make these
// safe to cache forever (the name changes when the content does) — unlike the
// no-cache staticOptions everything else needs. HTML stays no-cache so new
// manifest refs are picked up on the next load.
app.use('/dist', express.static(path.join(SERVER_DIR, 'dist'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));



// SECURITY (2026-08-17): /quote-builders had NO gate at all — it sat between
// /dashboards (gated below) and /vendor-portals (gated below) and was simply
// missed. Verified live: teamnwca.com/quote-builders/embroidery-quote-builder.html
// returned the fully working staff tool anonymously — customer search, product
// pricing and ShopWorks import/export included. staff-auth-helper.js is
// sessionStorage rep-name autofill, NOT authentication.
//
// 🔴 THIS GATE MUST STAY ABOVE the /quote-builders/:page route below, not next to
// the express.static mount further down. Express matches in registration order, so
// a gate placed by the static mount would be bypassed by this route, which is
// registered here and serves the same HTML. The ordering IS the security property
// (same rule as the /dashboards block).
app.use('/quote-builders', gateStaffHtml);

// Quote builders keep their own route (they are reached only by .html path).
const REWRITTEN_BUILDER_PAGES = new Set(
  HASHED_PAGES.filter((p) => p.startsWith('quote-builders/')).map((p) => p.slice('quote-builders/'.length))
);
app.get('/quote-builders/:page', (req, res, next) => {
  if (!REWRITTEN_BUILDER_PAGES.has(req.params.page)) return next();
  if (!loadAssetManifest()) return next();
  sendHashedHtml(res, path.join(SERVER_DIR, 'quote-builders', req.params.page));
});

/**
 * Rewrite route factory for a staff mount (/dashboards, /tools).
 *
 * Returns a handler, so it must be registered AFTER that mount's gateStaffHtml
 * and BEFORE its express.static — see the call sites. It deliberately does no
 * auth of its own: by the time it runs, the gate has already accepted the
 * request. next() on anything unexpected hands back to the static mount.
 */
/**
 * Rewrite handler for /calculators (flat and one level nested). Allowlisted by
 * lib/hashed-pages.js, so a path outside the list — or anything with a slash in
 * a param — falls straight through to express.static.
 */
function serveHashedCalculator(req, res, next) {
  const rel = req.params.b ? `${req.params.a}/${req.params.b}` : req.params.a;
  if (!HASHED_CALCULATOR_PATHS.has(rel)) return next();
  if (!loadAssetManifest()) return next();
  sendHashedHtml(res, path.join(SERVER_DIR, 'calculators', ...rel.split('/')));
}

function serveHashedStaffPage(mount) {
  const allowed = HASHED_STAFF_UNDER_MOUNT[mount];
  return (req, res, next) => {
    if (!allowed || !allowed.has(req.params.page)) return next();
    if (!loadAssetManifest()) return next();
    sendHashedHtml(res, path.join(SERVER_DIR, mount, req.params.page));
  };
}

// Storefront pages under /pages reached through the static mount below rather
// than a bespoke route. MUST stay above that mount or express.static answers
// first and the rewrite never runs.
const HASHED_PAGES_MOUNT_SET = new Set(HASHED_PAGES_UNDER_PAGES_MOUNT);
app.get('/pages/:page', (req, res, next) => {
  if (!HASHED_PAGES_MOUNT_SET.has('/pages/' + req.params.page)) return next();
  if (!loadAssetManifest()) return next();
  sendHashedHtml(res, path.join(SERVER_DIR, 'pages', req.params.page));
});

// -----------------------------------------------------------------------------
// STAFF-GATED CALCULATOR PAGES — must be registered BEFORE the /calculators
// static mount below, or Express serves the file and never reaches the gate.
//
// requireStaff BOUNCES to SSO rather than hard-locking, so a logged-in rep never
// notices; only an anonymous visitor is stopped. Do NOT blanket-gate
// /calculators — laser-tumbler-polarcamel.html and embroidered-emblem/ are
// customer-facing.
//
// RETIRED 2026-07-29 — /calculators/sticker-manual-pricing.html and its
// /pricing/stickers alias. That page carried three things: the 2×2–6×6 sticker
// grid, the banner rate card, and the oversize-decal calculator. Customers now
// get the first two directly at /custom-stickers and /custom-banners (same
// Caspio-backed prices — both surfaces always read /api/sticker-pricing), so
// only the decal calculator needed to survive; it moved to its own page below.
// The AI quote drawer and the staff-side STK quote-save did NOT come across
// (Erik 2026-07-29 — rep attribution on sticker quotes is acceptable to lose).
// The HTML/JS are left on disk, flagged dead in ACTIVE_FILES.md.
//
// TOMBSTONE — load-bearing, do not delete. The retired HTML is still on disk,
// and `/calculators` is a static mount a few lines below. Without an explicit
// route here, Express would happily serve sticker-manual-pricing.html to
// ANYONE — dropping the requireStaff gate that was put on it on 2026-07-24
// precisely because its AI drawer could surface customer email, phone, address,
// sales rep and payment terms. Deleting the retired file is the only other way
// to make this safe.
app.get(['/calculators/sticker-manual-pricing.html', '/pricing/stickers'], (req, res) => {
  res.status(410).set('X-Robots-Tag', 'noindex, nofollow').send(`<!DOCTYPE html>
<meta charset="utf-8"><meta name="robots" content="noindex, nofollow">
<title>This page moved</title>
<body style="font:16px/1.6 Inter,system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1rem">
<h1 style="font-size:1.35rem">The sticker &amp; banner quote page was retired</h1>
<p>Its three sections each have a better home now:</p>
<ul>
  <li><a href="/custom-stickers">Sticker pricing (2&times;2 &ndash; 6&times;6)</a> &mdash; the customer page, same prices</li>
  <li><a href="/custom-banners">Banner pricing</a> &mdash; the customer page</li>
  <li><a href="/pricing/decals">Custom &amp; oversize decals</a> &mdash; staff calculator</li>
</ul>
<p><a href="/staff-dashboard.html">Back to the dashboard</a></p>`);
});

// Oversize / custom decals — the ONLY consumer of /api/custom-decal-pricing.
// Staff-gated because it exposes cost-side rate bands and tier minimums.
app.get(['/calculators/custom-decal-pricing.html', '/pricing/decals'], requireStaff, (req, res) => {
  // Header, not robots.txt Disallow: a Disallow would stop Google FETCHING the
  // page, so it could never see the page's own noindex meta — and a disallowed
  // URL with inbound links can still surface as a bare result.
  res.set('X-Robots-Tag', 'noindex, nofollow');
  sendHashedHtml(res, path.join(SERVER_DIR, 'calculators', 'custom-decal-pricing.html'));
});

// ── "Pricing by Style" (compare-pricing) retired 2026-08-05 (Erik approved) ──
// Superseded by Quick Quote, which is what the sales staff actually use. The
// page was NOT wrong: it instantiates the same five *-pricing-service.js
// classes as the quote builders, has zero hardcoded prices, and its Math.min
// base-cost convention matches dtg-canonical-pricing.js / quote-cart-engine.js.
// Verified live against the locked baselines on PC54 — EMB 24-47 $20.00,
// EMB 1-7 base $24.00 and DTG 12-23 $14.50 all matched to the cent.
//
// It was retired because it was the ONE pricing surface with NO parity test
// (13 guard DTF/DTG/EMB/SCP/quick-quote/web-quote-cart; none covered this), so
// any change to a pricing service could drift it silently — the exact failure
// CLAUDE.md rule 9 exists to prevent. Unlike the mockup generator, usage could
// NOT be measured: this app's Heroku logs retain ~30 minutes, far too short to
// call it unused. Hence 302, not 301 — restoring the card and deleting this
// block is the whole rollback, and no browser caches its way past it.
//
// MUST stay above the serveHashedCalculator catch-alls below (which would
// serve the page) as well as the /calculators static mount under them.
//
// ✅ DTF LTM checked and CLEAN — no action needed. A mid-review scare that this
// page and baseline DTF-01 were one $50 LTM apart was a like-for-like error:
// the page was showing the MEDIUM transfer, the baseline is SMALL. Measured
// both code paths on identical inputs (PC54, garmentCost 3, qty 10) and they
// agree to the cent at every size — ladder basePrice + floor(ltmFee/qty) ==
// calculatePriceForQuantity().finalUnitPrice:
//     small  15.50 + 5.00 = 20.50 == 20.50   (matches baseline DTF-01)
//     medium 20.50 + 5.00 = 25.50 == 25.50
//     large  24.00 + 5.00 = 29.00 == 29.00
// calculatePriceForQuantity folds ltmFeePerUnit into subtotalBeforeRounding
// BEFORE the ceil-to-half-dollar, so the $50 IS collected on small DTF orders.
// Recorded here because "is the LTM being dropped?" is a question worth not
// re-opening from scratch — it isn't.
app.get('/calculators/compare-pricing.html', (req, res) => {
  res.redirect(302, '/calculators/quick-quote/');
});

// TOMBSTONE — /calculators/archive/** (2026-08-17). Load-bearing, do not delete.
//
// These are superseded copies kept on disk for reference, but `/calculators` is a
// public static mount with NO gate a few lines below, and archive/ is not in
// robots.txt — so every one of them was live at HTTP 200 to anyone, and
// crawlable. They still WORK (their JS deps all resolve), and they quote from
// FROZEN numbers: archive/cap-embroidery-pricing-integrated.html carries
// `marginDenominator = 0.57` where live is 0.53, plus a hardcoded LTM_FEE = 50.
// A stale calculator that answers confidently is the fastest path to quoting a
// customer a wrong price — Erik's #1 rule, from a page nobody remembers exists.
//
// Verified before adding: nothing in the app links to calculators/archive (no
// href/src anywhere outside ACTIVE_FILES.md and dist/), so this breaks no flow.
// MUST stay ABOVE the serveHashedCalculator routes and the static mount below —
// `/calculators/:a/:b` would otherwise match archive/<page>.html and serve it.
// Deleting the archived files is the only other way to make this safe.
app.use('/calculators/archive', (req, res) => {
  res.status(410).set('X-Robots-Tag', 'noindex, nofollow').send(`<!DOCTYPE html>
<meta charset="utf-8"><meta name="robots" content="noindex, nofollow">
<title>This calculator is retired</title>
<p>This calculator has been retired and its pricing is out of date.</p>
<p><a href="/calculators/quick-quote/">Use Quick Quote</a> for current pricing.</p>`);
});

// Asset rewrite for calculator pages. /calculators has NO mount gate — it is
// mostly public, and the one staff-only page (custom-decal-pricing.html) is
// gated by its own requireStaff route ABOVE, which serves the file itself and
// so never reaches this. Registering immediately before express.static puts
// this after EVERY gate for the prefix: a gate placed after the static mount
// would already be bypassed by it, so "above static" means "below all gates".
// Two params to cover the nested self-contained calculators
// (/calculators/embroidery-contract/index.html).
app.get('/calculators/:a/:b', serveHashedCalculator);
app.get('/calculators/:a', serveHashedCalculator);

// Serve specific directories as static
app.use('/calculators', express.static(path.join(SERVER_DIR, 'calculators'), staticOptions));
// #2 flip — gate staff dashboard PAGES behind a verified SAML session. The login
// page and non-HTML assets (css/js/img) stay public so there's no redirect loop.
// Role-specific dashboards (taneisha/nika/house/policies) keep their own
// requireCrmRole gates registered earlier; this catches the rest.
// Gate staff HTML pages behind a verified SAML session. SECURITY (2026-06-30): decode
// the path FIRST so URL-encoding tricks (e.g. %2e for '.') can't slip a .html request
// past the suffix test and reach the static mount un-gated. Non-HTML assets (css/js/img)
// and the staff-login page stay public so there's no redirect loop. The per-page rule
// itself is enforced table-driven in gateStaffPage (Staff_Page_Access; admin override).
function gateStaffHtml(req, res, next) {
  let p;
  try { p = decodeURIComponent(req.path).toLowerCase(); }
  catch (e) { p = String(req.path).toLowerCase(); }
  if (!p.endsWith('.html') || p === '/staff-login.html') return next();
  return gateStaffPage(req, res, next);
}
app.use('/dashboards', gateStaffHtml);
// Asset rewrite for staff pages. Registered AFTER gateStaffHtml and BEFORE the
// static mount ON PURPOSE: the gate runs first, so an anonymous request is
// bounced to SSO before this ever reads a file. Moving it above the gate would
// serve payroll/payables HTML to the public — the ordering IS the security
// property, and hashed-pages.test.js fails if it changes.
app.get('/dashboards/:page', serveHashedStaffPage('dashboards'));
app.use('/dashboards', express.static(path.join(SERVER_DIR, 'dashboards'), staticOptions));
app.use('/quote-builders', express.static(path.join(SERVER_DIR, 'quote-builders'), staticOptions));
// SECURITY (2026-06-30): vendor-portals (SanMar invoices/credits) + tools (internal
// diagnostics) are staff-only — gate every .html the same way as /dashboards so the
// sibling static mounts can't be used to bypass the root-route gate.
app.use('/vendor-portals', gateStaffHtml);
app.use('/vendor-portals', express.static(path.join(SERVER_DIR, 'vendor-portals'), staticOptions));
app.use('/tools', gateStaffHtml);
// Same gate-then-rewrite-then-static ordering as /dashboards above.
app.get('/tools/:page', serveHashedStaffPage('tools'));
app.use('/tools', express.static(path.join(SERVER_DIR, 'tools'), staticOptions));
// TOMBSTONE — the C112 cap BOGO promo is RETIRED (Erik, 2026-08-17). Load-bearing.
//
// The HTML/JS stay on disk, and /admin serves static below, so without this route
// Express would keep serving a dead promo. It carried HARDCODED prices in the
// markup ($17.00 / $16.00 / $15.50 per cap), so it rendered a confident, frozen
// price card to anyone who still had the link — the same wrong-price-to-a-customer
// risk as the archived calculators, from an offer we no longer honour.
//
// It was ALSO broken: the page loads `src="c112-bogo-promo.js"` relatively, which
// resolves to /admin/c112-bogo-promo.js while the file sits at the repo root, so
// it 404'd in production. Swatches and the PDF quote generator were dead while the
// static price card still rendered — which is exactly why nobody noticed.
//
// MUST stay ABOVE the /admin gate + static mount below.
app.get('/admin/c112-bogo-promo.html', (req, res) => {
  res.status(410).set('X-Robots-Tag', 'noindex, nofollow').send(`<!DOCTYPE html>
<meta charset="utf-8"><meta name="robots" content="noindex, nofollow">
<title>This promotion has ended</title>
<p>The C112 cap BOGO promotion has ended, and the prices on this page are no longer current.</p>
<p><a href="/">Browse current products</a> or call 253-922-5793 for a quote.</p>`);
});

// /admin is staff-only. (The c112-bogo-promo exemption that used to live here was
// removed 2026-08-17 with that promo — /admin is now uniformly gated, so a future
// admin page can't inherit a public hole meant for one retired landing page.)
app.use('/admin', gateStaffHtml);
app.use('/admin', express.static(path.join(SERVER_DIR, 'admin'), staticOptions));
app.use('/email-templates', express.static(path.join(SERVER_DIR, 'email-templates'), staticOptions));
app.use('/mockups', express.static(path.join(SERVER_DIR, 'mockups'), staticOptions));
// ⛔ NO `/tests` MOUNT — REMOVED 2026-08-05, do not re-add.
// It served the whole tests/ tree to anyone, with no gate. CLAUDE.md rule 2
// requires EVERY test to live in tests/, so that mount published whatever the
// newest fixture happened to contain: a unit test for the staff-only contract
// embroidery margin overlay hardcoded the real production cost model, and
// `curl https://…/tests/unit/dst-quote-math.test.js` returned it 200/no-auth —
// defeating the requireStaff endpoint the test existed to verify.
// `.slugignore` keeps tests/ out of the slug as well; this line is the half
// that survives someone deleting that file. Nothing references /tests/ (no
// href/src anywhere), so requests now fall through to the normal 404.
app.use('/styles', express.static(path.join(SERVER_DIR, 'styles'), staticOptions));
// ⛔ NO `/scripts` MOUNT — REMOVED 2026-08-05, do not re-add.
// scripts/ holds build + one-off maintenance tooling, never anything a browser
// loads (verified: zero src=/href= references to /scripts/ across every HTML in
// the repo). It cannot be handled with .slugignore the way tests/ was, because
// heroku-postbuild runs `node scripts/build.js` — the slug genuinely needs the
// files; it was only ever the HTTP mount that had to go. Removing this changes
// nothing about the build.
app.use('/images', express.static(path.join(SERVER_DIR, 'images'), staticOptions));
// Staff-only PDFs inside the otherwise-public /forms tree (Erik, 2026-08-17).
// MOST of /forms is public ON PURPOSE and must stay that way — the Employee
// Handbook, the meal-period waiver and the customer drop-off form are all linked
// from pages an employee or a customer opens without signing in. This allowlist
// is the exception: business paperwork a rep EMAILS to a named customer, which
// has no reason to be fetchable by anyone who guesses the URL. Add a filename
// here (lowercase, no leading slash) to gate it; forms-staff-only.test.js pins
// both the list and the ordering.
//
// ⚠️ MUST stay ABOVE the /forms static mount below — the gate is only a gate if
// it runs first (same ordering property as /dashboards, /tools and /admin).
//
// The lookup canonicalises to a BARE FILENAME, and that is load-bearing rather
// than tidiness. serve-static resolves the path its own way, so any URL spelling
// that resolves to the same file must collapse to the same key here or it walks
// straight past the gate and gets served anonymously. Each step below is a shape
// that was MEASURED serving the real PDF (or would have, on the matching OS)
// against an earlier string-equality version of this gate:
//   • dot-segments   /forms/policies/../<file>.pdf   → basename, so they cancel
//   • NTFS streams   /forms/<file>.pdf::$DATA        → Win32 opens the file; 200
//   • Win32 trailing /forms/<file>.pdf.              → trailing '.'/' ' stripped
// Production is Linux, where only the first shape applies — the rest are defended
// anyway because "the gate happens to hold on this OS" is not a security property.
// Matching the basename deliberately over-gates (a same-named file in a subfolder
// is gated too): failing toward SSO is the safe direction.
// Matched on BASENAME, so a nested path (forms/policies/…) is covered too.
const STAFF_ONLY_FORMS = new Set([
  'business-credit-application-no-personal-guaranty.pdf',
  // Linked from the "Credit Card SOP" policy, whose hub page IS public — so
  // signed-out staff following that link now land on SSO first. That is the
  // intended trade: the SOP's audience is staff, who have credentials. Checked
  // 2026-08-17 by grepping Body_HTML across all 142 live policies (a repo grep
  // MISSES this — policy bodies live in Caspio, not in the tree).
  'credit-card-authorization.pdf',
]);
function gateStaffOnlyForms(req, res, next) {
  let p;
  try { p = decodeURIComponent(req.path); }
  catch (e) { p = String(req.path); }
  const name = p.toLowerCase()
    .replace(/\\/g, '/')   // Win32 separator
    .split('/').pop()      // basename — dot-segments cancel out
    .split(':')[0]         // NTFS alternate data stream
    .replace(/[. ]+$/, ''); // Win32 strips trailing dots/spaces
  if (!STAFF_ONLY_FORMS.has(name)) return next();
  return requireStaff(req, res, next);
}
app.use('/forms', gateStaffOnlyForms);
app.use('/forms', express.static(path.join(SERVER_DIR, 'forms'), staticOptions));
app.use('/guides', express.static(path.join(SERVER_DIR, 'guides'), staticOptions));
app.use('/hr', express.static(path.join(SERVER_DIR, 'hr'), staticOptions));
app.use('/product', express.static(path.join(SERVER_DIR, 'product'), staticOptions));
app.use('/training', express.static(path.join(SERVER_DIR, 'training'), staticOptions));
app.use('/shared_components', express.static(path.join(SERVER_DIR, 'shared_components'), staticOptions));

// ── 3-Day Tees → Custom T-Shirts cutover (Erik approved 2026-06-10) ─────────
// The multi-style storefront replaced 3DT; all old entry URLs 301 to
// /custom-tees. MUST be registered BEFORE the /pages static mount or the
// static file wins. The SUCCESS page is deliberately NOT redirected —
// in-flight Stripe sessions still return to /pages/3-day-tees-success.html.
app.get(['/pages/3-day-tees.html', '/3-day-tees.html', '/3-day-tees'], (req, res) => {
  res.redirect(301, '/custom-tees');
});

// ── Design Gallery beta → Design Vault cutover (Erik approved 2026-08-05) ───
// The beta lived under /pages, which has NO staff gate, so it served customer
// ids, sales reps, order history and art notes to anyone with the URL. The
// rebuild lives under /dashboards, which gateStaffHtml covers. Same MUST-be-
// before-the-static-mount rule as the 3DT block above.
// 302 (not 301) for the first week: browsers cache 301s hard, which would make
// a rollback stick in reps' browsers. Flip to 301 after it soaks.
// NOTE: the customer-facing /design/:designNumber share page is a SEPARATE,
// deliberately public, field-scrubbed route — it is not affected by this.
app.get('/pages/design-gallery.html', (req, res) => {
  res.redirect(302, '/dashboards/design-gallery.html');
});

// ── Embroidery Mockup Generator retired 2026-08-05 (Erik approved) ──────────
// Superseded as an entry point by DST Studio. Retired on usage, not on parity:
// across the full retained inksoft-transform log window (2026-06-30 → 08-05)
// generate-mockup / compare / recolor-emb / identify-elements took ZERO hits.
// The only traffic was /api/embroidery/palette, which mockup-generator.js
// fetches eagerly on page load — i.e. page opens that never produced a mockup.
// MUST stay above the /pages static mount or express.static serves the file
// and this never fires.
//
// Nothing was deleted, so this is a one-line rollback:
//   • pages/mockup-generator.{html,js,css} still on disk
//   • pages/js/thread-color-picker.{js,css} STILL LOADED by mockup-detail.html
//     — do not delete them with the generator
//   • the Flask /api/embroidery/* routes + embroidery_mockup.py stay:
//     mockup-detail.js depends on parse-emb-full, parse-dst-elements, palette
//
// Known gap, accepted: EMB↔PDF thread comparison and the recolored-EMB
// download exist nowhere else. mockup-detail.html covers EMB thread reads.
//
// Shipped as a 302 in v2026.08.05.10; flipped to 301 the same day at Erik's
// request (the soak was cut short deliberately). ⚠️ A 301 is cached hard and
// effectively forever, so deleting this route no longer restores the page for
// anyone whose browser already followed it — reviving the generator now means
// republishing it at a DIFFERENT path, or telling those users to hard-reload.
// Acceptable because the retirement was justified by ~zero traffic to this URL
// in the first place, so almost no browser holds the cached entry.
app.get('/pages/mockup-generator.html', (req, res) => {
  res.redirect(301, '/pages/dst-viewer.html');
});

// Staff-only detail pages that live under /pages (which is otherwise public).
// These three drive the Box art/mockup/transfer workflows: they read customer
// design files, and art-request-detail carries the AE approval action bar.
// Every link to them is emailed to an @nwcustomapparel.com address (the sales
// rep, Bradley, art@) and they are linked only from gated dashboards — they
// were simply never gated themselves, the same gap the public design-gallery
// beta had. MUST be registered BEFORE the static mount below or it serves them
// first and the gate never runs.
// 🔴 app.get, NOT app.use: app.use STRIPS the mount path, so gateStaffHtml would
// see req.path === '/' , fail its `.html` suffix test, and wave the request
// through as if it were a css/js asset — the gate silently does nothing.
app.get([
  '/pages/art-request-detail.html',
  '/pages/mockup-detail.html',
  '/pages/transfer-detail.html',
  '/pages/supacolor-job-detail.html',
  // 2026-09-03 (dashboard Workspaces audit): five more staff tools that only ever
  // hung off the staff dashboard but sat on the anonymous /pages static mount.
  '/pages/box-labels.html',
  '/pages/jds-mockup-creator.html',
  '/pages/dst-viewer.html',
  '/pages/garment-designer.html',
  '/pages/mockup-library.html',
], gateStaffHtml);

// Legacy webstore info page under /pages — same consolidation as the root
// /webstore-info.html 301 below, but it MUST sit above this static mount or
// the file answers first (M-6: two different "Webstores" pages were live).
app.get('/pages/webstore-info.html', (req, res) => {
  res.redirect(301, '/company-webstores');
});

app.use('/pages', express.static(path.join(SERVER_DIR, 'pages'), staticOptions));

// APP_CONFIG lives here (config/app.config.js) and is loaded by ~77 pages.
// It had NO mount of its own and only ever resolved because the wildcards
// below happened to serve any depth — so it must be mounted explicitly BEFORE
// they are tightened, or every page loses APP_CONFIG.API.BASE_URL.
app.use('/config', express.static(path.join(SERVER_DIR, 'config'), staticOptions));

// Serve CSS and JS files from THE ROOT DIRECTORY ONLY.
//
// 🔴 SECURITY (fixed 2026-08-05): `/*` matches slashes, so these two routes
// used to resolve ANY depth — `GET /server.js` returned the entire 704 KB
// server source in production, and `/lib/page-access.js` handed out the RBAC
// decision logic. They also re-served the whole tests/ tree, which is how a
// unit-test fixture published the staff-only cost model even though tests/ was
// removed from the slug. Real subdirectories are served by the explicit mounts
// registered above this line; anything else now falls through to 404.
//
// The guard rejects any separator or dot-segment rather than trying to
// sanitise it — `path.join` would happily normalise `a/../../secret` for us.
// The repo root is a legacy dumping ground: ~18 genuine front-end assets
// (utils.js, catalog-search.js, main.css …) sitting next to server-side files.
// Denying the server-side handful beats allowlisting the assets, because a
// missed allowlist entry silently breaks a page while a missed deny entry is
// caught by this list being short and obvious. ADD ANY NEW SERVER-SIDE ROOT
// FILE HERE.
const ROOT_ASSET_DENY = new Set(['server.js']);
function serveRootAsset(ext) {
  return (req, res, next) => {
    const name = req.params[0] || '';
    if (name.includes('/') || name.includes('\\') || name.includes('..') || name.includes('\0')) {
      return next();
    }
    const file = name + ext;
    // `*.config.js` covers jest.config.js and anything like it added later.
    if (ROOT_ASSET_DENY.has(file) || /\.config\.js$/i.test(file)) return next();
    res.sendFile(path.join(SERVER_DIR, file), err => {
      if (err) next();
    });
  };
}
app.get('/*.css', serveRootAsset('.css'));
app.get('/*.js', serveRootAsset('.js'));

// Redirect old embroidery-contract URL to unified page
app.get('/calculators/embroidery-contract*', (req, res) => {
  res.redirect(301, '/calculators/embroidery-pricing-all/?tab=al-cemb');
});


};
