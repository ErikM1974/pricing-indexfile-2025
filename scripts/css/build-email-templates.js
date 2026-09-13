/* Resolve the canonical email theme into inline styles. No mail is sent and
 * no provider template is updated. Edit template content in place, then run
 * node scripts/css/build-email-templates.js; --check detects stale output. */
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const postcss = require('postcss');
const ROOT = path.resolve(__dirname, '../..');
const FILES = [
    'calculators/christmas-bundle-emailjs-template.html',
    'emailjs-template-mockup-customer-approval.html',
    'pages/golf-tournament-customer-emailjs-template.html',
    'pages/golf-tournament-lead-emailjs-template.html',
];
const THEME = 'shared_components/css/email-theme.css';
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
function compile(source) {
    const dom = new JSDOM(source.trimEnd());
    const document = dom.window.document;
    if (!document.body.hasAttribute('data-email-template')) throw new Error('Email template needs its explicit theme marker.');
    const tokens = new Map();
    postcss.parse(read('shared_components/css/tokens.css')).walkDecls(decl => {
        if (decl.prop.startsWith('--')) tokens.set(decl.prop, decl.value);
    });
    function resolve(value, seen = []) {
        return value.replace(/var\((--[\w-]+)\)/g, (_, token) => {
            if (!tokens.has(token) || seen.includes(token)) throw new Error('Unresolved email token: ' + token);
            return resolve(tokens.get(token), [...seen, token]);
        });
    }
    const theme = postcss.parse(read(THEME));
    theme.walkAtRules(rule => { throw new Error('Email theme requires static rules, found @' + rule.name); });
    const assignments = [];
    const managed = new Map();
    theme.walkRules(rule => {
        const nodes = document.querySelectorAll(rule.selector);
        for (const node of nodes) for (const decl of rule.nodes) {
            if (decl.type !== 'decl') continue;
            if (decl.important) throw new Error('Email theme cannot require !important.');
            if (!managed.has(node)) managed.set(node, new Set());
            managed.get(node).add(decl.prop);
            assignments.push({ node, property: decl.prop, value: resolve(decl.value) });
        }
    });
    // Clear only theme-owned declarations before replaying source order. This
    // keeps shorthand/longhand serialization stable across repeated builds.
    for (const [node, properties] of managed) for (const property of properties) node.style.removeProperty(property);
    for (const { node, property, value } of assignments) node.style.setProperty(property, value);
    // Body-only copies used by the provider must carry their own typography.
    const output = dom.serialize().trimEnd() + '\n';
    dom.window.close();
    return output;
}
function main() {
    const check = process.argv.includes('--check');
    const pending = FILES.map(file => ({ file, source: read(file) })).map(entry => ({ ...entry, output: compile(entry.source) }));
    const changed = pending.filter(entry => entry.source !== entry.output);
    if (check && changed.length) {
        console.error('Email theme needs rebuilding: ' + changed.map(entry => entry.file).join(', '));
        process.exitCode = 1;
        return;
    }
    if (!check) for (const entry of changed) fs.writeFileSync(path.join(ROOT, entry.file), entry.output);
    console.log(check ? 'All four email templates match their shared theme.' : 'Updated ' + changed.length + ' email templates.');
}
if (require.main === module) main();
module.exports = { FILES, THEME, compile };
