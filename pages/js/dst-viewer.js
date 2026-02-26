// ─── CONSTANTS ───────────────────────────────────────────
const STITCH_NORMAL = 0, STITCH_JUMP = 1, STITCH_COLOR_CHANGE = 3, STITCH_END = 5;

const THREAD_COLORS = [
  '#1a1a8b','#b0171f','#228b22','#daa520','#6a0dad',
  '#ff6347','#008b8b','#ff69b4','#cd853f','#4169e1',
  '#dc143c','#2e8b57','#ff8c00','#9400d3','#00ced1',
  '#ff1493','#8b4513','#4682b4','#d2691e','#6b8e23',
  '#c71585','#20b2aa','#db7093','#556b2f','#b22222',
  '#5f9ea0','#e9967a','#483d8b','#bc8f8f','#66cdaa',
];
const COLOR_NAMES = [
  'Navy Blue','Crimson Red','Forest Green','Goldenrod','Purple',
  'Tomato','Dark Cyan','Hot Pink','Peru','Royal Blue',
  'Deep Red','Sea Green','Dark Orange','Violet','Turquoise',
  'Deep Pink','Saddle Brown','Steel Blue','Chocolate','Olive Drab',
  'Medium Violet','Light Sea Green','Pale Violet Red','Dark Olive','Fire Brick',
  'Cadet Blue','Dark Salmon','Dark Slate Blue','Rosy Brown','Aquamarine',
];

// ─── DST PARSER ──────────────────────────────────────────
function parseDSTHeader(buffer) {
  const h = {}, s = new TextDecoder('ascii').decode(new Uint8Array(buffer, 0, 512));
  const m = (re) => { const r = s.match(re); return r ? parseInt(r[1].trim()) : 0; };
  h.label = (s.match(/LA:(.*?)\r/) || [,''])[1].trim();
  h.stitchCount = m(/ST:(\s*\d+)/);
  h.colorCount = m(/CO:(\s*\d+)/);
  h.xPlus = m(/\+X:(\s*\d+)/); h.xMinus = m(/-X:(\s*\d+)/);
  h.yPlus = m(/\+Y:(\s*\d+)/); h.yMinus = m(/-Y:(\s*\d+)/);
  h.widthMM = (h.xPlus + h.xMinus) / 10;
  h.heightMM = (h.yPlus + h.yMinus) / 10;
  return h;
}

function decodeDSTStitches(buffer) {
  const data = new Uint8Array(buffer, 512), stitches = [];
  let i = 0;
  while (i + 2 < data.length) {
    const b0 = data[i], b1 = data[i+1], b2 = data[i+2]; i += 3;
    if (b0 === 0 && b1 === 0 && b2 === 0xF3) { stitches.push({type:STITCH_END,dx:0,dy:0}); break; }

    let dx = 0, dy = 0;
    // Byte 0: bits 0-3 = X (±1,±9), bits 4-7 = Y (±9,±1) — EduTech Wiki mapping
    if (b0 & 0x01) dx += 1;  if (b0 & 0x02) dx -= 1;
    if (b0 & 0x04) dx += 9;  if (b0 & 0x08) dx -= 9;
    if (b0 & 0x80) dy += 1;  if (b0 & 0x40) dy -= 1;
    if (b0 & 0x20) dy += 9;  if (b0 & 0x10) dy -= 9;
    // Byte 1: bits 0-3 = X (±3,±27), bits 4-7 = Y (±27,±3)
    if (b1 & 0x01) dx += 3;  if (b1 & 0x02) dx -= 3;
    if (b1 & 0x04) dx += 27; if (b1 & 0x08) dx -= 27;
    if (b1 & 0x80) dy += 3;  if (b1 & 0x40) dy -= 3;
    if (b1 & 0x20) dy += 27; if (b1 & 0x10) dy -= 27;
    // Byte 2: bits 2-3 = X (±81), bits 4-5 = Y (±81), bits 6-7 = flags
    if (b2 & 0x04) dx += 81; if (b2 & 0x08) dx -= 81;
    if (b2 & 0x20) dy += 81; if (b2 & 0x10) dy -= 81;

    let type = STITCH_NORMAL;
    if ((b2 & 0xC0) === 0xC0) type = STITCH_COLOR_CHANGE;
    else if (b2 & 0x80) type = STITCH_JUMP;

    stitches.push({type, dx, dy});
  }
  return stitches;
}

