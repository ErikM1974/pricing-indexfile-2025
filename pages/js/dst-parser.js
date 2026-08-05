/**
 * dst-parser.js — Tajima DST binary parser + production math (pure, no DOM).
 *
 * Used by /pages/dst-viewer.html (Embroidery Studio) in the browser and by
 * tests/unit/dst-parser.test.js under Node. Keep this file free of DOM,
 * fetch, and rendering concerns so it stays require()-able.
 *
 * Units: DST coordinates are 0.1 mm. Everything this module RETURNS in a
 * field ending in MM/Mm is real millimetres; raw point x/y stay in 0.1 mm.
 *
 * Estimates (sew time, thread usage) are labelled estimates in the UI —
 * they are physics-based approximations, not quotes, and carry no pricing.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DSTParser = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var STITCH_NORMAL = 0;
    var STITCH_JUMP = 1;
    var STITCH_COLOR_CHANGE = 3;
    var STITCH_END = 5;

    var HEADER_BYTES = 512;

    // A run of >= TRIM_JUMP_RUN consecutive jump records is treated as a trim
    // (the standard heuristic — DST has no explicit trim opcode; machines are
    // configured to trim after ~3 consecutive jumps).
    var TRIM_JUMP_RUN = 3;

    /** Parse the 512-byte ASCII header. Never throws on a short/odd header. */
    function parseHeader(buffer) {
        var len = Math.min(HEADER_BYTES, buffer.byteLength);
        var text = '';
        var bytes = new Uint8Array(buffer, 0, len);
        for (var i = 0; i < bytes.length; i++) {
            text += String.fromCharCode(bytes[i]);
        }
        function num(re) {
            var m = text.match(re);
            return m ? parseInt(m[1].trim(), 10) || 0 : 0;
        }
        var labelMatch = text.match(/LA:([^\r]*)/);
        var header = {
            label: labelMatch ? labelMatch[1].trim() : '',
            stitchCount: num(/ST:(\s*\d+)/),
            colorCount: num(/CO:(\s*\d+)/),
            xPlus: num(/\+X:(\s*\d+)/),
            xMinus: num(/-X:(\s*\d+)/),
            yPlus: num(/\+Y:(\s*\d+)/),
            yMinus: num(/-Y:(\s*\d+)/)
        };
        header.widthMM = (header.xPlus + header.xMinus) / 10;
        header.heightMM = (header.yPlus + header.yMinus) / 10;
        return header;
    }

    /**
     * Decode the 3-byte stitch records after the header.
     * Returns [{type, dx, dy}] in 0.1 mm deltas (EduTech Wiki bit mapping).
     */
    function decodeStitches(buffer) {
        if (buffer.byteLength <= HEADER_BYTES) return [];
        var data = new Uint8Array(buffer, HEADER_BYTES);
        var stitches = [];
        var i = 0;
        while (i + 3 <= data.length) {
            var b0 = data[i], b1 = data[i + 1], b2 = data[i + 2];
            i += 3;
            if (b0 === 0 && b1 === 0 && b2 === 0xF3) {
                stitches.push({ type: STITCH_END, dx: 0, dy: 0 });
                break;
            }
            var dx = 0, dy = 0;
            if (b0 & 0x01) dx += 1;  if (b0 & 0x02) dx -= 1;
            if (b0 & 0x04) dx += 9;  if (b0 & 0x08) dx -= 9;
            if (b0 & 0x80) dy += 1;  if (b0 & 0x40) dy -= 1;
            if (b0 & 0x20) dy += 9;  if (b0 & 0x10) dy -= 9;
            if (b1 & 0x01) dx += 3;  if (b1 & 0x02) dx -= 3;
            if (b1 & 0x04) dx += 27; if (b1 & 0x08) dx -= 27;
            if (b1 & 0x80) dy += 3;  if (b1 & 0x40) dy -= 3;
            if (b1 & 0x20) dy += 27; if (b1 & 0x10) dy -= 27;
            if (b2 & 0x04) dx += 81; if (b2 & 0x08) dx -= 81;
            if (b2 & 0x20) dy += 81; if (b2 & 0x10) dy -= 81;

            var type = STITCH_NORMAL;
            if ((b2 & 0xC0) === 0xC0) type = STITCH_COLOR_CHANGE;
            else if (b2 & 0x80) type = STITCH_JUMP;
            stitches.push({ type: type, dx: dx, dy: dy });
        }
        return stitches;
    }

    /**
     * Walk decoded deltas into absolute points and derive runs/breaks/stats.
     *
     * Returns {
     *   points:    [{x, y, type, colorIndex, stitchNum}]        (0.1 mm)
     *   colorRuns: [{colorIndex, startIdx, endIdx, stitchCount, lengthMM, bbox}]
     *   breaks:    [{type, typeClass, stitchNum, colorFrom, colorTo, x, y}]
     *   trims:     [{stitchNum, x, y, jumpCount}]
     *   stats:     {totalStitches, jumps, trims, colorChanges, totalColors,
     *               lengthMM, avgStitchMM, maxStitchMM}
     *   bbox:      {minX..maxY, widthMM, heightMM}               (points space)
     * }
     */
    function processStitches(stitches) {
        var points = [];
        var breaks = [];
        var colorRuns = [];
        var trims = [];

        var x = 0, y = 0;
        var colorIndex = 0, stitchNum = 0;
        var normalCount = 0, jumpCount = 0, ccCount = 0;
        var runStart = 0, runNormal = 0, runLen = 0;
        var runMinX = Infinity, runMinY = Infinity, runMaxX = -Infinity, runMaxY = -Infinity;
        var totalLen = 0, maxLen = 0;
        var jumpStreak = 0;
        var prevNormal = null;

        function closeRun(endIdx) {
            colorRuns.push({
                colorIndex: colorIndex,
                startIdx: runStart,
                endIdx: endIdx,
                stitchCount: runNormal,
                lengthMM: runLen / 10,
                bbox: runNormal > 0 ? {
                    minX: runMinX, minY: runMinY, maxX: runMaxX, maxY: runMaxY
                } : null
            });
        }

        for (var s = 0; s < stitches.length; s++) {
            var st = stitches[s];
            if (st.type === STITCH_END) break;
            x += st.dx; y += st.dy; stitchNum++;
            points.push({ x: x, y: y, type: st.type, colorIndex: colorIndex, stitchNum: stitchNum });

            if (st.type === STITCH_COLOR_CHANGE) {
                ccCount++;
                closeRun(points.length - 1);
                colorIndex++;
                runStart = points.length;
                runNormal = 0; runLen = 0;
                runMinX = Infinity; runMinY = Infinity; runMaxX = -Infinity; runMaxY = -Infinity;
                breaks.push({
                    type: 'Color Change', typeClass: 'type-color', stitchNum: stitchNum,
                    colorFrom: colorIndex - 1, colorTo: colorIndex, x: x, y: y
                });
                jumpStreak = 0;
                prevNormal = null;
            } else if (st.type === STITCH_JUMP) {
                jumpCount++;
                jumpStreak++;
                if (jumpStreak === TRIM_JUMP_RUN) {
                    trims.push({ stitchNum: stitchNum, x: x, y: y, jumpCount: jumpStreak });
                }
                if (points.length <= 1 || points[points.length - 2].type !== STITCH_JUMP) {
                    breaks.push({
                        type: 'Jump', typeClass: 'type-jump', stitchNum: stitchNum,
                        colorFrom: colorIndex, colorTo: colorIndex, x: x, y: y
                    });
                }
                prevNormal = null;
            } else {
                normalCount++;
                runNormal++;
                jumpStreak = 0;
                if (x < runMinX) runMinX = x; if (x > runMaxX) runMaxX = x;
                if (y < runMinY) runMinY = y; if (y > runMaxY) runMaxY = y;
                if (prevNormal) {
                    var dxl = x - prevNormal.x, dyl = y - prevNormal.y;
                    var seg = Math.sqrt(dxl * dxl + dyl * dyl);
                    totalLen += seg; runLen += seg;
                    if (seg > maxLen) maxLen = seg;
                }
                prevNormal = { x: x, y: y };
            }
        }
        if (points.length > runStart || colorRuns.length === 0) {
            closeRun(Math.max(points.length - 1, 0));
        }

        var bbox = pointsBBox(points);
        return {
            points: points,
            colorRuns: colorRuns,
            breaks: breaks,
            trims: trims,
            stats: {
                totalStitches: normalCount,
                jumps: jumpCount,
                trims: trims.length,
                colorChanges: ccCount,
                totalColors: colorRuns.length,
                lengthMM: totalLen / 10,
                avgStitchMM: normalCount > 1 ? (totalLen / 10) / (normalCount - 1) : 0,
                maxStitchMM: maxLen / 10
            },
            bbox: bbox
        };
    }

    /** Bounding box over NORMAL stitches (jumps excluded), in points space + mm. */
    function pointsBBox(points) {
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        var found = false;
        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            if (p.type !== STITCH_NORMAL) continue;
            found = true;
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        }
        if (!found) { minX = 0; minY = 0; maxX = 0; maxY = 0; }
        return {
            minX: minX, minY: minY, maxX: maxX, maxY: maxY,
            widthMM: (maxX - minX) / 10,
            heightMM: (maxY - minY) / 10
        };
    }

    /**
     * Sew-time estimate. All knobs visible/overridable by the caller so the
     * UI can expose them (this is an operator estimate, not a price).
     *  spm            stitches per minute while sewing (machine speed)
     *  colorChangeSec seconds per color change (needle swap on multi-needle)
     *  trimSec        seconds per trim cycle
     *  hoopSec        fixed start/finish overhead (hooping not included)
     */
    function estimateSewTime(stats, opts) {
        opts = opts || {};
        var spm = opts.spm || 750;
        var colorChangeSec = (opts.colorChangeSec != null) ? opts.colorChangeSec : 25;
        var trimSec = (opts.trimSec != null) ? opts.trimSec : 5;
        var hoopSec = (opts.hoopSec != null) ? opts.hoopSec : 60;

        var sewSec = (stats.totalStitches / spm) * 60;
        var changeSec = stats.colorChanges * colorChangeSec;
        var trimsSec = stats.trims * trimSec;
        var totalSec = sewSec + changeSec + trimsSec + hoopSec;
        return {
            sewSec: sewSec,
            colorChangeSec: changeSec,
            trimSec: trimsSec,
            overheadSec: hoopSec,
            totalSec: totalSec,
            totalMin: totalSec / 60
        };
    }

    /**
     * Thread consumption estimate per run + totals, in metres.
     * Top thread ≈ stitch path length × 1.75 (loop through fabric + take-up),
     * bobbin ≈ path length × 1.0. Industry rule-of-thumb band is ±15%;
     * the UI labels it as an estimate.
     */
    function estimateThreadUsage(colorRuns) {
        var TOP_FACTOR = 1.75;
        var BOBBIN_FACTOR = 1.0;
        var runs = [];
        var topTotal = 0, bobbinTotal = 0;
        for (var i = 0; i < colorRuns.length; i++) {
            var lenM = (colorRuns[i].lengthMM || 0) / 1000;
            var top = lenM * TOP_FACTOR;
            var bobbin = lenM * BOBBIN_FACTOR;
            topTotal += top; bobbinTotal += bobbin;
            runs.push({ runIndex: i, topM: top, bobbinM: bobbin });
        }
        return { runs: runs, topM: topTotal, bobbinM: bobbinTotal };
    }

    /**
     * Needle-penetration density on a square grid.
     *  cellMM     grid cell edge in mm (default 1)
     *  threshold  penetrations per cell flagged as a hotspot (default 18 —
     *             roughly 3+ stacked satin/fill layers at 0.4 mm spacing)
     * Returns {cellMM, cols, rows, minX, minY, cells: Uint16Array, max,
     *          hotspots: [{col,row,count,xMM,yMM}]}
     * Coordinates of hotspots are design-space mm relative to bbox min.
     */
    function computeDensity(points, bbox, opts) {
        opts = opts || {};
        var cellMM = opts.cellMM || 1;
        var threshold = opts.threshold || 18;
        var cell = cellMM * 10; // 0.1mm units
        var cols = Math.max(1, Math.ceil((bbox.maxX - bbox.minX + 1) / cell));
        var rows = Math.max(1, Math.ceil((bbox.maxY - bbox.minY + 1) / cell));
        // Cap the grid so a corrupt file cannot allocate gigabytes.
        if (cols * rows > 4000000) {
            cellMM = cellMM * Math.sqrt((cols * rows) / 4000000);
            cell = cellMM * 10;
            cols = Math.max(1, Math.ceil((bbox.maxX - bbox.minX + 1) / cell));
            rows = Math.max(1, Math.ceil((bbox.maxY - bbox.minY + 1) / cell));
        }
        var cells = new Uint16Array(cols * rows);
        var max = 0;
        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            if (p.type !== STITCH_NORMAL) continue;
            var c = Math.min(cols - 1, Math.max(0, Math.floor((p.x - bbox.minX) / cell)));
            var r = Math.min(rows - 1, Math.max(0, Math.floor((p.y - bbox.minY) / cell)));
            var idx = r * cols + c;
            if (cells[idx] < 65535) cells[idx]++;
            if (cells[idx] > max) max = cells[idx];
        }
        var hotspots = [];
        for (var r2 = 0; r2 < rows; r2++) {
            for (var c2 = 0; c2 < cols; c2++) {
                var count = cells[r2 * cols + c2];
                if (count >= threshold) {
                    hotspots.push({
                        col: c2, row: r2, count: count,
                        xMM: (c2 + 0.5) * cellMM,
                        yMM: (r2 + 0.5) * cellMM
                    });
                }
            }
        }
        hotspots.sort(function (a, b) { return b.count - a.count; });
        return {
            cellMM: cellMM, cols: cols, rows: rows,
            minX: bbox.minX, minY: bbox.minY,
            cells: cells, max: max, threshold: threshold,
            hotspots: hotspots
        };
    }

    /** One-call convenience: buffer → {header, ...processed}. Throws on garbage. */
    function parse(buffer) {
        if (!buffer || buffer.byteLength < HEADER_BYTES + 3) {
            throw new Error('File is too small to be a DST (needs a 512-byte header plus stitches).');
        }
        var header = parseHeader(buffer);
        var stitches = decodeStitches(buffer);
        var data = processStitches(stitches);
        if (data.stats.totalStitches === 0) {
            throw new Error('No stitches decoded — this does not look like a valid Tajima DST file.');
        }
        data.header = header;
        return data;
    }

    return {
        STITCH_NORMAL: STITCH_NORMAL,
        STITCH_JUMP: STITCH_JUMP,
        STITCH_COLOR_CHANGE: STITCH_COLOR_CHANGE,
        STITCH_END: STITCH_END,
        TRIM_JUMP_RUN: TRIM_JUMP_RUN,
        parseHeader: parseHeader,
        decodeStitches: decodeStitches,
        processStitches: processStitches,
        pointsBBox: pointsBBox,
        estimateSewTime: estimateSewTime,
        estimateThreadUsage: estimateThreadUsage,
        computeDensity: computeDensity,
        parse: parse
    };
}));
