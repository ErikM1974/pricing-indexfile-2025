const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');

test('runtime CSS census includes aliases, dynamic styles and explicitly served archives', () => {
    const report = JSON.parse(execFileSync(process.execPath, ['scripts/css/runtime-inventory.js'], {
        cwd: ROOT, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024, timeout: 30000,
    }));
    const sources = new Map(report.surfaces.map(surface => [surface.source, surface]));
    const tracked = execFileSync('git', ['ls-files', '*.html'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
    expect(sources.size).toBe(tracked.length);
    expect(sources.get('pages/catalog.html').aliases).toEqual(expect.arrayContaining(['/catalog', '/catalog.html']));
    expect(sources.get('staff-dashboard-v3/index.html').aliases).toEqual(expect.arrayContaining(['/staff-dashboard.html','/staff-dashboard-v3/']));
    expect(sources.get('calculators/archive/seasonal-2025/breast-cancer-awareness-bundle.html')).toMatchObject({ kind: 'served-archive', status: 'pending' });
    expect(sources.get('pages/golf-tournament-customer-emailjs-template.html').kind).toBe('email');
    expect(sources.get('pages/quote-view.html').dynamicStyles).toContain('shared_components/css/garment-submit-form.css');
    const invoice = sources.get('quote-builders/embroidery-quote-builder.html').runtimeOwners.find(owner => owner.source === 'shared_components/js/embroidery-quote-invoice.js');
    expect(invoice.generatedStyles).toBe(true);
    expect(sources.get('dashboards/design-gallery.html')).toMatchObject({ missingStyles: [], cssParseErrors: [] });
    expect(report.serverGeneratedOwners.flatMap(group => group.owners)).toContain('lib/blog-templates.js');
}, 40000);
