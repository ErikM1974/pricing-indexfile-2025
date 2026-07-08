#!/usr/bin/env node
/**
 * esbuild pipeline for the quote builders (roadmap task 0.1).
 *
 * Two kinds of output, both content-hashed into /dist (git-ignored):
 *
 *  1. ENTRY BUNDLES — the per-builder ESM entry points
 *     shared_components/js/builders/{emb,scp,dtf}/index.js are bundled
 *     (IIFE, minified, sourcemapped). IIFE keeps the window.* globals the
 *     pages rely on. These grow as task 0.4 extracts modules out of the
 *     monolith builder files.
 *
 *  2. CLASSIC TRANSFORMS — every local .js/.css the three builder HTML
 *     pages reference is minified (no bundling, so top-level declarations
 *     stay global — esbuild never renames top-level symbols in transform
 *     mode, which is what keeps inline onclick="fn()" handlers working).
 *
 * The asset list is discovered by parsing the three builder HTML files, so
 * a new <script src> is picked up on the next build with no registry edit.
 *
 * dist/asset-manifest.json maps clean source URLs → hashed dist URLs;
 * server.js rewrites the builder pages from it at serve time. No manifest →
 * pages serve the original files (the build is an overlay, never a gate).
 *
 * Console stripping: console.log/debug/info are marked pure (dropped with
 * their arguments by minification); console.warn/console.error are KEPT —
 * Erik's #1 rule requires failures to stay visible, and the API-error
 * pattern in CLAUDE.md mandates console.error in catch blocks.
 *
 * Heroku: `npm run build` runs at slug-build time (devDeps still present);
 * at dyno boot `prestart` re-invokes this script, esbuild is pruned, and we
 * exit 0 fast because dist/asset-manifest.json already exists in the slug.
 *
 * Usage: node scripts/build.js [--watch] [--verbose]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { cssHasRelativeUrls } = require('../lib/asset-manifest');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const MANIFEST_PATH = path.join(DIST, 'asset-manifest.json');
const VERBOSE = process.argv.includes('--verbose');
const WATCH = process.argv.includes('--watch');

// The pages whose assets get hashed + whose <script src> tags server.js
// rewrites. Other pages keep loading the original (no-cache) source paths.
const BUILDER_HTML = [
    'quote-builders/embroidery-quote-builder.html',
    'quote-builders/screenprint-quote-builder.html',
    'quote-builders/dtf-quote-builder.html',
    'quote-builders/dtg-quote-builder.html',
];

// Per-builder ESM entry points (bundled IIFE). outbase keeps the dist path
// mirrored: dist/shared_components/js/builders/emb/index.<hash>.js
const ENTRY_POINTS = [
    'shared_components/js/builders/emb/index.js',
    'shared_components/js/builders/scp/index.js',
    'shared_components/js/builders/dtf/index.js',
    'shared_components/js/builders/dtg/index.js',
];

let esbuild;
try {
    esbuild = require('esbuild');
} catch {
    // Dyno boot after devDependency prune — the slug already carries dist/.
    if (fs.existsSync(MANIFEST_PATH)) {
        console.log('[build] esbuild unavailable; dist/asset-manifest.json present — skipping rebuild.');
        process.exit(0);
    }
    console.warn('[build] esbuild unavailable and no dist manifest — pages will serve original source paths.');
    process.exit(0);
}

/** sha256 → first 10 hex chars; deterministic, so a no-op rebuild reproduces identical names. */
function contentHash(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
}

/** Collect local /js + /css references from the builder pages (deduped, cleaned of ?v=). */
function discoverAssets() {
    const found = new Set();
    const tagRe = /(?:src|href)\s*=\s*["']([^"']+)["']/g;
    for (const rel of BUILDER_HTML) {
        const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        let m;
        while ((m = tagRe.exec(html)) !== null) {
            const raw = m[1];
            if (!raw.startsWith('/') || raw.startsWith('//')) continue; // CDN/relative/protocol
            const clean = raw.split('?')[0];
            if (!/\.(js|css)$/i.test(clean)) continue;
            if (clean.startsWith('/dist/')) continue; // already-built refs
            found.add(clean);
        }
    }
    // The ESM entries are bundled separately — exclude from classic transforms.
    for (const entry of ENTRY_POINTS) found.delete('/' + entry.replace(/\\/g, '/'));
    return [...found].sort();
}

