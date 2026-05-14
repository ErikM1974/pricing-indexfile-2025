#!/usr/bin/env node
/**
 * One-shot: read the 9 hardcoded legacy policy HTML files and dump clean
 * Body_HTML strings for direct insert into the Caspio Policies table.
 *
 * Each file follows the same shape: full HTML page with styling +
 * a single `.policy-container` block that holds the actual policy text.
 * We isolate that block, strip class/style/id attributes, drop scripts/
 * styles/Font Awesome icons, and keep only semantic markup.
 *
 * Output: scripts/legacy-policies.json — array of objects ready for the
 * /api/policies POST endpoint (or direct Caspio inserts).
 *
 * Usage: node scripts/extract-legacy-policies.js
 */
const fs = require('fs');
const path = require('path');

const FILES = [
    { policyId: 'dtg-artwork-checklist',          file: 'policies/dtg-artwork-checklist.html',            category: 'Operations', title: 'DTG Artwork Information Checklist',          summary: 'Complete guide for customer intake and artwork preparation for Direct-to-Garment printing. Includes 5-phase playbook.', ownerName: 'Art Department', ownerEmail: 'art@nwcustomapparel.com',  sortOrder: 100 },
    { policyId: 'pricing-negotiation-policy',     file: 'pages/pricing-negotiation-policy.html',          category: 'Financial',  title: 'Pricing Negotiation Strategy & Policy',      summary: 'Critical strategies for defending pricing and maintaining profitability with scripts.',                                  ownerName: 'Erik M.',        ownerEmail: 'erik@nwcustomapparel.com', sortOrder: 110 },
    { policyId: 'sales-office-procedures',        file: 'policies/sales-office-procedures.html',          category: 'Operations', title: 'Sales & Office Procedures',                  summary: 'Comprehensive office standards including punctuality, customer service protocols, and phone policies.',                  ownerName: 'Erik M.',        ownerEmail: 'erik@nwcustomapparel.com', sortOrder: 120 },
    { policyId: 'retail-vs-wholesale-pricing-policy', file: 'policies/retail-vs-wholesale-pricing-policy.html', category: 'Financial', title: 'Retail vs. Wholesale Pricing Policy',    summary: 'Essential understanding of our two business models and different pricing strategies.',                                   ownerName: 'Erik M.',        ownerEmail: 'erik@nwcustomapparel.com', sortOrder: 130 },
    { policyId: 'bundle-kitting-xmas-2025',       file: 'policies/bundle-kitting-xmas-2025.html',         category: 'Operations', title: 'Christmas Bundle Kitting Process 2025',      summary: 'Step-by-step workflow for producing and assembling customer gift bundles.',                                              ownerName: 'Ruth N.',        ownerEmail: 'ruth@nwcustomapparel.com', sortOrder: 140 },
    { policyId: 'payment-terms',                  file: 'policies/payment-terms.html',                    category: 'Financial',  title: 'Payment Terms Guide',                        summary: 'Comprehensive guide to all payment terms including Net terms and special cases.',                                        ownerName: 'Erik M.',        ownerEmail: 'erik@nwcustomapparel.com', sortOrder: 150 },
    { policyId: 'ltm-fee-policy',                 file: 'policies/ltm-fee-policy.html',                   category: 'Financial',  title: 'Less Than Minimum (LTM) Fee Policy',         summary: 'Essential guide for applying the $50 LTM fee on orders under minimums.',                                                 ownerName: 'Erik M.',        ownerEmail: 'erik@nwcustomapparel.com', sortOrder: 160 },
    { policyId: 'ltm-order-decision-algorithm',   file: 'policies/ltm-order-decision-algorithm.html',     category: 'Operations', title: 'LTM Order Decision Algorithm',               summary: 'Comprehensive framework for AEs to handle Less-Than-Minimum order inquiries.',                                           ownerName: 'Erik M.',        ownerEmail: 'erik@nwcustomapparel.com', sortOrder: 170 },
    { policyId: 'customer-notification-sop',      file: 'policies/customer-notification-sop.html',        category: 'Operations', title: 'Customer Notification for Order Pickup',     summary: 'Standard operating procedure for notifying customers when orders are ready.',                                            ownerName: 'Office Admin',   ownerEmail: '',                          sortOrder: 180 }
];