function processStitches(stitches) {
  const points = [], breaks = [], colorRuns = [];
  let x=0, y=0, colorIndex=0, stitchNum=0, normalCount=0, jumpCount=0, ccCount=0, runStart=0;

  for (const s of stitches) {
    if (s.type === STITCH_END) break;
    x += s.dx; y += s.dy; stitchNum++;
    points.push({x, y, type: s.type, colorIndex, stitchNum});

    if (s.type === STITCH_COLOR_CHANGE) {
      ccCount++;
      colorRuns.push({colorIndex, startIdx: runStart, endIdx: points.length - 1, stitchCount: points.length - 1 - runStart});
      colorIndex++; runStart = points.length;
      breaks.push({type:'Color Change', typeClass:'type-color', stitchNum, colorFrom: colorIndex-1, colorTo: colorIndex, x, y});
    } else if (s.type === STITCH_JUMP) {
      jumpCount++;
      if (points.length <= 1 || points[points.length-2].type !== STITCH_JUMP) {
        breaks.push({type:'Jump', typeClass:'type-jump', stitchNum, colorFrom: colorIndex, colorTo: colorIndex, x, y});
      }
    } else {
      normalCount++;
    }
  }
  if (points.length > runStart) {
    colorRuns.push({colorIndex, startIdx: runStart, endIdx: points.length - 1, stitchCount: points.length - 1 - runStart});
  }

  return { points, breaks, colorRuns, stats: { totalStitches: normalCount, jumps: jumpCount, colorChanges: ccCount, totalColors: ccCount + 1 } };
}

// ─── RENDERER ────────────────────────────────────────────
let currentData = null, renderMode = 'colors';
let traceState = { currentRun: 0, playing: false, animFrame: null, stitchIdx: 0 };

function getDim(data) {
  const pts = data.points;
  let mnX=Infinity, mnY=Infinity, mxX=-Infinity, mxY=-Infinity;
  for (const p of pts) { if(p.x<mnX)mnX=p.x; if(p.x>mxX)mxX=p.x; if(p.y<mnY)mnY=p.y; if(p.y>mxY)mxY=p.y; }
  const dW = mxX-mnX||1, dH = mxY-mnY||1;
  const area = document.getElementById('canvasArea');
  const maxW = area.clientWidth-60, maxH = area.clientHeight-80;
  const sc = Math.min(maxW/dW, maxH/dH) * 0.9;
  return { minX:mnX, minY:mnY, maxX:mxX, maxY:mxY, dW, dH, sc, cW: Math.min(dW*sc+40, maxW), cH: Math.min(dH*sc+40, maxH) };
}

function render(canvas, data, mode, opts={}) {
  const ctx = canvas.getContext('2d');
  const { points, colorRuns } = data;
  if (!points.length) return;

  const d = getDim(data);
  canvas.width = d.cW; canvas.height = d.cH;
  const ox = (d.cW - d.dW*d.sc)/2 - d.minX*d.sc;
  const oy = (d.cH - d.dH*d.sc)/2 - d.minY*d.sc;
  const tx = px => px*d.sc + ox;
  const ty = py => d.cH - (py*d.sc + oy);

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, d.cW, d.cH);

  if (mode === 'trace') {
    const { showUpToRun=0, showUpToStitch, highlightRun=0 } = opts;

    for (let r = 0; r <= Math.min(showUpToRun, colorRuns.length-1); r++) {
      const run = colorRuns[r];
      const color = THREAD_COLORS[run.colorIndex % THREAD_COLORS.length];
      const isHL = r === highlightRun;
      const endI = (r === showUpToRun && showUpToStitch !== undefined)
        ? Math.min(run.startIdx + showUpToStitch, run.endIdx) : run.endIdx;

      ctx.strokeStyle = isHL ? color : (r < highlightRun ? color+'88' : color+'30');
      ctx.lineWidth = isHL ? 2 : 1;

      let prev = null;
      for (let i = run.startIdx; i <= endI; i++) {
        const p = points[i];
        if (p.type===STITCH_JUMP || p.type===STITCH_COLOR_CHANGE) { prev=p; continue; }
        if (prev && prev.type===STITCH_NORMAL) {
          ctx.beginPath(); ctx.moveTo(tx(prev.x), ty(prev.y)); ctx.lineTo(tx(p.x), ty(p.y)); ctx.stroke();
        }
        prev = p;
      }
    }

    // Needle marker
    if (showUpToRun >= 0 && showUpToRun < colorRuns.length) {
      const run = colorRuns[showUpToRun];
      const endI = (showUpToStitch !== undefined)
        ? Math.min(run.startIdx + showUpToStitch, run.endIdx) : run.endIdx;
      const lp = points[endI];
      if (lp) {
        ctx.fillStyle = THREAD_COLORS[run.colorIndex % THREAD_COLORS.length];
        ctx.beginPath(); ctx.arc(tx(lp.x), ty(lp.y), 6, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
      }
    }
  } else {
    let prev = null;
    for (const p of points) {
      if (p.type===STITCH_JUMP || p.type===STITCH_COLOR_CHANGE) {
        if (mode==='mono' && prev && p.type===STITCH_JUMP) {
          ctx.strokeStyle='rgba(255,200,40,0.12)'; ctx.lineWidth=0.4;
          ctx.beginPath(); ctx.moveTo(tx(prev.x),ty(prev.y)); ctx.lineTo(tx(p.x),ty(p.y)); ctx.stroke();
        }
        prev=p; continue;
      }
      if (prev && prev.type===STITCH_NORMAL) {
        ctx.strokeStyle = mode==='colors' ? THREAD_COLORS[p.colorIndex%THREAD_COLORS.length] : '#222';
        ctx.lineWidth = mode==='colors' ? 1.5 : 0.8;
        ctx.beginPath(); ctx.moveTo(tx(prev.x),ty(prev.y)); ctx.lineTo(tx(p.x),ty(p.y)); ctx.stroke();
      }
      prev = p;
    }
  }
}

