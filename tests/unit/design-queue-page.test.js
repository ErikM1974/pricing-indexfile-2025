/**
 * Design Queue — 2026-09-05 review locks.
 *   Already well built (createElement only, aria-pressed filter chips). Fixes: the three verdict
 *   tiles are filter buttons synced with the chips; every load failure (queue, briefs, store
 *   metrics) shows the reason and a Retry instead of "refresh"; icons decorative; banner close
 *   typed; dead heldBy() removed.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const html = read('dashboards/design-queue.html').replace(/<!--[\s\S]*?-->/g, '');
const queue = read('dashboards/js/design-queue.js');
const briefs = read('dashboards/js/design-queue-briefs.js');
const metrics = read('dashboards/js/design-queue-metrics.js');
const css = read('dashboards/css/design-queue.css');

test('design queue — structure', () => {
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
    expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
    expect(html).not.toMatch(/style="/);
    expect(html).toMatch(/<button type="button" class="dash-error-banner-close" aria-label="Dismiss">/);
    expect((html.match(/class="dash-stat-card[^"]*dq-stat-btn" data-filter="(draw|research|skip)" aria-pressed="false"/g) || []).length).toBe(3);
    expect(html).toMatch(/id="queue-root" class="dash-loading" role="status"/);
    expect(css).toMatch(/^\[hidden\] \{ display: none !important; \}/m);
    expect(css).toMatch(/\.dq-stat-btn\[aria-pressed="true"\]/);
});

test('design queue — tiles filter and stay in sync; retries everywhere; no dead code', () => {
    expect(queue).toMatch(/state\.filter = \(state\.filter === key\) \? 'all' : key;/);
    expect(queue).toMatch(/t\.setAttribute\('aria-pressed', String\(state\.filter === t\.dataset\.filter\)\);/);
    expect(queue).toMatch(/function boot\(\)/);
    expect(queue).toMatch(/retry\.addEventListener\('click', function \(\) \{ DashPage\.hideError\(\); boot\(\); \}\);/);
    expect(queue).not.toMatch(/function heldBy\(/);
    expect(queue).not.toMatch(/innerHTML = ['"`][^'"`]+\$\{/); // textContent-only renderer
    expect(briefs).toMatch(/function load\(root\)/);
    expect(briefs).toMatch(/retry\.addEventListener\('click', function \(\) \{ load\(root\); \}\);/);
    expect(metrics).toMatch(/retry\.addEventListener\('click', function \(\) \{ load\(true\); \}\);/);
    for (const f of [queue, briefs, metrics]) {
        expect(f).not.toMatch(/style="/);
        expect(f).not.toMatch(/\.style\./);
        expect(f).not.toMatch(/onerror=/);
    }
});