const HERE = path.resolve(__dirname, '..');

// -------------------- helpers --------------------

// Find the inner content of ONE specific tag occurrence (after `startIndex`),
// balancing opens/closes of the same tag name. Returns { inner, end }.
function balancedExtract(html, tag, openTagMatchStart, openTagMatchEnd) {
    const start = openTagMatchEnd;
    const tagOpen = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    const tagClose = new RegExp(`</${tag}\\s*>`, 'gi');
    let depth = 1;
    let i = start;
    while (depth > 0 && i < html.length) {
        tagOpen.lastIndex = i;
        tagClose.lastIndex = i;
        const o = tagOpen.exec(html);
        const c = tagClose.exec(html);
        if (!c) break;
        if (o && o.index < c.index) {
            depth++;
            i = o.index + o[0].length;
        } else {
            depth--;
            if (depth === 0) {
                return { inner: html.slice(start, c.index), end: c.index + c[0].length };
            }
            i = c.index + c[0].length;
        }
    }
    return null;
}

// Find ALL matches for the given class selectors across the document,
// return the LARGEST inner block. Different policy files use different
// container conventions (.policy-container, .policy-content, .container).
// Picking the largest reliably skips nav headers and breadcrumb chrome.
function extractLargestByClass(html, classNames) {
    const candidates = [];
    for (const cls of classNames) {
        const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`<(div|main|section|article)\\b([^>]*class="[^"]*\\b${escaped}\\b[^"]*")[^>]*>`, 'gi');
        let m;
        while ((m = re.exec(html)) !== null) {
            const tag = m[1].toLowerCase();
            const openEnd = m.index + m[0].length;
            const result = balancedExtract(html, tag, m.index, openEnd);
            if (result && result.inner.length > 500) {
                candidates.push({ cls, length: result.inner.length, inner: result.inner });
            }
            // Move forward so nested matches still get picked up
            re.lastIndex = openEnd;
        }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0].inner;
}

