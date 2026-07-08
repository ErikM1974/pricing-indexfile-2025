/**
 * Push-button binding parity — 2026-06-14 regression lock (SCP + DTF).
 *
 * The always-visible "Push to ShopWorks" button (Path 1, v2026.06.14.9) is wired to
 * the ONE-CLICK flow: `scpPushToShopWorks()` / `dtfPushToShopWorks()` must AUTO-SAVE
 * first (`saveAndGetLink({skipShareModal:true})`) and only then open the push preview.
 * Those flows are `async function`s and therefore RETURN A PROMISE.
 *
 * REGRESSION GUARDED: each builder previously also declared a "back-compat alias"
 *   function scpPushToShopWorks() { return openScpPushPreview(); }
 * AFTER the async one, at the same module scope. JS function-declaration hoisting
 * makes the LAST declaration win, so the alias shadowed the async version — the button
 * called openScpPushPreview() with NO auto-save. On a never-saved quote the preview
 * early-returns (button disabled / _pushQuoteId === null), so the button silently
 * did nothing. Fix: delete the alias so only the async declaration remains.
 *
 * Two layers of defense:
 *   1. SOURCE: exactly ONE `function <name>(` declaration exists and it is `async`.
 *   2. RUNTIME: concatenate every `function <name>(` declaration block from the source
 *      in file order (faithfully reproducing hoisting) + the `window.<name> = <name>`
 *      assignment, then assert the BOUND window function returns a Promise. If the alias
 *      is ever re-added, the runtime binding resolves to it (returns a non-Promise
 *      sentinel) and this test fails.
 *
 * Mutation-verified: pasting the old alias declaration back into either builder makes
 * both the source count and the runtime Promise assertion fail.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// Extract every top-level `[async ]function NAME(...) {...}` block, in source order,
// by brace-counting from each match (same technique as scp-save-parity.test.js).
function extractAllDecls(src, name) {
    const decls = [];
    const re = new RegExp(`(async\\s+)?function\\s+${name}\\s*\\(`, 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
        const start = m.index;
        const bodyStart = src.indexOf('{', re.lastIndex - 1);
        let depth = 0;
        let end = -1;
        for (let i = bodyStart; i < src.length; i++) {
            const ch = src[i];
            if (ch === '{') depth++;
            else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        if (end === -1) throw new Error(`${name}: unbalanced braces`);
        decls.push({ isAsync: !!m[1], src: src.slice(start, end) });
        re.lastIndex = end; // continue scanning after this declaration
    }
    return decls;
}

// Concatenate the declaration block(s) + the window binding, eval with stubs, and
// return whatever is bound to window.NAME. Stubs are passed as params so a synchronous
// throw in the alias path (or any free identifier) is satisfied.
function bindWindowFn(name, decls, stubs) {
    const win = {};
    const argNames = Object.keys(stubs);
    const argVals = argNames.map(k => stubs[k]);
    const body =
        decls.map(d => d.src).join('\n') +
        `\nwindow.${name} = ${name};` +
        `\nreturn window.${name};`;
    // eslint-disable-next-line no-new-func
    const factory = new Function('window', ...argNames, body);
    return factory(win, ...argVals);
}

const isPromise = (v) => !!v && typeof v.then === 'function';

const CASES = [
    {
        method: 'SCP',
        file: 'shared_components/js/builders/scp/push.js',
        name: 'scpPushToShopWorks',
        stubs: {
            saveAndGetLink: async () => {},
            openScpPushPreview: () => 'SYNC-SENTINEL',   // alias path → non-Promise
            updateScpPushButtonState: () => {},
            document: { getElementById: () => null },
            _scpPushQuoteId: null,
            _scpPushInFlight: false,
        },
    },
    {
        method: 'DTF',
        file: 'shared_components/js/dtf-quote-builder.js',
        name: 'dtfPushToShopWorks',
        stubs: {
            dtfQuoteBuilder: { saveAndGetLink: async () => {} },
            openDtfPushPreview: () => 'SYNC-SENTINEL',    // alias path → non-Promise
            updateDtfPushButtonState: () => {},
            document: { getElementById: () => null },
            _dtfPushQuoteId: null,
            _dtfPushInFlight: false,
        },
    },
];

describe.each(CASES)('$method push-button binding (one-click auto-save)', ({ file, name, stubs }) => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const decls = extractAllDecls(src, name);

    test(`exactly one '${name}' declaration and it is async`, () => {
        expect(decls.length).toBe(1);
        expect(decls[0].isAsync).toBe(true);
    });

    test(`window.${name} is bound to the async (auto-save) version → returns a Promise`, () => {
        const fn = bindWindowFn(name, decls, stubs);
        expect(typeof fn).toBe('function');
        const ret = fn();
        expect(isPromise(ret)).toBe(true);
        return ret.catch(() => {}); // swallow — we only assert the return type
    });
});
