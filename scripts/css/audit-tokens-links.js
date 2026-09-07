// Every page that loads a migrated (CSS_LINT_SCOPE) stylesheet must load shared_components/css/tokens.css.
const fs = require('fs'), path = require('path');
const fg = require('fast-glob');
(async () => {
    const { CSS_LINT_SCOPE } = require(path.resolve('scripts/lint-css.js'));
    const inScope = new Set();
    for (const p of CSS_LINT_SCOPE) for (const f of await fg(p)) inScope.add(f.split('\\').join('/'));
    const pages = await fg(['**/*.html'], { ignore: ['node_modules/**', 'dist/**', '**/archive/**', 'test-results/**', 'tests/**', 'templates/**'] });
    let bad = 0;
    for (const p of pages) {
        const h = fs.readFileSync(p, 'utf8');
        if (/shared_components\/css\/tokens\.css/.test(h)) continue;
        const links = [...h.matchAll(/href="([^"]*\.css)[^"]*"/g)].map((m) => m[1]).filter((u) => !/^https?:/.test(u))
            .map((u) => (u.startsWith('/') ? u.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(p), u))));
        const hit = links.filter((l) => inScope.has(l));
        if (hit.length) { bad++; console.log(p, '->', hit.join(', ')); }
    }
    console.log('pages loading a migrated sheet without the tokens link:', bad);
})();