// Strip everything we don't want in Body_HTML:
//   - <script>, <style>, <link>, <meta>, <noscript>, <!--…--> comments
//   - inline class=, style=, id=, data-*, onerror= attributes
//   - <i class="fa-..."> icons (replace with empty)
//   - Empty wrapper divs that contributed only layout
function cleanHtml(content) {
    if (!content) return '';
    let s = content;

    // Drop scripts, styles, link/meta (shouldn't be in container but be safe)
    s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    s = s.replace(/<link\b[^>]*\/?>/gi, '');
    s = s.replace(/<meta\b[^>]*\/?>/gi, '');
    s = s.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

    // HTML comments
    s = s.replace(/<!--[\s\S]*?-->/g, '');

    // Drop Font Awesome and other <i class="fa..."> icon elements entirely
    s = s.replace(/<i\b[^>]*class="[^"]*\bfa[a-z\-]*\b[^"]*"[^>]*>\s*<\/i>/gi, '');
    s = s.replace(/<i\b[^>]*class="[^"]*\bfa[a-z\-]*\b[^"]*"[^>]*\/?>/gi, '');

    // Strip back-to-hub / staff-dashboard links — chrome, not policy content
    s = s.replace(/<a\b[^>]*href="[^"]*policies-hub\.html[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');
    s = s.replace(/<a\b[^>]*href="[^"]*staff-dashboard[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');

    // Strip <button> elements wholesale — Print/Share/PDF/etc. toolbars don't
    // translate; the new detail page provides print/share through its own UI.
    s = s.replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '');

    // Strip the "Last Updated / Policy Owner / Category" meta block. We capture
    // those values in Caspio columns (Updated_At, Owner_Name, Category) and
    // render them in the detail page meta row, so duplicating them inside
    // the body is noise.
    s = s.replace(/<(?:span|div)\b[^>]*>\s*Last Updated[^<]*<\/(?:span|div)>/gi, '');
    s = s.replace(/<(?:span|div)\b[^>]*>\s*Policy Owner[^<]*<\/(?:span|div)>/gi, '');
    s = s.replace(/<(?:span|div)\b[^>]*>\s*Category[^<]*<\/(?:span|div)>/gi, '');

    // Strip class, style, id, data-*, onerror, onclick, onload from any element
    s = s.replace(/\s+(?:class|style|id|onerror|onload|onclick|onmouseover|onmouseout|tabindex|aria-[a-z\-]+|data-[a-z\-]+)="[^"]*"/gi, '');
    s = s.replace(/\s+(?:class|style|id|onerror|onload|onclick)='[^']*'/gi, '');

    // Drop empty wrappers left over after stripping chrome — multiple passes
    // because nested empties only become apparent after the inner is removed.
    for (let i = 0; i < 4; i++) {
        s = s.replace(/<div>\s*<\/div>/gi, '');
        s = s.replace(/<span>\s*<\/span>/gi, '');
        s = s.replace(/<p>\s*<\/p>/gi, '');
    }

    // Collapse multiple blank lines and trim
    s = s.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

    return s;
}

// Best-effort transformation: peel off outer wrappers that only added
// layout chrome until we get to actual content. Stops when we hit a heading
// or a meaningful element.
function unwrapLayoutDivs(html) {
    let s = html.trim();
    // Don't unwrap if there's already a clear heading near the top
    if (/^<(h1|h2|h3|p)\b/i.test(s)) return s;

    // Peel up to 4 layers of single-wrapper <div>s
    for (let i = 0; i < 4; i++) {
        const m = /^<div>([\s\S]*)<\/div>\s*$/i.exec(s.trim());
        if (!m) break;
        const inner = m[1].trim();
        // Stop if peeling would expose sibling structure (multiple top-level tags)
        const topLevelMatches = inner.match(/<(div|section|article|main|h1|h2|h3|p)\b/gi) || [];
        if (topLevelMatches.length > 8) break;
        s = inner;
    }
    return s;
}

// -------------------- main extraction --------------------

const results = [];
let totalIn = 0, totalOut = 0, errors = 0;

console.log(`Extracting ${FILES.length} legacy policy files…\n`);

for (const meta of FILES) {
    const full = path.join(HERE, meta.file);
    try {
        const raw = fs.readFileSync(full, 'utf8');
        totalIn += raw.length;

        // Collect candidates from several possible wrappers; keep the largest.
        let inner = extractLargestByClass(raw, [
            'policy-container',
            'policy-content',
            'main-content',
            'container'
        ]);

        if (!inner) {
            // Fallback: grab everything between <body...> and </body>
            const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(raw);
            if (bodyMatch) inner = bodyMatch[1];
        }

        if (!inner) {
            console.log(`  ${meta.policyId.padEnd(40)} ✗ no container found`);
            errors++;
            continue;
        }

        let cleaned = cleanHtml(inner);
        cleaned = unwrapLayoutDivs(cleaned);
        totalOut += cleaned.length;

        const oversized = cleaned.length > 64000;
        const tag = oversized ? '⚠ ' : '✓ ';
        console.log(`  ${tag}${meta.policyId.padEnd(40)} ${raw.length.toString().padStart(6)} → ${cleaned.length.toString().padStart(6)}${oversized ? '  (OVER 64K CAP)' : ''}`);

        results.push({
            Policy_ID: meta.policyId,
            Parent_Policy_ID: null,
            Category: meta.category,
            Title: meta.title,
            Summary: meta.summary,
            Body_HTML: cleaned,
            External_URL: null,
            Owner_Email: meta.ownerEmail,
            Owner_Name: meta.ownerName,
            Sort_Order: meta.sortOrder,
            Status: 'Published',
            Tags: '',
            Updated_By: 'erik@nwcustomapparel.com',
            _oversized: oversized,
            _bodyHtmlLength: cleaned.length
        });
    } catch (e) {
        console.log(`  ${meta.policyId.padEnd(40)} ✗ ${e.message}`);
        errors++;
    }
}

const outPath = path.join(__dirname, 'legacy-policies.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

console.log(`\nDone. ${results.length}/${FILES.length} extracted, ${errors} errors.`);
console.log(`Total HTML in:  ${totalIn.toLocaleString()} bytes`);
console.log(`Total HTML out: ${totalOut.toLocaleString()} bytes (${Math.round(100 * totalOut / totalIn)}%)`);
console.log(`Wrote → ${path.relative(HERE, outPath)}`);
const oversizedCount = results.filter(r => r._oversized).length;
if (oversizedCount > 0) {
    console.log(`\n⚠ ${oversizedCount} record(s) exceed Caspio Text(64000) cap — will need manual splitting.`);
}