// ─── TRACE LOGIC ─────────────────────────────────────────
let playSpeed = 5;
function updateSpeed() { playSpeed = +document.getElementById('speedSlider').value; document.getElementById('speedLabel').textContent = playSpeed+'x'; }

function traceStep(dir) {
  if (!currentData) return;
  traceStopPlay();
  const runs = currentData.colorRuns;
  let n = traceState.currentRun + dir;
  n = Math.max(0, Math.min(n, runs.length-1));
  traceState.currentRun = n;
  traceState.stitchIdx = runs[n].endIdx - runs[n].startIdx;
  render(canvas, currentData, 'trace', {showUpToRun:n, highlightRun:n});
  updateTraceUI(); highlightActiveRun(n);
}

function traceShowAll() {
  if (!currentData) return;
  traceStopPlay();
  const runs = currentData.colorRuns;
  traceState.currentRun = runs.length - 1;
  traceState.stitchIdx = runs[traceState.currentRun].endIdx - runs[traceState.currentRun].startIdx;
  render(canvas, currentData, 'trace', {showUpToRun: traceState.currentRun, highlightRun: -1});
  updateTraceUI(); highlightActiveRun(-1);
}

function traceTogglePlay() { traceState.playing ? traceStopPlay() : traceStartPlay(); }

function traceStartPlay() {
  if (!currentData) return;
  traceState.playing = true;
  document.getElementById('btnPlayPause').innerHTML = '⏸ Pause';
  const runs = currentData.colorRuns;
  if (traceState.currentRun >= runs.length-1 && traceState.stitchIdx >= runs[traceState.currentRun].endIdx - runs[traceState.currentRun].startIdx) {
    traceState.currentRun = 0; traceState.stitchIdx = 0;
  }
  traceAnimate();
}

function traceStopPlay() {
  traceState.playing = false;
  document.getElementById('btnPlayPause').innerHTML = '▶ Play';
  if (traceState.animFrame) { cancelAnimationFrame(traceState.animFrame); traceState.animFrame = null; }
}

function traceAnimate() {
  if (!traceState.playing || !currentData) return;
  const runs = currentData.colorRuns;
  const run = runs[traceState.currentRun];
  const runLen = run.endIdx - run.startIdx;

  traceState.stitchIdx += Math.max(1, Math.floor(playSpeed * playSpeed * 0.6));

  if (traceState.stitchIdx >= runLen) {
    traceState.stitchIdx = runLen;
    render(canvas, currentData, 'trace', {showUpToRun: traceState.currentRun, showUpToStitch: runLen, highlightRun: traceState.currentRun});
    updateTraceUI(); highlightActiveRun(traceState.currentRun);

    if (traceState.currentRun < runs.length-1) {
      setTimeout(() => {
        traceState.currentRun++; traceState.stitchIdx = 0;
        if (traceState.playing) traceState.animFrame = requestAnimationFrame(traceAnimate);
      }, 500);
      return;
    } else { traceStopPlay(); return; }
  }

  render(canvas, currentData, 'trace', {showUpToRun: traceState.currentRun, showUpToStitch: traceState.stitchIdx, highlightRun: traceState.currentRun});
  updateTraceUI(); highlightActiveRun(traceState.currentRun);
  traceState.animFrame = requestAnimationFrame(traceAnimate);
}

