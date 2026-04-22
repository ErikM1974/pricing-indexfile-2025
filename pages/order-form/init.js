// Tweak defaults — persisted via edit-mode postMessage (see components/tweaks.jsx).
// Default accent/font/layout for the paper order form.
window.__TWEAKS = {
  accent: 'spruce',
  font: 'modern',
  layout: 'single',
};
document.body.className = 'layout-' + (window.__TWEAKS.layout || 'single');
