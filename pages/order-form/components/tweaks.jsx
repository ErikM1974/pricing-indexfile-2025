// Tweaks panel: accent, font pairing, layout
const ACCENTS = [
  { key: 'forest',  label: 'Forest',   accent: 'oklch(0.42 0.08 155)', hover: 'oklch(0.36 0.08 155)', soft: 'oklch(0.96 0.03 155)', ink: 'oklch(0.28 0.07 155)' },
  { key: 'moss',    label: 'Moss',     accent: 'oklch(0.55 0.12 135)', hover: 'oklch(0.48 0.12 135)', soft: 'oklch(0.96 0.04 135)', ink: 'oklch(0.32 0.1 135)' },
  { key: 'spruce',  label: 'Spruce',   accent: 'oklch(0.38 0.06 185)', hover: 'oklch(0.32 0.06 185)', soft: 'oklch(0.96 0.03 185)', ink: 'oklch(0.26 0.06 185)' },
  { key: 'pine',    label: 'Pine',     accent: 'oklch(0.34 0.09 150)', hover: 'oklch(0.28 0.09 150)', soft: 'oklch(0.95 0.03 150)', ink: 'oklch(0.24 0.08 150)' },
  { key: 'ink',     label: 'Ink',      accent: 'oklch(0.25 0.02 260)', hover: 'oklch(0.18 0.02 260)', soft: 'oklch(0.95 0.01 260)', ink: 'oklch(0.2 0.02 260)' },
];

const FONTS = [
  { key: 'editorial',  label: 'Editorial', body: "'Instrument Sans', sans-serif", mono: "'JetBrains Mono', monospace",   display: "'Instrument Serif', serif" },
  { key: 'workwear',   label: 'Workwear',  body: "'Work Sans', sans-serif",        mono: "'IBM Plex Mono', monospace",    display: "'Work Sans', sans-serif" },
  { key: 'modern',     label: 'Modern',    body: "'Manrope', sans-serif",          mono: "'JetBrains Mono', monospace",   display: "'Manrope', sans-serif" },
];

const LAYOUTS = [
  { key: 'single', label: 'Single' },
  { key: 'two',    label: 'Two Pane' },
];

function applyAccent(a) {
  const r = document.documentElement.style;
  r.setProperty('--accent', a.accent);
  r.setProperty('--accent-hover', a.hover);
  r.setProperty('--accent-soft', a.soft);
  r.setProperty('--accent-ink', a.ink);
}
function applyFonts(f) {
  const r = document.documentElement.style;
  r.setProperty('--font-body', f.body);
  r.setProperty('--font-mono', f.mono);
  r.setProperty('--font-display', f.display);
}
function applyLayout(l) {
  document.body.classList.remove('layout-single', 'layout-two');
  document.body.classList.add('layout-' + l);
}

function TweaksPanel({ open }) {
  const [accent, setAccent] = useState(window.__TWEAKS?.accent || 'forest');
  const [font,   setFont]   = useState(window.__TWEAKS?.font   || 'editorial');
  const [layout, setLayout] = useState(window.__TWEAKS?.layout || 'single');

  useEffect(() => {
    applyAccent(ACCENTS.find(a => a.key === accent) || ACCENTS[0]);
    applyFonts(FONTS.find(f => f.key === font) || FONTS[0]);
    applyLayout(layout);
  }, [accent, font, layout]);

  function update(k, v) {
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
  }

  return (
    <div className="tweaks" role="region" aria-label="Tweaks" style={{ display: open ? 'block' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h4 style={{ margin: 0 }}>Tweaks</h4>
        <Icon name="tune" size={14} />
      </div>

      <div className="tw-group">
        <div className="tw-label">Accent</div>
        <div className="tw-swatches">
          {ACCENTS.map(a => (
            <button
              key={a.key}
              className={"tw-swatch" + (accent === a.key ? ' on' : '')}
              aria-label={a.label}
              title={a.label}
              style={{ background: a.accent }}
              onClick={() => { setAccent(a.key); update('accent', a.key); }}
            />
          ))}
        </div>
      </div>

      <div className="tw-group">
        <div className="tw-label">Type</div>
        <div className="tw-options">
          {FONTS.map(f => (
            <button
              key={f.key}
              className={"tw-opt" + (font === f.key ? ' on' : '')}
              onClick={() => { setFont(f.key); update('font', f.key); }}
            >{f.label}</button>
          ))}
        </div>
      </div>

      <div className="tw-group">
        <div className="tw-label">Layout</div>
        <div className="tw-options">
          {LAYOUTS.map(l => (
            <button
              key={l.key}
              className={"tw-opt" + (layout === l.key ? ' on' : '')}
              onClick={() => { setLayout(l.key); update('layout', l.key); }}
            >{l.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TweaksPanel, ACCENTS, FONTS, LAYOUTS, applyAccent, applyFonts, applyLayout });