function traceSeek(e) {
  if (!currentData) return;
  traceStopPlay();
  const pct = e.offsetX / document.getElementById('traceBarWrap').clientWidth;
  const runs = currentData.colorRuns;
  const n = Math.min(Math.floor(pct * runs.length), runs.length-1);
  traceState.currentRun = n;
  traceState.stitchIdx = runs[n].endIdx - runs[n].startIdx;
  render(canvas, currentData, 'trace', {showUpToRun:n, highlightRun:n});
  updateTraceUI(); highlightActiveRun(n);
}

function traceJumpToRun(idx) {
  if (!currentData) return;
  traceStopPlay();
  if (renderMode !== 'trace') setRenderMode('trace');
  traceState.currentRun = idx;
  const run = currentData.colorRuns[idx];
  traceState.stitchIdx = run.endIdx - run.startIdx;
  render(canvas, currentData, 'trace', {showUpToRun:idx, highlightRun:idx});
  updateTraceUI(); highlightActiveRun(idx);
}

function updateTraceUI() {
  if (!currentData) return;
  const runs = currentData.colorRuns, cur = traceState.currentRun;
  document.getElementById('traceRunLabel').textContent = `Color ${cur+1} / ${runs.length}`;
  if (cur >= 0 && cur < runs.length) {
    const rl = runs[cur].endIdx - runs[cur].startIdx;
    document.getElementById('traceStitchLabel').textContent = `${Math.min(traceState.stitchIdx, rl).toLocaleString()} / ${rl.toLocaleString()} stitches`;
  }
  document.getElementById('traceBar').style.width = ((cur+1)/runs.length*100)+'%';
}

function highlightActiveRun(idx) {
  const items = document.querySelectorAll('.color-run');
  items.forEach((el, i) => {
    el.classList.remove('active-run','dimmed','completed');
    if (idx === -1) return;
    if (i === idx) el.classList.add('active-run');
    else if (i < idx) el.classList.add('completed');
    else el.classList.add('dimmed');
  });
  if (idx >= 0 && items[idx]) items[idx].scrollIntoView({block:'nearest', behavior:'smooth'});
}

// ─── UI ──────────────────────────────────────────────────
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const canvas = document.getElementById('stitchCanvas');

uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => { if (e.target.files.length) handleFile(e.target.files[0]); });
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('dragover'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });

function handleFile(file) {
  if (!file.name.toLowerCase().endsWith('.dst')) { alert('Please select a .dst file'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const buf = e.target.result, hdr = parseDSTHeader(buf), st = decodeDSTStitches(buf), data = processStitches(st);
      data.header = hdr; data.fileName = file.name;
      currentData = data; showResults(data);
    } catch (err) { alert('Error parsing DST: ' + err.message); console.error(err); }
  };
  reader.readAsArrayBuffer(file);
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  if (tab==='sequence') { document.querySelectorAll('.tab')[0].classList.add('active'); document.getElementById('panelSequence').classList.add('active'); }
  else { document.querySelectorAll('.tab')[1].classList.add('active'); document.getElementById('panelBreaks').classList.add('active'); }
}

function setRenderMode(mode) {
  renderMode = mode;
  document.querySelectorAll('.canvas-toolbar button').forEach(b => b.classList.remove('active'));
  const btnId = mode==='mono'?'btnMono':mode==='colors'?'btnColors':'btnTrace';
  document.getElementById(btnId).classList.add('active');

  const tc = document.getElementById('traceControls');
  if (mode === 'trace') {
    tc.classList.add('visible'); switchTab('sequence');
    if (traceState.currentRun < 0) { traceState.currentRun = 0; traceState.stitchIdx = 0; }
    render(canvas, currentData, 'trace', {showUpToRun: traceState.currentRun, showUpToStitch: traceState.stitchIdx, highlightRun: traceState.currentRun});
    updateTraceUI(); highlightActiveRun(traceState.currentRun);
  } else {
    tc.classList.remove('visible'); traceStopPlay(); highlightActiveRun(-1);
    if (currentData) render(canvas, currentData, mode);
  }
}

