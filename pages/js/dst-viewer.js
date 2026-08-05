/**
 * dst-viewer.js — NWCA Embroidery Studio (production DST viewer).
 *
 * Everything runs client-side: DSTParser (dst-parser.js) decodes the file,
 * this file renders it — realistic thread with satin sheen, flat, wireframe
 * and trace modes — on a zoomable fabric stage with mm rulers, computes
 * production estimates, drives the Robison-Anton palette (dst-palette.js),
 * composites true-scale garment mockups (dst-garments.js), and prints the
 * customer approval sheet. No backend calls; the tool works offline.
 *
 * Estimates (time/thread) are operator estimates with visible assumptions —
 * never prices. Pricing lives in the Embroidery Quote Builder (linked).
 */
(function () {
    'use strict';

    var Parser = window.DSTParser;
    var Palette = window.DSTPalette;
    var Garments = window.DSTGarments;

    /* ─── constants ─────────────────────────────────────────────────── */

    var THREAD_MM = 0.46;            // visual 40wt thread diameter (slightly fat for coverage)
    var LIGHT_ANGLE = -0.55;         // radians; sheen direction (upper-left)
    var ANGLE_BUCKETS = 10;
    var BITMAP_MAX_PX = 4096;
    var CSS_PX_PER_MM = 96 / 25.4;   // "≈1:1" zoom
    var RECENTS_KEY = 'nwca.emb-studio.recents.v1';
    var COLORS_KEY = 'nwca.emb-studio.colors.v1';
    var SETTINGS_KEY = 'nwca.emb-studio.settings.v1';
    var MAX_RECENTS = 8;
    var MAX_CACHED_DST = 300 * 1024;

    var FABRICS = [
        { name: 'Heather', hex: '#3A3E45' },
        { name: 'Black', hex: '#20232A' },
        { name: 'Navy', hex: '#1E2A44' },
        { name: 'White', hex: '#EDEDEA' },
        { name: 'Sand', hex: '#CDbfa2' },
        { name: 'Red', hex: '#8E2434' },
        { name: 'Forest', hex: '#24402F' },
        { name: 'Royal', hex: '#28519B' }
    ];

    /* ─── state ─────────────────────────────────────────────────────── */

    var state = {
        data: null,             // parsed design
        fileName: '',
        buffer: null,           // ArrayBuffer of the loaded DST (for recents)
        colors: [],             // per-run {hex, name, catalog}
        mode: 'stitch',         // stitch | flat | wire | trace
        mockup: false,
        overlays: { grid: true, density: false },
        fabric: FABRICS[0].hex,
        view: { scale: 4, tx: 0, ty: 0 },   // px per mm + screen offset of mm(0,0)
        spm: 750,
        mock: { garment: 'tee', color: '#1F2A44', placement: 'leftChest', scalePct: 100, offX: 0, offY: 0 },
        mockupTouched: false,
        usage: null,
        density: null,
        time: null
    };

    var bitmap = { canvas: null, pxPerMM: 0, mmLeft: 0, mmTop: 0, dirty: true, mode: '' };
    var densityBmp = null;
    var trace = { run: 0, stitch: 0, playing: false, raf: null, speed: 5 };
    var drag = null;
    var mockDrag = null;
    var garmentImg = null;      // resolved Image for current garment+color
    var fabricPattern = null;
    var pickerCtx = { runIndex: -1 };
    var toastTimer = null;
    var pickerFamily = 'All';
    var pickerQuery = '';

    /* ─── dom ───────────────────────────────────────────────────────── */

    function $(id) { return document.getElementById(id); }
    var stage = $('stage');
    var ctx = stage.getContext('2d');
    var stageWrap = $('stageWrap');
    var dropzone = $('dropzone');
    var fileInput = $('fileInput');

    /* ─── utils ─────────────────────────────────────────────────────── */

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function tint(hex, mult) {
        var v = parseInt(hex.slice(1), 16);
        var r = Math.min(255, Math.round(((v >> 16) & 255) * mult));
        var g = Math.min(255, Math.round(((v >> 8) & 255) * mult));
        var b = Math.min(255, Math.round((v & 255) * mult));
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    function fmtMin(min) {
        if (!isFinite(min)) return '—';
        var s = Math.round(min * 60);
        var m = Math.floor(s / 60);
        if (m >= 60) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
        return m + 'm ' + (s % 60) + 's';
    }

    function fmtIn(mm) { return (mm / 25.4).toFixed(2).replace(/\.?0+$/, '') + '"'; }

    function toast(msg, isError) {
        var el = $('toast');
        el.textContent = msg;
        el.className = 'toast visible' + (isError ? ' error' : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.className = 'toast'; }, 4200);
    }

    function store(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota — non-fatal */ }
    }
    function load(key, fallback) {
        try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
        catch (e) { return fallback; }
    }

    /* ─── file loading ──────────────────────────────────────────────── */

    function handleFile(file) {
        if (!/\.dst$/i.test(file.name)) { toast('That is not a .DST file — the Studio reads Tajima DST stitch files.', true); return; }
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                loadBuffer(e.target.result, file.name);
            } catch (err) {
                toast('Could not read this DST: ' + err.message, true);
            }
        };
        reader.onerror = function () { toast('File read failed — try again.', true); };
        reader.readAsArrayBuffer(file);
    }

    function loadBuffer(buf, name) {
        var data = Parser.parse(buf);
        state.data = data;
        state.fileName = name;
        state.buffer = buf;
        state.mockup = false;
        state.mockupTouched = false;
        state.overlays.density = false;
        densityBmp = null;
        garmentImg = null;

        assignColors();
        state.usage = Parser.estimateThreadUsage(data.colorRuns);
        state.time = Parser.estimateSewTime(data.stats, { spm: state.spm });
        state.density = Parser.computeDensity(data.points, data.bbox, { cellMM: 1, threshold: 18 });

        trace = { run: 0, stitch: 0, playing: false, raf: null, speed: trace.speed };
        bitmap.dirty = true;
        setMode('stitch', true);
        fitView();
        renderAllPanels();
        saveRecent();
        document.body.classList.add('has-design');
        draw();
        toast(name + ' — ' + data.stats.totalStitches.toLocaleString() + ' stitches, ' + data.colorRuns.length + ' colors');
    }

    /* ─── color assignment + persistence ────────────────────────────── */

    function fingerprint() {
        var d = state.data;
        return (d.header.label || state.fileName) + '|' + d.stats.totalStitches + '|' + d.colorRuns.length;
    }

    function defaultColorForRun(i) {
        // First few runs use the curated defaults; beyond that, walk the hue
        // wheel by the golden angle and snap to the nearest REAL RA thread so
        // even a 30-run file starts with distinct, orderable colors.
        if (i < Palette.DEFAULT_CATALOGS.length) {
            var c = Palette.byCatalog(Palette.DEFAULT_CATALOGS[i]);
            if (c) return c;
        }
        var hue = (i * 137.508) % 360;
        var h = hue / 60, x = 1 - Math.abs(h % 2 - 1);
        var rgb = [[1, x, 0], [x, 1, 0], [0, 1, x], [0, x, 1], [x, 0, 1], [1, 0, x]][Math.floor(h) % 6];
        var hex = '#' + rgb.map(function (v) {
            return Math.round((v * 0.72 + 0.14) * 255).toString(16).padStart(2, '0');
        }).join('');
        return Palette.nearest(hex) || Palette.byCatalog(Palette.DEFAULT_CATALOGS[0]);
    }

    function assignColors() {
        var saved = load(COLORS_KEY, {});
        var fp = fingerprint();
        var entry = saved[fp];
        state.colors = state.data.colorRuns.map(function (run, i) {
            if (entry && entry[i] && entry[i].hex) return entry[i];
            var c = defaultColorForRun(i);
            return { hex: c.hex, name: c.name, catalog: c.catalog };
        });
    }

    function persistColors() {
        var saved = load(COLORS_KEY, {});
        saved[fingerprint()] = state.colors;
        var keys = Object.keys(saved);
        if (keys.length > 40) delete saved[keys[0]];
        store(COLORS_KEY, saved);
    }

    /* ─── recents ───────────────────────────────────────────────────── */

    function bufferToB64(buf) {
        var bytes = new Uint8Array(buf);
        var chunks = [];
        for (var i = 0; i < bytes.length; i += 0x8000) {
            chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)));
        }
        return btoa(chunks.join(''));
    }

    function b64ToBuffer(b64) {
        var bin = atob(b64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes.buffer;
    }

    function makeThumb() {
        var bmp = renderDesignBitmap(Math.min(3, BITMAP_MAX_PX / Math.max(1, state.data.bbox.widthMM)), { transparent: true, mode: 'flat' });
        var t = document.createElement('canvas');
        var scale = Math.min(120 / bmp.canvas.width, 90 / bmp.canvas.height, 1);
        t.width = Math.max(1, Math.round(bmp.canvas.width * scale));
        t.height = Math.max(1, Math.round(bmp.canvas.height * scale));
        var tc = t.getContext('2d');
        tc.drawImage(bmp.canvas, 0, 0, t.width, t.height);
        return t.toDataURL('image/png');
    }

    function saveRecent() {
        var list = load(RECENTS_KEY, []);
        var small = state.buffer.byteLength <= MAX_CACHED_DST;
        var entry = {
            name: state.fileName,
            ts: Date.now(),
            st: state.data.stats.totalStitches,
            runs: state.data.colorRuns.length,
            wMM: state.data.bbox.widthMM,
            hMM: state.data.bbox.heightMM,
            thumb: null,
            b64: small ? bufferToB64(state.buffer) : null
        };
        try { entry.thumb = makeThumb(); } catch (e) { /* thumb is optional */ }
        list = list.filter(function (r) { return r.name !== entry.name; });
        list.unshift(entry);
        list = list.slice(0, MAX_RECENTS);
        store(RECENTS_KEY, list);
        renderRecents();
    }

    function renderRecents() {
        var grid = $('recentsGrid');
        var list = load(RECENTS_KEY, []);
        grid.innerHTML = '';
        $('recentsWrap').style.display = list.length ? '' : 'none';
        list.forEach(function (r) {
            var tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'recent-tile' + (r.b64 ? '' : ' uncached');
            tile.title = r.b64 ? r.name : r.name + ' (too large to cache — re-drop the file)';
            tile.innerHTML =
                (r.thumb ? '<img alt="" src="' + r.thumb + '">' : '<span class="recent-noimg"><i class="fas fa-vector-square"></i></span>') +
                '<span class="recent-name">' + esc(r.name) + '</span>' +
                '<span class="recent-meta">' + Number(r.st).toLocaleString() + ' st · ' + fmtIn(r.wMM) + '</span>';
            tile.addEventListener('click', function () {
                if (!r.b64) { toast('That file was too large to cache — drop it again from disk.', true); return; }
                try { loadBuffer(b64ToBuffer(r.b64), r.name); }
                catch (e) { toast('Cached copy unreadable: ' + e.message, true); }
            });
            grid.appendChild(tile);
        });
    }

    /* ─── sample design generator ───────────────────────────────────── */

    function sampleDesign() {
        // Absolute mm point lists per run, converted to DST-style deltas.
        function satin(path, halfW, spacing) {
            var out = [];
            var side = 1;
            for (var s = 0; s < path.length - 1; s++) {
                var a = path[s], b = path[s + 1];
                var dx = b[0] - a[0], dy = b[1] - a[1];
                var len = Math.sqrt(dx * dx + dy * dy);
                var nx = -dy / len, ny = dx / len;
                var steps = Math.max(2, Math.round(len / spacing));
                for (var i = 0; i <= steps; i++) {
                    var t = i / steps;
                    var px = a[0] + dx * t, py = a[1] + dy * t;
                    out.push([px + nx * halfW * side, py + ny * halfW * side]);
                    side = -side;
                }
            }
            return out;
        }
        function runStitch(path, step) {
            var out = [];
            for (var s = 0; s < path.length - 1; s++) {
                var a = path[s], b = path[s + 1];
                var dx = b[0] - a[0], dy = b[1] - a[1];
                var len = Math.sqrt(dx * dx + dy * dy);
                var steps = Math.max(1, Math.round(len / step));
                for (var i = (s === 0 ? 0 : 1); i <= steps; i++) {
                    out.push([a[0] + dx * i / steps, a[1] + dy * i / steps]);
                }
            }
            return out;
        }
        var runs = [];
        // Satin pitch: one crossing every 0.21 mm ⇒ 0.42 mm same-side spacing
        // (standard satin density — renders as a solid column, not open zigzag).
        var P = 0.21;
        // N — two verticals + diagonal, 3.4 mm satin
        var N = [].concat(
            satin([[-30, -16], [-30, 16]], 1.7, P),
            satin([[-29, 15], [-13, -15]], 1.7, P),
            satin([[-12, -16], [-12, 16]], 1.7, P)
        );
        // W — 4 strokes, 3 mm satin
        var W = [].concat(
            satin([[2, 16], [9, -16]], 1.5, P),
            satin([[9, -16], [16, 10]], 1.5, P),
            satin([[16, 10], [23, -16]], 1.5, P),
            satin([[23, -16], [30, 16]], 1.5, P)
        );
        // Border — 2.4 mm satin ring
        var ell = [];
        for (var i = 0; i <= 180; i++) {
            var ang = i / 180 * Math.PI * 2;
            ell.push([Math.cos(ang) * 46, Math.sin(ang) * 25]);
        }
        var border = satin(ell, 1.2, P);
        runs.push(N, W, border);

        // absolute mm → delta records (0.1mm), jumps between runs, CC records
        var stitches = [];
        var cx = 0, cy = 0;
        function moveTo(x, y, type) {
            var tx = Math.round(x * 10), ty = Math.round(y * 10);
            while (tx !== cx || ty !== cy) {
                var dx = Math.max(-121, Math.min(121, tx - cx));
                var dy = Math.max(-121, Math.min(121, ty - cy));
                var moreToGo = (Math.abs(tx - cx) > 121 || Math.abs(ty - cy) > 121);
                stitches.push({ dx: dx, dy: dy, type: moreToGo ? Parser.STITCH_JUMP : type });
                cx += dx; cy += dy;
            }
            if (stitches.length === 0) stitches.push({ dx: 0, dy: 0, type: type });
        }
        runs.forEach(function (run, r) {
            moveTo(run[0][0], run[0][1], Parser.STITCH_JUMP);
            for (var i = 0; i < run.length; i++) moveTo(run[i][0], run[i][1], Parser.STITCH_NORMAL);
            if (r < runs.length - 1) stitches.push({ dx: 0, dy: 0, type: Parser.STITCH_COLOR_CHANGE });
        });

        var data = Parser.processStitches(stitches);
        data.header = { label: 'NW SAMPLE BADGE', stitchCount: stitches.length, colorCount: 3, widthMM: data.bbox.widthMM, heightMM: data.bbox.heightMM };
        return data;
    }

    function loadSample() {
        var data = sampleDesign();
        state.data = data;
        state.fileName = 'nw-sample-badge.dst';
        state.buffer = null;
        state.mockup = false;
        state.mockupTouched = false;
        state.overlays.density = false;
        densityBmp = null;
        garmentImg = null;
        assignColors();
        state.usage = Parser.estimateThreadUsage(data.colorRuns);
        state.time = Parser.estimateSewTime(data.stats, { spm: state.spm });
        state.density = Parser.computeDensity(data.points, data.bbox, { cellMM: 1, threshold: 18 });
        trace = { run: 0, stitch: 0, playing: false, raf: null, speed: trace.speed };
        bitmap.dirty = true;
        setMode('stitch', true);
        fitView();
        renderAllPanels();
        document.body.classList.add('has-design');
        draw();
        toast('Sample badge loaded — try the render modes, then “On Garment”.');
    }

    /* ─── design bitmap rendering ───────────────────────────────────── */

    function bucketOf(dx, dy) {
        var ang = Math.atan2(dy, dx);
        if (ang < 0) ang += Math.PI;
        return Math.min(ANGLE_BUCKETS - 1, Math.floor(ang / Math.PI * ANGLE_BUCKETS));
    }

    function bucketBrightness(b) {
        var ang = (b + 0.5) / ANGLE_BUCKETS * Math.PI;
        var alignment = Math.abs(Math.cos(ang - LIGHT_ANGLE));
        return 0.84 + 0.28 * Math.pow(alignment, 1.6);
    }

    function renderDesignBitmap(pxPerMM, opts) {
        opts = opts || {};
        var data = state.data;
        var bb = data.bbox;
        var padMM = THREAD_MM * 3;
        var wMM = bb.widthMM + padMM * 2, hMM = bb.heightMM + padMM * 2;
        var scaleCap = BITMAP_MAX_PX / Math.max(wMM, hMM);
        pxPerMM = Math.max(0.2, Math.min(pxPerMM, scaleCap));

        var cv = document.createElement('canvas');
        cv.width = Math.max(2, Math.ceil(wMM * pxPerMM));
        cv.height = Math.max(2, Math.ceil(hMM * pxPerMM));
        var c = cv.getContext('2d');
        if (!opts.transparent) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, cv.width, cv.height); }

        var mode = opts.mode || state.mode;
        var X = function (p) { return (p.x - bb.minX) / 10 * pxPerMM + padMM * pxPerMM; };
        var Y = function (p) { return (bb.maxY - p.y) / 10 * pxPerMM + padMM * pxPerMM; };

        c.lineCap = 'round';
        c.lineJoin = 'round';

        if (mode === 'wire') {
            // Ink adapts to what it will sit on: light lines on dark fabric,
            // dark lines on light fabric / white export.
            var onDark = opts.transparent ? (Garments.luma(state.fabric) < 140) : false;
            var wireInk = onDark ? 'rgba(214,222,232,0.85)' : 'rgba(52,58,66,0.92)';
            c.lineWidth = Math.max(0.9, pxPerMM * 0.09);
            data.colorRuns.forEach(function (run) {
                var path = new Path2D();
                var jumps = new Path2D();
                var prev = null;
                for (var i = run.startIdx; i <= run.endIdx; i++) {
                    var p = data.points[i];
                    if (p.type === Parser.STITCH_NORMAL) {
                        if (prev) {
                            if (prev.type === Parser.STITCH_NORMAL) { path.moveTo(X(prev), Y(prev)); path.lineTo(X(p), Y(p)); }
                            else { jumps.moveTo(X(prev), Y(prev)); jumps.lineTo(X(p), Y(p)); }
                        }
                        prev = p;
                    } else if (p.type === Parser.STITCH_JUMP) {
                        prev = p;
                    }
                }
                c.strokeStyle = wireInk;
                c.stroke(path);
                c.save();
                c.setLineDash([4, 4]);
                c.strokeStyle = 'rgba(255,176,60,0.8)';
                c.stroke(jumps);
                c.restore();
            });
            return { canvas: cv, pxPerMM: pxPerMM, padMM: padMM };
        }

        var w = Math.max(1.15, THREAD_MM * pxPerMM);
        data.colorRuns.forEach(function (run, runIdx) {
            var hex = (state.colors[runIdx] || { hex: '#888888' }).hex;
            var buckets = [];
            for (var b = 0; b < ANGLE_BUCKETS; b++) buckets.push(null);
            var prev = null;
            for (var i = run.startIdx; i <= run.endIdx; i++) {
                var p = data.points[i];
                if (p.type !== Parser.STITCH_NORMAL) { prev = null; continue; }
                if (prev) {
                    var bi = bucketOf(X(p) - X(prev), Y(p) - Y(prev));
                    if (!buckets[bi]) buckets[bi] = new Path2D();
                    buckets[bi].moveTo(X(prev), Y(prev));
                    buckets[bi].lineTo(X(p), Y(p));
                }
                prev = p;
            }
            if (mode === 'flat') {
                c.lineWidth = Math.max(1, THREAD_MM * pxPerMM * 0.8);
                c.strokeStyle = hex;
                buckets.forEach(function (path) { if (path) c.stroke(path); });
                return;
            }
            // realistic: shadow → body (angle-shaded) → sheen
            c.save();
            c.translate(0, w * 0.26);
            c.lineWidth = w * 1.28;
            c.strokeStyle = 'rgba(0,0,0,0.30)';
            buckets.forEach(function (path) { if (path) c.stroke(path); });
            c.restore();

            for (var b2 = 0; b2 < ANGLE_BUCKETS; b2++) {
                if (!buckets[b2]) continue;
                c.lineWidth = w;
                c.strokeStyle = tint(hex, bucketBrightness(b2));
                c.stroke(buckets[b2]);
            }
            c.save();
            c.translate(0, -w * 0.18);
            for (var b3 = 0; b3 < ANGLE_BUCKETS; b3++) {
                if (!buckets[b3]) continue;
                var glow = (bucketBrightness(b3) - 0.84) / 0.28;
                c.lineWidth = w * 0.4;
                c.strokeStyle = 'rgba(255,255,255,' + (0.08 + glow * 0.22).toFixed(3) + ')';
                c.stroke(buckets[b3]);
            }
            c.restore();
        });
        return { canvas: cv, pxPerMM: pxPerMM, padMM: padMM };
    }

    function ensureBitmap() {
        var want = state.view.scale;
        var stale = bitmap.dirty || bitmap.mode !== state.mode ||
            want > bitmap.pxPerMM * 1.35 || want < bitmap.pxPerMM * 0.45;
        if (!stale) return;
        var r = renderDesignBitmap(want, { transparent: true });
        bitmap.canvas = r.canvas;
        bitmap.pxPerMM = r.pxPerMM;
        bitmap.padMM = r.padMM;
        bitmap.mode = state.mode;
        bitmap.dirty = false;
    }

    /* ─── density overlay ───────────────────────────────────────────── */

    function ensureDensityBmp() {
        if (densityBmp || !state.density) return;
        var d = state.density;
        var cv = document.createElement('canvas');
        cv.width = d.cols; cv.height = d.rows;
        var c = cv.getContext('2d');
        var img = c.createImageData(d.cols, d.rows);
        for (var r = 0; r < d.rows; r++) {
            for (var col = 0; col < d.cols; col++) {
                var v = d.cells[r * d.cols + col];
                if (!v) continue;
                var t = Math.min(1, v / Math.max(1, d.threshold * 1.4));
                var i = ((d.rows - 1 - r) * d.cols + col) * 4; // flip Y to match screen
                // teal → amber → red ramp
                img.data[i] = Math.round(40 + 215 * t);
                img.data[i + 1] = Math.round(200 - 130 * t);
                img.data[i + 2] = Math.round(190 - 160 * t);
                img.data[i + 3] = Math.round(70 + 150 * t);
            }
        }
        c.putImageData(img, 0, 0);
        densityBmp = cv;
    }

    /* ─── fabric pattern ────────────────────────────────────────────── */

    function ensureFabricPattern() {
        if (fabricPattern) return fabricPattern;
        var t = document.createElement('canvas');
        t.width = 56; t.height = 56;
        var c = t.getContext('2d');
        c.strokeStyle = 'rgba(255,255,255,0.05)';
        c.lineWidth = 1;
        for (var i = -56; i < 112; i += 7) {
            c.beginPath(); c.moveTo(i, -2); c.lineTo(i + 58, 56 + 2); c.stroke();
        }
        c.strokeStyle = 'rgba(0,0,0,0.06)';
        for (var j = -56; j < 112; j += 7) {
            c.beginPath(); c.moveTo(j + 3, -2); c.lineTo(j + 61, 58); c.stroke();
        }
        fabricPattern = ctx.createPattern(t, 'repeat');
        return fabricPattern;
    }

    /* ─── stage drawing ─────────────────────────────────────────────── */

    function resizeStage() {
        var dpr = window.devicePixelRatio || 1;
        var w = stageWrap.clientWidth, h = stageWrap.clientHeight;
        if (stage.width !== Math.round(w * dpr) || stage.height !== Math.round(h * dpr)) {
            stage.width = Math.round(w * dpr);
            stage.height = Math.round(h * dpr);
            stage.style.width = w + 'px';
            stage.style.height = h + 'px';
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { w: w, h: h };
    }

    function mmToScreen(xMM, yMM) {
        return { x: state.view.tx + xMM * state.view.scale, y: state.view.ty - yMM * state.view.scale };
    }
    function screenToMM(x, y) {
        return { x: (x - state.view.tx) / state.view.scale, y: (state.view.ty - y) / state.view.scale };
    }

    function fitView() {
        var s = resizeStage();
        var bb = state.data.bbox;
        var margin = 90;
        var scale = Math.min((s.w - margin * 2) / Math.max(1, bb.widthMM), (s.h - margin * 2) / Math.max(1, bb.heightMM));
        scale = Math.max(0.3, Math.min(scale, 60));
        state.view.scale = scale;
        var cxMM = (bb.minX / 10 + bb.maxX / 10) / 2, cyMM = (bb.minY / 10 + bb.maxY / 10) / 2;
        state.view.tx = s.w / 2 - cxMM * scale;
        state.view.ty = s.h / 2 + cyMM * scale;
        updateHud();
    }

    function draw() {
        if (state.mockup) { drawMockup(); return; }
        var s = resizeStage();
        // fabric backdrop
        ctx.fillStyle = state.fabric;
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = ensureFabricPattern();
        ctx.fillRect(0, 0, s.w, s.h);
        var vg = ctx.createRadialGradient(s.w / 2, s.h / 2, Math.min(s.w, s.h) * 0.3, s.w / 2, s.h / 2, Math.max(s.w, s.h) * 0.75);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.32)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, s.w, s.h);

        if (!state.data) { drawRulers(s); return; }

        if (state.overlays.grid) drawGrid(s);

        if (state.mode === 'trace') {
            drawTrace();
        } else {
            ensureBitmap();
            var bb = state.data.bbox;
            var topLeft = mmToScreen(bb.minX / 10 - bitmap.padMM, bb.maxY / 10 + bitmap.padMM);
            var wPx = bitmap.canvas.width / bitmap.pxPerMM * state.view.scale;
            var hPx = bitmap.canvas.height / bitmap.pxPerMM * state.view.scale;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bitmap.canvas, topLeft.x, topLeft.y, wPx, hPx);
        }

        if (state.overlays.density && state.density) {
            ensureDensityBmp();
            var d = state.density;
            var tl = mmToScreen(d.minX / 10, d.minY / 10 + d.rows * d.cellMM);
            ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = 0.85;
            ctx.drawImage(densityBmp, tl.x, tl.y, d.cols * d.cellMM * state.view.scale, d.rows * d.cellMM * state.view.scale);
            ctx.globalAlpha = 1;
            ctx.imageSmoothingEnabled = true;
            // hotspot rings
            state.density.hotspots.slice(0, 5).forEach(function (h) {
                var p = mmToScreen(state.density.minX / 10 + h.xMM, state.density.minY / 10 + h.yMM);
                ctx.beginPath();
                ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255,176,60,0.95)';
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }
        drawRulers(s);
    }

    function drawGrid(s) {
        var scale = state.view.scale;
        var minor = scale > 7, step = minor ? 1 : 10;
        var startMM = screenToMM(0, s.h), endMM = screenToMM(s.w, 0);
        ctx.lineWidth = 1;
        for (var x = Math.floor(startMM.x / step) * step; x <= endMM.x; x += step) {
            var sx = mmToScreen(x, 0).x;
            ctx.strokeStyle = (x % 10 === 0) ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)';
            ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, s.h); ctx.stroke();
        }
        for (var y = Math.floor(startMM.y / step) * step; y <= endMM.y; y += step) {
            var sy = mmToScreen(0, y).y;
            ctx.strokeStyle = (y % 10 === 0) ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)';
            ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(s.w, sy); ctx.stroke();
        }
    }

    function drawRulers(s) {
        var R = 26;
        ctx.fillStyle = 'rgba(13,16,20,0.92)';
        ctx.fillRect(0, 0, s.w, R);
        ctx.fillRect(0, 0, R, s.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, R + 0.5); ctx.lineTo(s.w, R + 0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(R + 0.5, 0); ctx.lineTo(R + 0.5, s.h); ctx.stroke();

        if (!state.data) return;
        var bb = state.data.bbox;
        var scale = state.view.scale;
        var stepMM = scale > 14 ? 5 : scale > 5 ? 10 : scale > 1.6 ? 20 : 50;
        ctx.fillStyle = 'rgba(158,168,178,0.9)';
        ctx.font = '9px "DM Mono", monospace';
        ctx.textAlign = 'center';
        var oMMx = bb.minX / 10, oMMy = bb.minY / 10;
        var startX = Math.floor((screenToMM(R, 0).x - oMMx) / stepMM) * stepMM;
        var endX = (screenToMM(s.w, 0).x - oMMx);
        for (var m = Math.max(0 - 10000, startX); m <= endX; m += stepMM) {
            var sx = mmToScreen(oMMx + m, 0).x;
            if (sx < R) continue;
            ctx.strokeStyle = 'rgba(158,168,178,0.55)';
            ctx.beginPath(); ctx.moveTo(sx, R - 7); ctx.lineTo(sx, R); ctx.stroke();
            ctx.fillText(String(Math.round(m)), sx, R - 10);
        }
        ctx.textAlign = 'left';
        var startY = Math.floor((screenToMM(0, s.h).y - oMMy) / stepMM) * stepMM;
        var endY = (screenToMM(0, R).y - oMMy);
        for (var my = Math.max(-10000, startY); my <= endY; my += stepMM) {
            var sy = mmToScreen(0, oMMy + my).y;
            if (sy < R) continue;
            ctx.strokeStyle = 'rgba(158,168,178,0.55)';
            ctx.beginPath(); ctx.moveTo(R - 7, sy); ctx.lineTo(R, sy); ctx.stroke();
            ctx.save();
            ctx.translate(12, sy);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.fillText(String(Math.round(my)), 0, 3);
            ctx.restore();
        }
        ctx.fillStyle = 'rgba(13,16,20,1)';
        ctx.fillRect(0, 0, R, R);
        ctx.fillStyle = 'rgba(158,168,178,0.75)';
        ctx.textAlign = 'center';
        ctx.fillText('mm', R / 2, R / 2 + 3);
    }

    /* ─── trace mode ────────────────────────────────────────────────── */

    function drawTrace() {
        var s = resizeStage();
        ctx.fillStyle = state.fabric;
        ctx.fillRect(0, 0, s.w, s.h);
        ctx.fillStyle = ensureFabricPattern();
        ctx.fillRect(0, 0, s.w, s.h);
        if (state.overlays.grid) drawGrid(s);

        var data = state.data;
        var runs = data.colorRuns;
        ctx.lineCap = 'round';
        for (var r = 0; r <= Math.min(trace.run, runs.length - 1); r++) {
            var run = runs[r];
            var hex = (state.colors[r] || { hex: '#999' }).hex;
            var isCurrent = r === trace.run;
            var endI = isCurrent ? Math.min(run.startIdx + trace.stitch, run.endIdx) : run.endIdx;
            ctx.strokeStyle = hex;
            ctx.globalAlpha = isCurrent ? 1 : 0.42;
            ctx.lineWidth = isCurrent ? Math.max(1.6, THREAD_MM * state.view.scale * 0.8) : Math.max(1.1, THREAD_MM * state.view.scale * 0.6);
            var path = new Path2D();
            var prev = null;
            for (var i = run.startIdx; i <= endI; i++) {
                var p = data.points[i];
                if (p.type !== Parser.STITCH_NORMAL) { prev = null; continue; }
                if (prev) {
                    var a = mmToScreen(prev.x / 10, prev.y / 10), b = mmToScreen(p.x / 10, p.y / 10);
                    path.moveTo(a.x, a.y); path.lineTo(b.x, b.y);
                }
                prev = p;
            }
            ctx.stroke(path);
        }
        ctx.globalAlpha = 1;
        // needle marker
        var curRun = runs[Math.min(trace.run, runs.length - 1)];
        var lp = data.points[Math.min(curRun.startIdx + trace.stitch, curRun.endIdx)];
        if (lp) {
            var np = mmToScreen(lp.x / 10, lp.y / 10);
            ctx.beginPath(); ctx.arc(np.x, np.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = (state.colors[curRun.colorIndex] || { hex: '#fff' }).hex;
            ctx.fill();
            ctx.lineWidth = 2.4;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
        }
        drawRulers(s);
        updateTraceUI();
    }

    function traceTogglePlay() { trace.playing ? traceStop() : traceStart(); }
    function traceStart() {
        if (!state.data) return;
        trace.playing = true;
        $('btnTracePlay').innerHTML = '<i class="fas fa-pause"></i>';
        var runs = state.data.colorRuns;
        if (trace.run >= runs.length - 1 && trace.stitch >= runs[trace.run].endIdx - runs[trace.run].startIdx) {
            trace.run = 0; trace.stitch = 0;
        }
        traceTick();
    }
    function traceStop() {
        trace.playing = false;
        $('btnTracePlay').innerHTML = '<i class="fas fa-play"></i>';
        if (trace.raf) { cancelAnimationFrame(trace.raf); trace.raf = null; }
    }
    function traceTick() {
        if (!trace.playing) return;
        var runs = state.data.colorRuns;
        var run = runs[trace.run];
        var runLen = run.endIdx - run.startIdx;
        trace.stitch += Math.max(1, Math.floor(trace.speed * trace.speed * 0.6));
        if (trace.stitch >= runLen) {
            trace.stitch = runLen;
            drawTrace(); highlightRun(trace.run);
            if (trace.run < runs.length - 1) {
                setTimeout(function () {
                    if (!trace.playing) return;
                    trace.run++; trace.stitch = 0;
                    trace.raf = requestAnimationFrame(traceTick);
                }, 420);
            } else { traceStop(); }
            return;
        }
        drawTrace(); highlightRun(trace.run);
        trace.raf = requestAnimationFrame(traceTick);
    }
    function traceStep(dir) {
        if (!state.data) return;
        traceStop();
        var runs = state.data.colorRuns;
        trace.run = Math.max(0, Math.min(trace.run + dir, runs.length - 1));
        trace.stitch = runs[trace.run].endIdx - runs[trace.run].startIdx;
        drawTrace(); highlightRun(trace.run);
    }
    function traceAll() {
        if (!state.data) return;
        traceStop();
        trace.run = state.data.colorRuns.length - 1;
        trace.stitch = state.data.colorRuns[trace.run].endIdx - state.data.colorRuns[trace.run].startIdx;
        drawTrace(); highlightRun(-1);
    }
    function traceSeek(e) {
        if (!state.data) return;
        traceStop();
        var wrap = $('traceProgressWrap');
        var pct = (e.clientX - wrap.getBoundingClientRect().left) / wrap.clientWidth;
        var runs = state.data.colorRuns;
        trace.run = Math.max(0, Math.min(Math.floor(pct * runs.length), runs.length - 1));
        trace.stitch = runs[trace.run].endIdx - runs[trace.run].startIdx;
        drawTrace(); highlightRun(trace.run);
    }
    function updateTraceUI() {
        var runs = state.data.colorRuns;
        $('traceRunLabel').textContent = 'Color ' + (trace.run + 1) + ' / ' + runs.length;
        var rl = runs[trace.run].endIdx - runs[trace.run].startIdx;
        $('traceStitchLabel').textContent = Math.min(trace.stitch, rl).toLocaleString() + ' / ' + rl.toLocaleString() + ' st';
        $('traceProgressBar').style.width = ((trace.run + 1) / runs.length * 100) + '%';
    }
    function highlightRun(idx) {
        var rows = document.querySelectorAll('#threadList .thread-row');
        rows.forEach(function (el, i) {
            el.classList.remove('active-run', 'dimmed', 'done');
            if (idx === -1) return;
            if (i === idx) el.classList.add('active-run');
            else if (i < idx) el.classList.add('done');
            else el.classList.add('dimmed');
        });
        if (idx >= 0 && rows[idx]) rows[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    /* ─── mockup stage ──────────────────────────────────────────────── */

    function currentGarment() { return Garments.byId(state.mock.garment); }

    function mockupLayout(s) {
        var g = currentGarment();
        var margin = 60;
        var scale = Math.min((s.w - margin * 2) / g.vbW, (s.h - margin * 2) / g.vbH);
        var w = g.vbW * scale, h = g.vbH * scale;
        return { g: g, scale: scale, x: (s.w - w) / 2, y: (s.h - h) / 2, w: w, h: h };
    }

    function designRectOnMockup(L) {
        var g = L.g;
        var pl = g.placements[state.mock.placement] || g.placements[g.defaultPlacement];
        var bb = state.data.bbox;
        var k = state.mock.scalePct / 100;
        var pxPerMMGarment = L.scale / g.mmPerUnit;
        var wPx = bb.widthMM * k * pxPerMMGarment;
        var hPx = bb.heightMM * k * pxPerMMGarment;
        var cx = L.x + (pl.cx + state.mock.offX / g.mmPerUnit) * L.scale;
        var cy = L.y + (pl.cy + state.mock.offY / g.mmPerUnit) * L.scale;
        return { x: cx - wPx / 2, y: cy - hPx / 2, w: wPx, h: hPx, cx: cx, cy: cy, pl: pl };
    }

    function drawMockup() {
        var s = resizeStage();
        // studio backdrop
        var bg = ctx.createLinearGradient(0, 0, 0, s.h);
        bg.addColorStop(0, '#161a20');
        bg.addColorStop(1, '#0c0f13');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, s.w, s.h);

        if (!state.data) return;
        var L = mockupLayout(s);

        if (!garmentImg) {
            Garments.getImage(state.mock.garment, state.mock.color).then(function (img) {
                garmentImg = img;
                draw();
            }).catch(function (e) { toast('Garment render failed: ' + e.message, true); });
            return;
        }
        // soft floor shadow
        ctx.save();
        ctx.filter = 'blur(14px)';
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(s.w / 2, L.y + L.h - 6, L.w * 0.34, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.drawImage(garmentImg, L.x, L.y, L.w, L.h);

        var r = designRectOnMockup(L);
        var bmpPxPerMM = (r.w / Math.max(0.001, state.data.bbox.widthMM));
        if (bitmap.dirty || bitmap.mode !== 'stitch' || Math.abs(bitmap.pxPerMM - bmpPxPerMM) / Math.max(0.001, bmpPxPerMM) > 0.4) {
            var out = renderDesignBitmap(bmpPxPerMM, { transparent: true, mode: 'stitch' });
            bitmap.canvas = out.canvas; bitmap.pxPerMM = out.pxPerMM; bitmap.padMM = out.padMM;
            bitmap.mode = 'stitch'; bitmap.dirty = false;
        }
        var padPx = bitmap.padMM * (r.w / state.data.bbox.widthMM);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = Math.max(2, r.w * 0.012);
        ctx.shadowOffsetY = 1.5;
        ctx.drawImage(bitmap.canvas, r.x - padPx, r.y - padPx, r.w + padPx * 2, r.h + padPx * 2);
        ctx.restore();

        // placement guide while dragging
        if (mockDrag) {
            ctx.strokeStyle = 'rgba(69,214,197,0.8)';
            ctx.setLineDash([6, 5]);
            ctx.lineWidth = 1.4;
            ctx.strokeRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(r.cx, r.y - 16); ctx.lineTo(r.cx, r.y + r.h + 16);
            ctx.moveTo(r.x - 16, r.cy); ctx.lineTo(r.x + r.w + 16, r.cy);
            ctx.strokeStyle = 'rgba(69,214,197,0.35)';
            ctx.stroke();
        }
        updateMockupReadout();
    }

    function updateMockupReadout() {
        var g = currentGarment();
        var pl = g.placements[state.mock.placement] || g.placements[g.defaultPlacement];
        var bb = state.data.bbox;
        var k = state.mock.scalePct / 100;
        var w = bb.widthMM * k, h = bb.heightMM * k;
        $('mockSizeLabel').textContent = fmtIn(w) + ' × ' + fmtIn(h) + '  (' + w.toFixed(0) + ' × ' + h.toFixed(0) + ' mm)';
        var off = [];
        if (Math.abs(state.mock.offX) >= 1) off.push((state.mock.offX > 0 ? '→' : '←') + fmtIn(Math.abs(state.mock.offX)));
        if (Math.abs(state.mock.offY) >= 1) off.push((state.mock.offY > 0 ? '↓' : '↑') + fmtIn(Math.abs(state.mock.offY)));
        $('mockOffsetLabel').textContent = off.length ? off.join(' ') + ' from ' + pl.label : 'centered on ' + pl.label;

        var warn = $('mockupWarning');
        if (w > pl.maxWmm + 0.5 || h > pl.maxHmm + 0.5) {
            var fitPct = Math.floor(Math.min(pl.maxWmm / bb.widthMM, pl.maxHmm / bb.heightMM) * 100);
            warn.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Design is ' + fmtIn(w) + ' wide — ' +
                esc(pl.label) + ' max is ' + fmtIn(pl.maxWmm) + ' × ' + fmtIn(pl.maxHmm) +
                '. Scale to ' + fitPct + '% or choose a larger placement.';
            warn.classList.add('visible');
        } else {
            warn.classList.remove('visible');
        }
    }

    function exportMockupPNG() {
        if (!state.data || !garmentImg) { toast('Open the mockup first.', true); return; }
        var g = currentGarment();
        var H = 1600;
        var W = Math.round(H * (g.vbW + 120) / (g.vbH + 120));
        var cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        var c = cv.getContext('2d');
        c.fillStyle = '#f5f6f7';
        c.fillRect(0, 0, W, H);
        var margin = 70;
        var scale = Math.min((W - margin * 2) / g.vbW, (H - margin * 2) / g.vbH);
        var gw = g.vbW * scale, gh = g.vbH * scale;
        var gx = (W - gw) / 2, gy = (H - gh) / 2;
        c.save();
        c.filter = 'blur(18px)';
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.beginPath(); c.ellipse(W / 2, gy + gh - 4, gw * 0.35, 22, 0, 0, Math.PI * 2); c.fill();
        c.restore();
        c.drawImage(garmentImg, gx, gy, gw, gh);

        var pl = g.placements[state.mock.placement] || g.placements[g.defaultPlacement];
        var bb = state.data.bbox;
        var k = state.mock.scalePct / 100;
        var pxPerMM = scale / g.mmPerUnit;
        var w = bb.widthMM * k * pxPerMM, h = bb.heightMM * k * pxPerMM;
        var cx = gx + (pl.cx + state.mock.offX / g.mmPerUnit) * scale;
        var cy = gy + (pl.cy + state.mock.offY / g.mmPerUnit) * scale;
        var out = renderDesignBitmap(w / Math.max(0.001, bb.widthMM), { transparent: true, mode: 'stitch' });
        var padPx = out.padMM * (w / bb.widthMM);
        c.shadowColor = 'rgba(0,0,0,0.3)';
        c.shadowBlur = 6; c.shadowOffsetY = 2;
        c.drawImage(out.canvas, cx - w / 2 - padPx, cy - h / 2 - padPx, w + padPx * 2, h + padPx * 2);
        c.shadowColor = 'transparent';
        c.fillStyle = '#8a9099';
        c.font = '22px "DM Mono", monospace';
        c.fillText('NWCA Embroidery Studio — thread colors are digital approximations', margin, H - 26);

        downloadDataURL(cv.toDataURL('image/png'), baseName() + '-' + g.id + '-mockup.png');
        toast('Mockup PNG downloaded.');
    }

    /* ─── exports / summary / approval sheet ────────────────────────── */

    function baseName() { return state.fileName.replace(/\.dst$/i, '') || 'design'; }

    function downloadDataURL(url, name) {
        var a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function exportDesignPNG() {
        if (!state.data) return;
        var pxPerMM = Math.min(12, BITMAP_MAX_PX / Math.max(1, state.data.bbox.widthMM + 4));
        var out = renderDesignBitmap(pxPerMM, { transparent: true, mode: 'stitch' });
        downloadDataURL(out.canvas.toDataURL('image/png'), baseName() + '-stitchout.png');
        toast('Stitch-out PNG downloaded (transparent background).');
    }

    function summaryText() {
        var d = state.data;
        var lines = [];
        lines.push('EMBROIDERY DESIGN SUMMARY — ' + state.fileName);
        if (d.header.label) lines.push('Design label: ' + d.header.label);
        lines.push('Size: ' + d.bbox.widthMM.toFixed(1) + ' × ' + d.bbox.heightMM.toFixed(1) + ' mm  (' + fmtIn(d.bbox.widthMM) + ' × ' + fmtIn(d.bbox.heightMM) + ')');
        lines.push('Stitches: ' + d.stats.totalStitches.toLocaleString() + '   Colors: ' + d.colorRuns.length + '   Trims: ' + d.stats.trims + '   Jumps: ' + d.stats.jumps);
        lines.push('Est. run time @ ' + state.spm + ' spm: ' + fmtMin(state.time.totalMin) + ' (estimate)');
        lines.push('Est. top thread: ' + state.usage.topM.toFixed(1) + ' m (±15%)');
        lines.push('');
        lines.push('Thread sequence:');
        state.colors.forEach(function (c, i) {
            var run = d.colorRuns[i];
            lines.push('  ' + (i + 1) + '. RA ' + c.catalog + ' ' + c.name + ' — ' +
                run.stitchCount.toLocaleString() + ' st — ' + state.usage.runs[i].topM.toFixed(1) + ' m');
        });
        if (state.density.hotspots.length) {
            lines.push('');
            lines.push('Density: peak ' + state.density.max + ' penetrations/mm² — ' + state.density.hotspots.length + ' hotspot cell(s) ≥ ' + state.density.threshold);
        }
        lines.push('');
        lines.push('Generated by NWCA Embroidery Studio');
        return lines.join('\n');
    }

    function copyTextFallback(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        return ok;
    }

    function copySummary() {
        if (!state.data) return;
        var text = summaryText();
        var done = function () { toast('Summary copied — paste into ShopWorks or an email.'); };
        var fail = function () {
            if (copyTextFallback(text)) done();
            else toast('Clipboard blocked by the browser.', true);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, fail);
        } else { fail(); }
    }

    function buildApprovalSheet() {
        if (!state.data) return;
        var d = state.data;
        $('sheetDate').textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        $('sheetFile').textContent = state.fileName;
        $('sheetLabel').textContent = d.header.label || '—';
        $('sheetSize').textContent = fmtIn(d.bbox.widthMM) + ' × ' + fmtIn(d.bbox.heightMM) + '  (' + d.bbox.widthMM.toFixed(1) + ' × ' + d.bbox.heightMM.toFixed(1) + ' mm)';
        $('sheetStitches').textContent = d.stats.totalStitches.toLocaleString();
        $('sheetColors').textContent = String(d.colorRuns.length);
        $('sheetTime').textContent = fmtMin(state.time.totalMin) + ' @ ' + state.spm + ' spm (est.)';

        var pxPerMM = Math.min(8, 1600 / Math.max(1, d.bbox.widthMM));
        var out = renderDesignBitmap(pxPerMM, { transparent: false, mode: 'stitch' });
        $('sheetDesignImg').src = out.canvas.toDataURL('image/png');

        var mw = $('sheetMockupWrap');
        if (state.mockupTouched && garmentImg) {
            var g = currentGarment();
            var cv = document.createElement('canvas');
            cv.width = 900; cv.height = Math.round(900 * g.vbH / g.vbW);
            var c = cv.getContext('2d');
            c.fillStyle = '#ffffff'; c.fillRect(0, 0, cv.width, cv.height);
            var scale = Math.min(cv.width / g.vbW, cv.height / g.vbH) * 0.94;
            var gx = (cv.width - g.vbW * scale) / 2, gy = (cv.height - g.vbH * scale) / 2;
            c.drawImage(garmentImg, gx, gy, g.vbW * scale, g.vbH * scale);
            var pl = g.placements[state.mock.placement] || g.placements[g.defaultPlacement];
            var k = state.mock.scalePct / 100;
            var pxmm = scale / g.mmPerUnit;
            var w = d.bbox.widthMM * k * pxmm, h = d.bbox.heightMM * k * pxmm;
            var cx = gx + (pl.cx + state.mock.offX / g.mmPerUnit) * scale;
            var cy = gy + (pl.cy + state.mock.offY / g.mmPerUnit) * scale;
            var ob = renderDesignBitmap(w / Math.max(0.001, d.bbox.widthMM), { transparent: true, mode: 'stitch' });
            var padPx = ob.padMM * (w / d.bbox.widthMM);
            c.drawImage(ob.canvas, cx - w / 2 - padPx, cy - h / 2 - padPx, w + padPx * 2, h + padPx * 2);
            $('sheetMockupImg').src = cv.toDataURL('image/png');
            $('sheetMockupCaption').textContent = g.label + ' · ' + (fabricNameFor(state.mock.color)) + ' · ' + pl.label +
                (state.mock.scalePct !== 100 ? ' · shown at ' + state.mock.scalePct + '%' : ' · true size');
            mw.style.display = '';
        } else {
            mw.style.display = 'none';
        }

        var rows = $('sheetThreadRows');
        rows.innerHTML = '';
        state.colors.forEach(function (c, i) {
            var run = d.colorRuns[i];
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + (i + 1) + '</td>' +
                '<td><span class="sheet-swatch" style="background:' + esc(c.hex) + '"></span></td>' +
                '<td>RA ' + esc(c.catalog) + '</td>' +
                '<td>' + esc(c.name) + '</td>' +
                '<td class="num">' + run.stitchCount.toLocaleString() + '</td>';
            rows.appendChild(tr);
        });
    }

    function fabricNameFor(hex) {
        for (var i = 0; i < Garments.FABRIC_COLORS.length; i++) {
            if (Garments.FABRIC_COLORS[i].hex.toLowerCase() === hex.toLowerCase()) return Garments.FABRIC_COLORS[i].name;
        }
        return hex;
    }

    function printSheet() {
        if (!state.data) return;
        buildApprovalSheet();
        // Give the two dataURL <img> a beat to decode before print.
        setTimeout(function () { window.print(); }, 120);
    }

    /* ─── sidebar panels ────────────────────────────────────────────── */

    function renderAllPanels() {
        renderDesignPanel();
        renderThreadList();
        renderProductionPanel();
        renderMockupPanel();
    }

    function renderDesignPanel() {
        var d = state.data;
        $('fileChipName').textContent = state.fileName;
        $('fileChipMeta').textContent = fmtIn(d.bbox.widthMM) + ' × ' + fmtIn(d.bbox.heightMM) + ' · ' + d.stats.totalStitches.toLocaleString() + ' st';
        $('tileStitches').textContent = d.stats.totalStitches.toLocaleString();
        $('tileColors').textContent = String(d.colorRuns.length);
        $('tileTrims').textContent = String(d.stats.trims);
        $('tileJumps').textContent = String(d.stats.jumps);
        $('tileSize').textContent = fmtIn(d.bbox.widthMM) + ' × ' + fmtIn(d.bbox.heightMM);
        $('tileSizeSub').textContent = d.bbox.widthMM.toFixed(1) + ' × ' + d.bbox.heightMM.toFixed(1) + ' mm';
        $('tileTime').textContent = fmtMin(state.time.totalMin);
        $('tileTimeSub').textContent = '@ ' + state.spm + ' spm · estimate';
        $('tileThread').textContent = state.usage.topM.toFixed(0) + ' m';
        $('tileDensity').textContent = state.density.max + '/mm²';
        var dTile = $('tileDensityCard');
        dTile.classList.toggle('warn', state.density.hotspots.length > 0);
        $('tileDensitySub').textContent = state.density.hotspots.length ?
            state.density.hotspots.length + ' hotspot cells' : 'no hotspots';
        $('designLabelMeta').textContent = d.header.label || '—';
        $('avgStitchMeta').textContent = d.stats.avgStitchMM.toFixed(2) + ' mm avg · ' + d.stats.maxStitchMM.toFixed(1) + ' mm max';

        var bl = $('breaksList');
        bl.innerHTML = '';
        $('breaksCount').textContent = d.breaks.length + ' events';
        d.breaks.slice(0, 400).forEach(function (b, i) {
            var el = document.createElement('div');
            el.className = 'break-item';
            var sw = b.type === 'Color Change' ?
                '<span class="mini-swatch" style="background:' + esc((state.colors[Math.min(b.colorTo, state.colors.length - 1)] || {}).hex || '#888') + '"></span>' : '';
            el.innerHTML = '<span class="break-idx">' + (i + 1) + '</span>' +
                '<span class="break-type ' + b.typeClass + '">' + sw + esc(b.type) + '</span>' +
                '<span class="break-at">st ' + b.stitchNum.toLocaleString() + '</span>';
            bl.appendChild(el);
        });
    }

    function renderThreadList() {
        var list = $('threadList');
        list.innerHTML = '';
        var d = state.data;
        var maxRun = Math.max.apply(null, d.colorRuns.map(function (r) { return r.stitchCount; }));
        d.colorRuns.forEach(function (run, i) {
            var c = state.colors[i];
            var row = document.createElement('div');
            row.className = 'thread-row';
            row.innerHTML =
                '<span class="thread-idx">' + (i + 1) + '</span>' +
                '<button type="button" class="thread-swatch" title="Change thread color" style="background:' + esc(c.hex) + '"></button>' +
                '<span class="thread-info">' +
                '<span class="thread-name">' + esc(c.name) + '</span>' +
                '<span class="thread-cat">RA ' + esc(c.catalog) + '</span>' +
                '</span>' +
                '<span class="thread-nums">' +
                '<span class="thread-st">' + run.stitchCount.toLocaleString() + ' st</span>' +
                '<span class="thread-m">' + state.usage.runs[i].topM.toFixed(1) + ' m</span>' +
                '</span>' +
                '<span class="thread-bar"><span style="width:' + Math.max(3, run.stitchCount / maxRun * 100) + '%;background:' + esc(c.hex) + '"></span></span>';
            row.querySelector('.thread-swatch').addEventListener('click', function (e) {
                e.stopPropagation();
                openPicker(i);
            });
            row.addEventListener('click', function () {
                if (state.mode === 'trace') {
                    traceStop();
                    trace.run = i;
                    trace.stitch = d.colorRuns[i].endIdx - d.colorRuns[i].startIdx;
                    drawTrace(); highlightRun(i);
                }
            });
            list.appendChild(row);
        });
        $('threadCount').textContent = d.colorRuns.length + ' runs';
    }

    function renderProductionPanel() {
        var t = state.time;
        $('spmRange').value = state.spm;
        $('spmLabel').textContent = state.spm + ' spm';
        $('tbSew').textContent = fmtMin(t.sewSec / 60);
        $('tbChanges').textContent = fmtMin(t.colorChangeSec / 60);
        $('tbTrims').textContent = fmtMin(t.trimSec / 60);
        $('tbOverhead').textContent = fmtMin(t.overheadSec / 60);
        $('tbTotal').textContent = fmtMin(t.totalMin);

        var body = $('usageBody');
        body.innerHTML = '';
        state.colors.forEach(function (c, i) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td><span class="mini-swatch" style="background:' + esc(c.hex) + '"></span> RA ' + esc(c.catalog) + '</td>' +
                '<td class="num">' + state.data.colorRuns[i].stitchCount.toLocaleString() + '</td>' +
                '<td class="num">' + state.usage.runs[i].topM.toFixed(1) + ' m</td>';
            body.appendChild(tr);
        });
        $('usageTop').textContent = state.usage.topM.toFixed(1) + ' m';
        $('usageBobbin').textContent = state.usage.bobbinM.toFixed(1) + ' m';

        $('densityMax').textContent = state.density.max + ' penetrations/mm²';
        $('densityThreshold').textContent = '≥ ' + state.density.threshold;
        var hl = $('hotspotList');
        hl.innerHTML = '';
        if (!state.density.hotspots.length) {
            hl.innerHTML = '<div class="hotspot-none"><i class="fas fa-circle-check"></i> No density hotspots — clean file.</div>';
        } else {
            state.density.hotspots.slice(0, 6).forEach(function (h) {
                var el = document.createElement('div');
                el.className = 'hotspot-item';
                el.innerHTML = '<i class="fas fa-fire"></i> ' + h.count + ' hits at (' +
                    h.xMM.toFixed(0) + ', ' + h.yMM.toFixed(0) + ') mm';
                hl.appendChild(el);
            });
            if (state.density.hotspots.length > 6) {
                var more = document.createElement('div');
                more.className = 'hotspot-more';
                more.textContent = '+ ' + (state.density.hotspots.length - 6) + ' more cells';
                hl.appendChild(more);
            }
        }
        $('btnToggleDensity').classList.toggle('on', state.overlays.density);
    }

    function renderMockupPanel() {
        var tiles = $('garmentTiles');
        tiles.innerHTML = '';
        Garments.GARMENTS.forEach(function (g) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'garment-tile' + (g.id === state.mock.garment ? ' active' : '');
            b.innerHTML = '<i class="fas ' + g.icon + '"></i><span>' + esc(g.label) + '</span>';
            b.addEventListener('click', function () {
                state.mock.garment = g.id;
                state.mock.placement = g.defaultPlacement;
                state.mock.offX = 0; state.mock.offY = 0;
                garmentImg = null;
                renderMockupPanel();
                draw();
            });
            tiles.appendChild(b);
        });

        var sw = $('mockupSwatches');
        sw.innerHTML = '';
        Garments.FABRIC_COLORS.forEach(function (f) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'fabric-dot' + (f.hex.toLowerCase() === state.mock.color.toLowerCase() ? ' active' : '');
            b.style.background = f.hex;
            b.title = f.name;
            b.addEventListener('click', function () {
                state.mock.color = f.hex;
                garmentImg = null;
                renderMockupPanel();
                draw();
            });
            sw.appendChild(b);
        });

        var chips = $('placementChips');
        chips.innerHTML = '';
        var g = currentGarment();
        Object.keys(g.placements).forEach(function (key) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'chip' + (key === state.mock.placement ? ' active' : '');
            b.textContent = g.placements[key].label;
            b.addEventListener('click', function () {
                state.mock.placement = key;
                state.mock.offX = 0; state.mock.offY = 0;
                renderMockupPanel();
                draw();
            });
            chips.appendChild(b);
        });

        $('scaleRange').value = state.mock.scalePct;
        $('scaleLabel').textContent = state.mock.scalePct + '%' + (state.mock.scalePct === 100 ? ' · true size' : '');
        if (state.data) updateMockupReadout();
    }

    /* ─── thread color picker ───────────────────────────────────────── */

    function openPicker(runIndex) {
        pickerCtx.runIndex = runIndex;
        pickerFamily = 'All';
        pickerQuery = '';
        $('pickerSearch').value = '';
        var cur = state.colors[runIndex];
        $('pickerCurrent').innerHTML =
            '<span class="mini-swatch" style="background:' + esc(cur.hex) + '"></span> Run ' + (runIndex + 1) +
            ' — ' + esc(cur.name) + ' <span class="dim">RA ' + esc(cur.catalog) + '</span>';
        renderPickerFamilies();
        renderPickerGrid();
        $('pickerOverlay').classList.add('visible');
        setTimeout(function () { $('pickerSearch').focus(); }, 40);
    }

    function closePicker() { $('pickerOverlay').classList.remove('visible'); }

    function renderPickerFamilies() {
        var bar = $('pickerFamilies');
        bar.innerHTML = '';
        ['All'].concat(Palette.FAMILIES).forEach(function (f) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'chip' + (f === pickerFamily ? ' active' : '');
            b.textContent = f;
            b.addEventListener('click', function () {
                pickerFamily = f;
                renderPickerFamilies();
                renderPickerGrid();
            });
            bar.appendChild(b);
        });
    }

    function renderPickerGrid() {
        var grid = $('pickerGrid');
        grid.innerHTML = '';
        var q = pickerQuery.toLowerCase();
        var frag = document.createDocumentFragment();
        Palette.COLORS.forEach(function (c) {
            if (pickerFamily !== 'All' && c.family !== pickerFamily) return;
            if (q && c.name.toLowerCase().indexOf(q) === -1 && c.catalog.indexOf(q) === -1) return;
            var cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'picker-cell';
            cell.innerHTML = '<span class="picker-swatch" style="background:' + esc(c.hex) + '"></span>' +
                '<span class="picker-name">' + esc(c.name) + '</span>' +
                '<span class="picker-cat">' + esc(c.catalog) + '</span>';
            cell.addEventListener('click', function () {
                state.colors[pickerCtx.runIndex] = { hex: c.hex, name: c.name, catalog: c.catalog };
                persistColors();
                bitmap.dirty = true;
                renderThreadList();
                renderProductionPanel();
                closePicker();
                draw();
            });
            frag.appendChild(cell);
        });
        grid.appendChild(frag);
    }

    /* ─── mode / overlay / view controls ────────────────────────────── */

    function setMode(mode, silent) {
        if (state.mockup && mode !== 'stitch') toggleMockup(false);
        state.mode = mode;
        bitmap.dirty = bitmap.mode !== mode;
        document.querySelectorAll('.rail-btn[data-mode]').forEach(function (b) {
            b.classList.toggle('active', b.dataset.mode === mode);
        });
        var tc = $('traceControls');
        if (mode === 'trace') {
            tc.classList.add('visible');
            setPanel('threads');
            drawTrace();
            highlightRun(trace.run);
        } else {
            tc.classList.remove('visible');
            traceStop();
            highlightRun(-1);
            if (!silent) draw();
        }
    }

    function toggleMockup(on) {
        state.mockup = (on != null) ? on : !state.mockup;
        if (state.mockup) {
            state.mockupTouched = true;
            if (state.mode === 'trace') setMode('stitch', true);
            setPanel('mockup');
        }
        $('btnMockupMode').classList.toggle('active', state.mockup);
        document.body.classList.toggle('mockup-on', state.mockup);
        draw();
    }

    function setPanel(name) {
        document.querySelectorAll('.side-tab').forEach(function (t) {
            t.classList.toggle('active', t.dataset.panel === name);
        });
        document.querySelectorAll('.side-panel').forEach(function (p) {
            p.classList.toggle('active', p.id === 'panel' + name.charAt(0).toUpperCase() + name.slice(1));
        });
    }

    function zoomAt(factor, cx, cy) {
        var before = screenToMM(cx, cy);
        state.view.scale = Math.max(0.25, Math.min(80, state.view.scale * factor));
        var after = mmToScreen(before.x, before.y);
        state.view.tx += cx - after.x;
        state.view.ty += cy - after.y;
        updateHud();
        draw();
    }

    function updateHud() {
        if (!state.data) return;
        $('statZoom').textContent = Math.round(state.view.scale / CSS_PX_PER_MM * 100) + '%';
        $('statSizeRO').textContent = state.data.bbox.widthMM.toFixed(1) + ' × ' + state.data.bbox.heightMM.toFixed(1) + ' mm';
        $('statStitchRO').textContent = state.data.stats.totalStitches.toLocaleString() + ' st';
    }

    /* ─── event wiring ──────────────────────────────────────────────── */

    function wire() {
        // uploads
        $('btnBrowse').addEventListener('click', function () { fileInput.click(); });
        $('fileChip').addEventListener('click', function () { if (state.data) fileInput.click(); });
        $('btnNewFile').addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function (e) {
            if (e.target.files.length) handleFile(e.target.files[0]);
            fileInput.value = '';
        });
        ['dragover', 'dragenter'].forEach(function (ev) {
            document.addEventListener(ev, function (e) {
                e.preventDefault();
                document.body.classList.add('dragging');
            });
        });
        ['dragleave', 'drop'].forEach(function (ev) {
            document.addEventListener(ev, function (e) {
                e.preventDefault();
                if (ev === 'drop' || e.target === document.documentElement) document.body.classList.remove('dragging');
                if (ev === 'drop' && e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
            });
        });
        $('btnSample').addEventListener('click', loadSample);
        $('btnSample2').addEventListener('click', loadSample);

        // modes + overlays
        document.querySelectorAll('.rail-btn[data-mode]').forEach(function (b) {
            b.addEventListener('click', function () { if (state.data) setMode(b.dataset.mode); });
        });
        $('btnGrid').addEventListener('click', function () {
            state.overlays.grid = !state.overlays.grid;
            $('btnGrid').classList.toggle('active', state.overlays.grid);
            draw();
        });
        $('btnDensity').addEventListener('click', function () { toggleDensity(); });
        $('btnToggleDensity').addEventListener('click', function () { toggleDensity(); });
        $('btnMockupMode').addEventListener('click', function () { if (state.data) toggleMockup(); });
        $('btnExitMockup').addEventListener('click', function () { toggleMockup(false); });

        // zoom
        $('btnZoomIn').addEventListener('click', function () { zoomAt(1.25, stage.clientWidth / 2, stage.clientHeight / 2); });
        $('btnZoomOut').addEventListener('click', function () { zoomAt(0.8, stage.clientWidth / 2, stage.clientHeight / 2); });
        $('btnZoomFit').addEventListener('click', function () { if (state.data) { fitView(); draw(); } });
        $('btnZoom11').addEventListener('click', function () {
            if (!state.data) return;
            var c = { x: stage.clientWidth / 2, y: stage.clientHeight / 2 };
            var mm = screenToMM(c.x, c.y);
            state.view.scale = CSS_PX_PER_MM;
            var after = mmToScreen(mm.x, mm.y);
            state.view.tx += c.x - after.x;
            state.view.ty += c.y - after.y;
            updateHud();
            draw();
        });

        stage.addEventListener('wheel', function (e) {
            if (!state.data || state.mockup) return;
            e.preventDefault();
            var rect = stage.getBoundingClientRect();
            zoomAt(Math.pow(1.0016, -e.deltaY), e.clientX - rect.left, e.clientY - rect.top);
        }, { passive: false });

        stage.addEventListener('pointerdown', function (e) {
            if (!state.data) return;
            var rect = stage.getBoundingClientRect();
            var x = e.clientX - rect.left, y = e.clientY - rect.top;
            if (state.mockup) {
                var L = mockupLayout({ w: stage.clientWidth, h: stage.clientHeight });
                var r = designRectOnMockup(L);
                var pad = 24;
                if (x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad) {
                    mockDrag = { x: x, y: y, offX: state.mock.offX, offY: state.mock.offY, L: L };
                    stage.setPointerCapture(e.pointerId);
                    draw();
                }
                return;
            }
            drag = { x: x, y: y, tx: state.view.tx, ty: state.view.ty };
            stage.setPointerCapture(e.pointerId);
        });
        stage.addEventListener('pointermove', function (e) {
            var rect = stage.getBoundingClientRect();
            var x = e.clientX - rect.left, y = e.clientY - rect.top;
            if (mockDrag) {
                var g = currentGarment();
                var mmPerPx = g.mmPerUnit / mockDrag.L.scale;
                state.mock.offX = mockDrag.offX + (x - mockDrag.x) * mmPerPx;
                state.mock.offY = mockDrag.offY + (y - mockDrag.y) * mmPerPx;
                draw();
                return;
            }
            if (drag) {
                state.view.tx = drag.tx + (x - drag.x);
                state.view.ty = drag.ty + (y - drag.y);
                draw();
                return;
            }
            if (state.data && !state.mockup) {
                var mm = screenToMM(x, y);
                var bb = state.data.bbox;
                var rx = mm.x - bb.minX / 10, ry = mm.y - bb.minY / 10;
                $('statPos').textContent = (rx >= -20 && rx <= bb.widthMM + 20) ?
                    'x ' + rx.toFixed(1) + '  y ' + ry.toFixed(1) + ' mm' : '—';
            }
        });
        function endDrag() {
            if (mockDrag) { mockDrag = null; updateMockupReadout(); draw(); }
            drag = null;
        }
        stage.addEventListener('pointerup', endDrag);
        stage.addEventListener('pointercancel', endDrag);
        stage.addEventListener('dblclick', function () {
            if (!state.data || state.mockup) return;
            fitView(); draw();
        });

        // sidebar tabs
        document.querySelectorAll('.side-tab').forEach(function (t) {
            t.addEventListener('click', function () {
                setPanel(t.dataset.panel);
                if (t.dataset.panel === 'mockup' && state.data && !state.mockup) toggleMockup(true);
            });
        });

        // production controls
        $('spmRange').addEventListener('input', function () {
            state.spm = parseInt(this.value, 10);
            state.time = Parser.estimateSewTime(state.data ? state.data.stats : { totalStitches: 0, colorChanges: 0, trims: 0 }, { spm: state.spm });
            store(SETTINGS_KEY, { spm: state.spm, fabric: state.fabric });
            if (state.data) { renderProductionPanel(); renderDesignPanel(); }
        });

        // fabric swatches
        var fs = $('fabricSwatches');
        FABRICS.forEach(function (f) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'fabric-dot' + (f.hex === state.fabric ? ' active' : '');
            b.style.background = f.hex;
            b.title = f.name;
            b.addEventListener('click', function () {
                state.fabric = f.hex;
                fs.querySelectorAll('.fabric-dot').forEach(function (d) { d.classList.remove('active'); });
                b.classList.add('active');
                store(SETTINGS_KEY, { spm: state.spm, fabric: state.fabric });
                if (state.mode === 'wire') bitmap.dirty = true; // wire ink adapts to fabric
                draw();
            });
            fs.appendChild(b);
        });

        // mockup controls
        $('scaleRange').addEventListener('input', function () {
            state.mock.scalePct = parseInt(this.value, 10);
            $('scaleLabel').textContent = state.mock.scalePct + '%' + (state.mock.scalePct === 100 ? ' · true size' : '');
            if (state.data) { updateMockupReadout(); draw(); }
        });
        $('btnOffsetReset').addEventListener('click', function () {
            state.mock.offX = 0; state.mock.offY = 0;
            if (state.data) { updateMockupReadout(); draw(); }
        });
        $('btnExportMockup').addEventListener('click', exportMockupPNG);
        $('mockupCustom').addEventListener('change', function () {
            var v = this.value;
            state.mock.color = v;
            garmentImg = null;
            renderMockupPanel();
            draw();
        });

        // trace
        $('btnTracePlay').addEventListener('click', traceTogglePlay);
        $('btnTracePrev').addEventListener('click', function () { traceStep(-1); });
        $('btnTraceNext').addEventListener('click', function () { traceStep(1); });
        $('btnTraceAll').addEventListener('click', traceAll);
        $('traceSpeed').addEventListener('input', function () {
            trace.speed = parseInt(this.value, 10);
            $('traceSpeedLabel').textContent = trace.speed + 'x';
        });
        $('traceProgressWrap').addEventListener('click', traceSeek);

        // exports
        $('btnExportDesign').addEventListener('click', exportDesignPNG);
        $('btnCopySummary').addEventListener('click', copySummary);
        $('btnPrintSheet').addEventListener('click', printSheet);
        $('btnResetColors').addEventListener('click', function () {
            if (!state.data) return;
            var saved = load(COLORS_KEY, {});
            delete saved[fingerprint()];
            store(COLORS_KEY, saved);
            assignColors();
            bitmap.dirty = true;
            renderThreadList();
            renderProductionPanel();
            draw();
            toast('Thread colors reset to defaults.');
        });

        // picker
        $('pickerClose').addEventListener('click', closePicker);
        $('pickerOverlay').addEventListener('click', function (e) { if (e.target === this) closePicker(); });
        var debounce = null;
        $('pickerSearch').addEventListener('input', function () {
            clearTimeout(debounce);
            var self = this;
            debounce = setTimeout(function () {
                pickerQuery = self.value.trim();
                renderPickerGrid();
            }, 120);
        });

        // keyboard
        document.addEventListener('keydown', function (e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.key === 'Escape') {
                if ($('pickerOverlay').classList.contains('visible')) { closePicker(); return; }
                if (state.mockup) { toggleMockup(false); return; }
            }
            if (!state.data) return;
            switch (e.key) {
                case '1': setMode('stitch'); break;
                case '2': setMode('flat'); break;
                case '3': setMode('wire'); break;
                case '4': setMode('trace'); break;
                case 'g': case 'G': $('btnGrid').click(); break;
                case 'd': case 'D': toggleDensity(); break;
                case 'm': case 'M': toggleMockup(); break;
                case 'f': case 'F': fitView(); draw(); break;
                case '+': case '=': zoomAt(1.25, stage.clientWidth / 2, stage.clientHeight / 2); break;
                case '-': case '_': zoomAt(0.8, stage.clientWidth / 2, stage.clientHeight / 2); break;
                case ' ':
                    if (state.mode === 'trace') { e.preventDefault(); traceTogglePlay(); }
                    break;
            }
        });

        window.addEventListener('resize', function () {
            if (state.data) draw();
        });

        // print: rebuild is done in printSheet(); ctrl+P works too if a design is loaded
        window.addEventListener('beforeprint', function () {
            if (state.data && !$('sheetDesignImg').src) buildApprovalSheet();
        });
    }

    function toggleDensity() {
        if (!state.data) return;
        state.overlays.density = !state.overlays.density;
        $('btnDensity').classList.toggle('active', state.overlays.density);
        $('btnToggleDensity').classList.toggle('on', state.overlays.density);
        if (state.mockup) toggleMockup(false); else draw();
    }

    /* ─── boot ──────────────────────────────────────────────────────── */

    var settings = load(SETTINGS_KEY, {});
    if (settings.spm) state.spm = settings.spm;
    if (settings.fabric) state.fabric = settings.fabric;

    wire();
    renderRecents();
    resizeStage();
    draw();
})();
