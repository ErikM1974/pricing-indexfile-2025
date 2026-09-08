// routes/product-pages.js — product-pages
// Extracted VERBATIM from server.js lines 1198-1234 on 2026-09-07 (server split). The code below is byte-for-byte
// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged
// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.
module.exports = function register(app, ctx) {
const { SERVER_DIR, fs, path, sendHashedHtml } = ctx;

const productSeo = require('../lib/product-seo');
const productHtmlPath = path.join(SERVER_DIR, 'product.html');

async function serveProductPage(req, res) {
  const style = String(req.query.style || req.query.StyleNumber || '').trim();
  if (style) {
    try {
      const head = await productSeo.headForStyle(style);
      if (head) {
        const html = await fs.promises.readFile(productHtmlPath, 'utf8');
        res.set('Cache-Control', 'public, max-age=300');
        // SEO head first, THEN the asset rewrite — the injected <head> must be
        // in the string the rewriter sees, and its 5-min cache header is kept
        // (sendHashedHtml leaves headers alone when given pre-rendered HTML).
        return sendHashedHtml(res, productHtmlPath, productSeo.injectHead(html, head));
      }
    } catch (e) {
      console.error('[product-seo] injection failed (serving static):', e.message);
    }
  }
  sendHashedHtml(res, productHtmlPath);
}

app.get('/product', serveProductPage);
app.get('/product.html', serveProductPage);

// Product sitemap — one URL per unique style (proxy /api/all-styles, cached).
// Referenced from robots.txt; submitted in Google Search Console.
app.get('/sitemap-products.xml', async (req, res) => {
  try {
    const styles = await productSeo.listStyles();
    res.type('application/xml').send(productSeo.renderProductSitemap(styles));
  } catch (e) {
    console.error('[product-seo] sitemap failed:', e.message);
    res.status(503).send('sitemap unavailable');
  }
});
};