function showResults(data) {
  uploadZone.classList.add('hidden');
  canvas.style.display = 'block';
  renderMode = 'colors';
  render(canvas, data, 'colors');

  document.getElementById('fileName').textContent = data.fileName;
  document.getElementById('statStitches').textContent = data.stats.totalStitches.toLocaleString();
  document.getElementById('statColors').textContent = data.stats.totalColors;
  document.getElementById('statJumps').textContent = data.stats.jumps;

  const h = data.header;
  const wIn = (h.widthMM/25.4).toFixed(1), hIn = (h.heightMM/25.4).toFixed(1);
  document.getElementById('statSize').textContent = wIn+'" × '+hIn+'"';
  document.getElementById('sizeBar').textContent = `${h.widthMM.toFixed(1)}mm × ${h.heightMM.toFixed(1)}mm  (${wIn}" × ${hIn}")`;
  document.getElementById('sizeBar').classList.add('visible');

  document.getElementById('fileInfo').classList.add('visible');
  document.getElementById('tabs').classList.add('visible');
  document.getElementById('sidebarEmpty').classList.add('hidden');
  document.getElementById('reloadBtn').classList.add('visible');
  document.getElementById('toolbar').classList.add('visible');
  document.getElementById('traceControls').classList.remove('visible');

  document.querySelectorAll('.canvas-toolbar button').forEach(b => b.classList.remove('active'));
  document.getElementById('btnColors').classList.add('active');

  // Color runs list
  const rl = document.getElementById('colorRunsList');
  rl.innerHTML = '';
  data.colorRuns.forEach((run, idx) => {
    const color = THREAD_COLORS[run.colorIndex % THREAD_COLORS.length];
    const name = COLOR_NAMES[run.colorIndex % COLOR_NAMES.length];
    const el = document.createElement('div');
    el.className = 'color-run';
    el.onclick = () => traceJumpToRun(idx);
    el.innerHTML = `
      <div class="run-num"><span class="label">Run</span><span class="num">${idx+1}</span></div>
      <div class="run-swatch" style="background:${color}"></div>
      <div class="run-info">
        <div class="run-name">Color ${run.colorIndex+1} — ${name}</div>
        <div class="run-detail">${run.stitchCount.toLocaleString()} stitches</div>
      </div>`;
    rl.appendChild(el);
  });

  // Breaks list
  const bl = document.getElementById('breaksList');
  bl.innerHTML = '';
  if (!data.breaks.length) {
    bl.innerHTML = '<div style="padding:24px;color:var(--text-dim);text-align:center;font-size:13px;">No thread breaks detected</div>';
  } else {
    data.breaks.forEach((b, idx) => {
      const sw = b.type==='Color Change' ? `<span class="color-swatch" style="background:${THREAD_COLORS[b.colorTo%THREAD_COLORS.length]}"></span>` : '';
      const el = document.createElement('div');
      el.className = 'break-item';
      el.innerHTML = `
        <div class="break-num">${idx+1}</div>
        <div class="break-info">
          <div class="break-type ${b.typeClass}">${sw}${b.type}${b.type==='Color Change'?' → Color '+(b.colorTo+1):''}</div>
          <div class="break-detail">at (${b.x}, ${b.y})</div>
        </div>
        <div class="break-stitch">stitch ${b.stitchNum.toLocaleString()}</div>`;
      bl.appendChild(el);
    });
  }

  traceState = {currentRun:0, playing:false, animFrame:null, stitchIdx:0};
}

function resetViewer() {
  traceStopPlay(); currentData = null; renderMode = 'colors';
  traceState = {currentRun:0, playing:false, animFrame:null, stitchIdx:0};
  canvas.style.display = 'none';
  uploadZone.classList.remove('hidden');
  ['fileInfo','tabs','sizeBar'].forEach(id => document.getElementById(id).classList.remove('visible'));
  document.getElementById('sidebarEmpty').classList.remove('hidden');
  ['reloadBtn','toolbar','traceControls'].forEach(id => document.getElementById(id).classList.remove('visible'));
  document.getElementById('colorRunsList').innerHTML = '';
  document.getElementById('breaksList').innerHTML = '';
  fileInput.value = '';
}

window.addEventListener('resize', () => {
  if (!currentData) return;
  if (renderMode==='trace') render(canvas, currentData, 'trace', {showUpToRun:traceState.currentRun, showUpToStitch:traceState.stitchIdx, highlightRun:traceState.currentRun});
  else render(canvas, currentData, renderMode);
});
