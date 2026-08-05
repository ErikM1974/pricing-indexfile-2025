/**
 * monogram-name-qa.js — "Stitch Check": pre-production QA for monogram name lists.
 *
 * A misspelled or malformed name is only discovered AFTER it is stitched into a
 * garment, so every check here targets a mistake that ruins goods:
 *   - whitespace     leading/trailing/double spaces (invisible on screen, stitched in thread)
 *   - case-outlier   one ALL-CAPS / all-lowercase name in an otherwise Title Case list
 *   - duplicate      the same name twice (sometimes legit — two Jims — so warn, never block)
 *   - near-duplicate edit-distance-1/2 pairs like "Jon Smith" / "John Smith" (classic typo pair)
 *   - smart-punct    curly quotes/dashes that stitch differently than straight ones
 *   - non-ascii      é/ñ etc. — the digitizer must confirm the font has the glyph
 *   - long-name      names that will stitch tiny at standard monogram letter height
 *   - missing-size / missing-thread / missing-location  incomplete rows headed to production
 *   - unassigned     imported roster names never assigned to a row (a person gets skipped)
 *
 * Pure data-in/data-out (no DOM, no fetch) so jest can pin every rule:
 * tests/unit/monogram-name-qa.test.js. UMD like dst-palette.js.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.MonogramNameQA = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var SMART_PUNCT = '‘’‚‛“”„‟′″–—';
    var LONG_NAME_CHARS = 18;

    function cleanName(name) {
        return String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
    }

    /** Render invisible whitespace problems visibly: "␣Jim··Smith␣" */
    function visibleWhitespace(name) {
        return String(name)
            .replace(/^\s+|\s+$/g, function (ws) { return '␣'.repeat(ws.length); })
            .replace(/\s{2,}/g, function (ws) { return '·'.repeat(ws.length); });
    }

    function levenshtein(a, b) {
        a = String(a); b = String(b);
        if (a === b) return 0;
        if (!a.length) return b.length;
        if (!b.length) return a.length;
        var prev = [], cur = [], i, j;
        for (j = 0; j <= b.length; j++) prev[j] = j;
        for (i = 1; i <= a.length; i++) {
            cur[0] = i;
            for (j = 1; j <= b.length; j++) {
                cur[j] = Math.min(
                    prev[j] + 1,
                    cur[j - 1] + 1,
                    prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                );
            }
            var swap = prev; prev = cur; cur = swap;
        }
        return prev[b.length];
    }

    /**
     * Case pattern of a name. Only 'upper' and 'lower' are ever flagged as
     * outliers — 'mixed' covers legitimate McDonald / O'Brien / DeLuca and
     * must never be treated as a mistake.
     */
    function classifyCase(name) {
        var letters = String(name).replace(/[^A-Za-zÀ-ɏ]/g, '');
        if (letters.length < 2) return 'short';
        if (letters === letters.toUpperCase()) return 'upper';
        if (letters === letters.toLowerCase()) return 'lower';
        var words = String(name).split(/[\s\-]+/).filter(Boolean);
        var allTitle = words.every(function (w) {
            var ls = w.replace(/[^A-Za-zÀ-ɏ]/g, '');
            if (!ls.length) return true;
            return ls[0] === ls[0].toUpperCase() &&
                   ls.slice(1) === ls.slice(1).toLowerCase();
        });
        return allTitle ? 'title' : 'mixed';
    }

    function pushFinding(findings, code, severity, rows, message, extra) {
        var f = { code: code, severity: severity, rows: rows, message: message };
        if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) f[k] = extra[k]; } }
        findings.push(f);
    }

    /**
     * @param items   [{ row, name, size, threadColor, location }] — row is the 1-based
     *                visible row number; rows with empty names are ignored except for
     *                completeness checks on the caller's side.
     * @param context { multiThread, multiLocation, unassignedNames: [..] } — multiThread/
     *                multiLocation mean the order uses ≥2 so per-row choice is required.
     * @returns { findings: [{code, severity:'error'|'warn'|'info', rows, message, ...}],
     *            summary: {errors, warnings, infos} }
     */
    function analyze(items, context) {
        context = context || {};
        var findings = [];
        var named = (items || []).filter(function (it) { return it && cleanName(it.name).length > 0; });

        // --- whitespace (error): stitched exactly as typed ---
        var wsRows = [], wsFixes = [];
        named.forEach(function (it) {
            if (/^\s|\s$|\s{2,}/.test(it.name)) {
                wsRows.push(it.row);
                wsFixes.push({ row: it.row, from: it.name, to: cleanName(it.name) });
            }
        });
        if (wsRows.length) {
            pushFinding(findings, 'whitespace', 'error', wsRows,
                'Extra spaces get stitched into the garment: ' +
                wsFixes.map(function (f) { return 'row ' + f.row + ' “' + visibleWhitespace(f.from) + '”'; }).join(', '),
                { fixable: true, fixes: wsFixes });
        }

        // --- case outliers (warn): only unambiguous upper/lower minorities ---
        if (named.length >= 3) {
            var counts = { upper: [], lower: [], title: [], mixed: [], short: [] };
            named.forEach(function (it) { counts[classifyCase(it.name)].push(it.row); });
            var majority = counts.title.length + counts.mixed.length;
            ['upper', 'lower'].forEach(function (pattern) {
                var rows = counts[pattern];
                if (rows.length && rows.length <= named.length * 0.3 && majority > named.length * 0.5) {
                    pushFinding(findings, 'case-outlier', 'warn', rows,
                        (pattern === 'upper' ? 'ALL CAPS' : 'all lowercase') +
                        ' while most of the list is capitalized normally (row ' + rows.join(', ') +
                        ') — stitched exactly as typed');
                }
            });
        }

        // --- exact duplicates (warn): may be two real people, so never an error ---
        var byNorm = {};
        named.forEach(function (it) {
            var key = cleanName(it.name).toLowerCase();
            (byNorm[key] = byNorm[key] || []).push(it);
        });
        Object.keys(byNorm).forEach(function (key) {
            var group = byNorm[key];
            if (group.length > 1) {
                pushFinding(findings, 'duplicate', 'warn',
                    group.map(function (it) { return it.row; }),
                    '“' + cleanName(group[0].name) + '” appears ' + group.length +
                    ' times (rows ' + group.map(function (it) { return it.row; }).join(', ') +
                    ') — fine if two people share the name');
            }
        });

        // --- near-duplicates (warn): the classic Jon/John typo pair ---
        var normList = Object.keys(byNorm);
        for (var i = 0; i < normList.length; i++) {
            for (var j = i + 1; j < normList.length; j++) {
                var a = normList[i], b = normList[j];
                var maxLen = Math.max(a.length, b.length);
                var threshold = maxLen >= 8 ? 2 : (maxLen >= 4 ? 1 : 0);
                if (!threshold) continue;
                var d = levenshtein(a, b);
                if (d > 0 && d <= threshold) {
                    var rowsAB = byNorm[a].concat(byNorm[b]).map(function (it) { return it.row; });
                    pushFinding(findings, 'near-duplicate', 'warn', rowsAB,
                        '“' + cleanName(byNorm[a][0].name) + '” and “' +
                        cleanName(byNorm[b][0].name) + '” differ by ' + d +
                        ' letter' + (d > 1 ? 's' : '') + ' (rows ' + rowsAB.join(', ') +
                        ') — double-check one isn’t a typo of the other');
                }
            }
        }

        // --- smart punctuation (warn) and other non-ASCII (info) ---
        var smartRows = [], nonAsciiRows = [], nonAsciiChars = {};
        named.forEach(function (it) {
            var name = String(it.name);
            var hasSmart = false, hasOther = false;
            for (var c = 0; c < name.length; c++) {
                var ch = name[c];
                if (SMART_PUNCT.indexOf(ch) !== -1) { hasSmart = true; }
                else if (ch.charCodeAt(0) > 126) { hasOther = true; nonAsciiChars[ch] = true; }
            }
            if (hasSmart) smartRows.push(it.row);
            if (hasOther) nonAsciiRows.push(it.row);
        });
        if (smartRows.length) {
            pushFinding(findings, 'smart-punct', 'warn', smartRows,
                'Curly quote/dash characters (rows ' + smartRows.join(', ') +
                ') stitch differently than straight ones — confirm which the customer wants');
        }
        if (nonAsciiRows.length) {
            pushFinding(findings, 'non-ascii', 'info', nonAsciiRows,
                'Special characters ' + Object.keys(nonAsciiChars).map(function (ch) { return '“' + ch + '”'; }).join(' ') +
                ' (rows ' + nonAsciiRows.join(', ') + ') — confirm the embroidery font includes these glyphs');
        }

        // --- long names (info): stitch small at standard monogram letter height ---
        var longRows = named.filter(function (it) { return cleanName(it.name).length > LONG_NAME_CHARS; })
                            .map(function (it) { return it.row; });
        if (longRows.length) {
            pushFinding(findings, 'long-name', 'info', longRows,
                'Over ' + LONG_NAME_CHARS + ' characters (rows ' + longRows.join(', ') +
                ') — letters will stitch small; confirm sizing with the digitizer');
        }

        // --- completeness: a named row headed to production with blanks ---
        var noSize = named.filter(function (it) { return !String(it.size || '').trim(); })
                          .map(function (it) { return it.row; });
        if (noSize.length) {
            pushFinding(findings, 'missing-size', 'error', noSize,
                'Name entered but no size picked (rows ' + noSize.join(', ') + ')');
        }
        if (context.multiThread) {
            var noThread = named.filter(function (it) { return !String(it.threadColor || '').trim(); })
                                .map(function (it) { return it.row; });
            if (noThread.length) {
                pushFinding(findings, 'missing-thread', 'warn', noThread,
                    'Multiple thread colors on this order but rows ' + noThread.join(', ') +
                    ' don’t say which one');
            }
        }
        if (context.multiLocation) {
            var noLoc = named.filter(function (it) { return !String(it.location || '').trim(); })
                             .map(function (it) { return it.row; });
            if (noLoc.length) {
                pushFinding(findings, 'missing-location', 'warn', noLoc,
                    'Multiple locations on this order but rows ' + noLoc.join(', ') +
                    ' don’t say which one');
            }
        }

        // --- unassigned imported names: a person simply gets skipped ---
        var unassigned = (context.unassignedNames || []).filter(function (n) { return cleanName(n).length > 0; });
        if (unassigned.length) {
            pushFinding(findings, 'unassigned', 'warn', [],
                unassigned.length + ' imported name' + (unassigned.length > 1 ? 's are' : ' is') +
                ' not assigned to any row: ' +
                unassigned.slice(0, 5).map(function (n) { return '“' + cleanName(n) + '”'; }).join(', ') +
                (unassigned.length > 5 ? ' …' : ''));
        }

        var summary = { errors: 0, warnings: 0, infos: 0 };
        findings.forEach(function (f) {
            if (f.severity === 'error') summary.errors++;
            else if (f.severity === 'warn') summary.warnings++;
            else summary.infos++;
        });
        return { findings: findings, summary: summary };
    }

    /**
     * Machine run plan: group named items by thread color so the operator sews
     * all of one thread before changing cones. Preserves the caller's item
     * order within each group (caller pre-sorts style→color→size).
     * Items with no thread go first under '' so they're resolved before the run starts.
     * @returns { groups: [{thread, items, count}], threadChanges, totalNames }
     */
    function buildRunPlan(items) {
        var named = (items || []).filter(function (it) { return it && cleanName(it.name).length > 0; });
        var order = [], byThread = {};
        named.forEach(function (it) {
            var thread = String(it.threadColor || '').trim();
            if (!Object.prototype.hasOwnProperty.call(byThread, thread)) {
                byThread[thread] = [];
                order.push(thread);
            }
            byThread[thread].push(it);
        });
        order.sort(function (a, b) {
            if (a === '') return -1;
            if (b === '') return 1;
            return a.localeCompare(b);
        });
        var groups = order.map(function (thread) {
            return { thread: thread, items: byThread[thread], count: byThread[thread].length };
        });
        return {
            groups: groups,
            threadChanges: Math.max(0, groups.length - 1),
            totalNames: named.length
        };
    }

    return {
        analyze: analyze,
        cleanName: cleanName,
        visibleWhitespace: visibleWhitespace,
        levenshtein: levenshtein,
        classifyCase: classifyCase,
        buildRunPlan: buildRunPlan,
        LONG_NAME_CHARS: LONG_NAME_CHARS
    };
}));