function ensureDirFor(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/** Minify one classic script/stylesheet; returns [sourceUrl, hashedUrl] or null when skipped. */
async function buildClassicAsset(sourceUrl) {
    const absSource = path.join(ROOT, sourceUrl);
    if (!fs.existsSync(absSource)) {
        console.warn(`[build] missing on disk, tag left untouched: ${sourceUrl}`);
        return null;
    }
    const source = fs.readFileSync(absSource, 'utf8');
    const isCss = sourceUrl.toLowerCase().endsWith('.css');

    if (isCss && cssHasRelativeUrls(source)) {
        // A relative url(...) would resolve against /dist/... and 404 — leave
        // this file on its original path rather than break an image/font.
        if (VERBOSE) console.log(`[build] css has relative url() refs, skipping: ${sourceUrl}`);
        return null;
    }

    const result = await esbuild.transform(source, {
        loader: isCss ? 'css' : 'js',
        minify: true,
        sourcemap: isCss ? false : 'external',
        sourcefile: sourceUrl,
        // Keep modern syntax as-authored — transform must not downlevel
        // (a syntax rewrite is a behavior surface we don't want to test here).
        target: 'esnext',
        ...(isCss
            ? {}
            : {
                  drop: ['debugger'],
                  pure: ['console.log', 'console.debug', 'console.info'],
              }),
    });

    const hash = contentHash(result.code);
    const parsed = path.posix.parse(sourceUrl); // e.g. /shared_components/js/foo.js
    const hashedRel = path.posix.join('/dist', parsed.dir, `${parsed.name}.${hash}${parsed.ext}`);
    const absOut = path.join(ROOT, hashedRel);
    ensureDirFor(absOut);

    let code = result.code;
    if (!isCss && result.map) {
        const mapName = path.posix.basename(hashedRel) + '.map';
        code += `\n//# sourceMappingURL=${mapName}\n`;
        fs.writeFileSync(absOut + '.map', result.map);
    }
    fs.writeFileSync(absOut, code);
    if (VERBOSE) console.log(`[build] ${sourceUrl} → ${hashedRel}`);
    return [sourceUrl, hashedRel];
}

/** Bundle the per-builder ESM entries → IIFE with esbuild's own content hash. */
async function buildEntryBundles() {
    const existing = ENTRY_POINTS.filter((p) => fs.existsSync(path.join(ROOT, p)));
    if (existing.length === 0) return [];
    const result = await esbuild.build({
        absWorkingDir: ROOT,
        entryPoints: existing,
        outdir: path.join(DIST, 'shared_components/js/builders'),
        outbase: 'shared_components/js/builders',
        entryNames: '[dir]/[name].[hash]',
        bundle: true,
        format: 'iife', // keeps explicit window.* assignments page-visible
        minify: true,
        sourcemap: 'linked',
        target: 'es2020',
        drop: ['debugger'],
        pure: ['console.log', 'console.debug', 'console.info'],
        metafile: true,
        logLevel: VERBOSE ? 'info' : 'warning',
    });
    const pairs = [];
    for (const [outFile, meta] of Object.entries(result.metafile.outputs)) {
        if (!meta.entryPoint || !outFile.endsWith('.js')) continue;
        const sourceUrl = '/' + meta.entryPoint.replace(/\\/g, '/');
        const hashedUrl = '/' + path.relative(ROOT, path.resolve(ROOT, outFile)).replace(/\\/g, '/');
        pairs.push([sourceUrl, hashedUrl]);
        if (VERBOSE) console.log(`[build] bundle ${sourceUrl} → ${hashedUrl}`);
    }
    return pairs;
}

async function buildOnce() {
    const started = Date.now();
    // Rebuild dist from scratch so stale hashes never linger. Safety: only
    // ever remove the repo-local dist directory.
    if (DIST !== path.join(ROOT, 'dist')) throw new Error('refusing to clean unexpected dist path');
    fs.rmSync(DIST, { recursive: true, force: true });
    fs.mkdirSync(DIST, { recursive: true });

    const assets = discoverAssets();
    const manifestEntries = [];

    for (const sourceUrl of assets) {
        const pair = await buildClassicAsset(sourceUrl);
        if (pair) manifestEntries.push(pair);
    }
    manifestEntries.push(...(await buildEntryBundles()));

    manifestEntries.sort((a, b) => a[0].localeCompare(b[0]));
    const manifest = Object.fromEntries(manifestEntries);
    const tmp = MANIFEST_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2) + '\n');
    fs.renameSync(tmp, MANIFEST_PATH);

    console.log(
        `[build] ${manifestEntries.length} assets hashed into dist/ in ${Date.now() - started}ms` +
            ` (${assets.length} discovered, ${assets.length - manifestEntries.filter(([s]) => !s.includes('/builders/')).length} skipped)`
    );
    return manifest;
}

async function main() {
    await buildOnce();
    if (!WATCH) return;
    console.log('[build] watch mode — rebuilding on change (Ctrl+C to stop)');
    const watched = new Set([...discoverAssets().map((u) => path.join(ROOT, u))]);
    for (const entry of ENTRY_POINTS) {
        const dir = path.join(ROOT, path.dirname(entry));
        if (fs.existsSync(dir)) watched.add(dir);
    }
    for (const rel of BUILDER_HTML) watched.add(path.join(ROOT, rel));
    let timer = null;
    const queueRebuild = (what) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            console.log(`[build] change detected (${what}) — rebuilding`);
            buildOnce().catch((err) => console.error('[build] rebuild failed:', err.message));
        }, 150);
    };
    for (const target of watched) {
        try {
            fs.watch(target, { persistent: true }, (_evt, fname) => queueRebuild(fname || target));
        } catch {
            /* file may not exist yet — created files get picked up via their parent dir */
        }
    }
}

main().catch((err) => {
    console.error('[build] failed:', err);
    process.exit(1);
});
