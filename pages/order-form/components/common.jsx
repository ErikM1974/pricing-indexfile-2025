// Shared small components: Icon, Logo mark, Eyebrow, Field wrapper, etc.
const { useState, useEffect, useRef, useCallback, useMemo } = React;

function Icon({ name, size = 16, stroke = 1.6 }) {
  const s = size;
  const common = {
    width: s, height: s, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round'
  };
  switch (name) {
    case 'plus':    return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'minus':   return <svg {...common}><path d="M5 12h14"/></svg>;
    case 'close':   return <svg {...common}><path d="M18 6 6 18M6 6l12 12"/></svg>;
    case 'check':   return <svg {...common}><path d="M4 12l5 5L20 6"/></svg>;
    case 'upload':  return <svg {...common}><path d="M12 3v12M6 9l6-6 6 6"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>;
    case 'search':  return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>;
    case 'trash':   return <svg {...common}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg>;
    case 'truck':   return <svg {...common}><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case 'sparkle': return <svg {...common}><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M5.6 18.4l4.2-4.2M14.2 9.8l4.2-4.2"/></svg>;
    case 'shirt':   return <svg {...common}><path d="M4 7 8 3h8l4 4-3 3-1-1v12H7V9l-1 1-2-3z"/></svg>;
    case 'tune':    return <svg {...common}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>;
    case 'info':    return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>;
    case 'doc':     return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>;
    case 'drag':    return <svg {...common}><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>;
    default: return null;
  }
}

function LogoMark({ size = 30 }) {
  return (
    <img
      src="https://cdn.caspio.com/A0E15000/Safety%20Stripes/web%20northwest%20custom%20apparel%20logo.png?ver=1"
      alt="Northwest Custom Apparel"
      style={{ height: size, width: 'auto', display: 'block' }}
    />
  );
}

function Eyebrow({ children, step }) {
  return (
    <div className="step">
      {step && <span className="mono" style={{ fontWeight: 600 }}>{step}</span>}
      {step && <span style={{ opacity: 0.5 }}>/</span>}
      <span>{children}</span>
    </div>
  );
}

function Section({ step, title, note, children }) {
  return (
    <section className="section">
      <div className="section-head">
        <Eyebrow step={step}>Step</Eyebrow>
        <h2 className="display">{title}</h2>
        {note && <p className="note">{note}</p>}
      </div>
      <div className="section-body">{children}</div>
    </section>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <div className="field">
      <label>{label}{required && <span className="req">*</span>}</label>
      {children}
      {hint && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/* Expose to globals for other babel scripts */
Object.assign(window, { Icon, LogoMark, Eyebrow, Section, Field });
