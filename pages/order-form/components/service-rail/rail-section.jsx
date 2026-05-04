// Order Form Service Rail — RailSection component (Phase 3c, 2026-05-03).
//
// Collapsible section wrapper. Renders a header with the group name and
// service count, plus the cards inside. Click header to expand/collapse —
// state lives in localStorage so collapse preferences persist across reloads
// (per-session, per-method).

(function () {
  'use strict';
  const { useState, useEffect } = React;

  const COLLAPSE_KEY = 'orderForm.serviceRail.collapsedGroups.v1';
  // 2026-05-04 — separate "explicitly expanded" set so we can default-collapse
  // big sections (>5 cards) without forgetting that the user opened one.
  const EXPAND_KEY = 'orderForm.serviceRail.expandedGroups.v1';

  function readCollapsedSet() {
    try {
      const raw = sessionStorage.getItem(COLLAPSE_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (_) { return new Set(); }
  }
  function writeCollapsedSet(set) {
    try {
      sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify(Array.from(set)));
    } catch (_) { /* quota — fine */ }
  }
  function readExpandedSet() {
    try {
      const raw = sessionStorage.getItem(EXPAND_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (_) { return new Set(); }
  }
  function writeExpandedSet(set) {
    try {
      sessionStorage.setItem(EXPAND_KEY, JSON.stringify(Array.from(set)));
    } catch (_) { /* quota — fine */ }
  }

  // Map group name → CSS variant suffix
  function groupVariant(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('stitch'))  return 'stitch';
    if (n.includes('cap'))     return 'cap';
    if (n.includes('garment')) return 'garment';
    if (n.includes('setup'))   return 'setup';
    if (n.includes('order'))   return 'order';
    return 'other';
  }

  /**
   * @param {Object} props
   * @param {string} props.name      group label (e.g. "Stitch Surcharges")
   * @param {React.ReactNode} props.children  the rendered cards
   * @param {number} props.count     for the count badge
   */
  function RailSection({ name, children, count }) {
    // 2026-05-04 — default-collapsed when the section has > 5 cards AND the
    // user hasn't explicitly toggled it (sessionStorage tracks both
    // collapsed AND explicitly-expanded sets so a rep who opens a tall
    // section doesn't have to re-open it on every render). Sections with
    // ≤ 5 cards default expanded for instant scan.
    const [collapsed, setCollapsed] = useState(() => {
      const set = readCollapsedSet();
      if (set.has(name)) return true;
      const expandedSet = readExpandedSet();
      if (expandedSet.has(name)) return false;
      return Number(count) > 5;
    });
    const variant = groupVariant(name);

    function toggle() {
      const collapseSet = readCollapsedSet();
      const expandSet = readExpandedSet();
      if (collapsed) {
        // Expanding — clear from collapsed set, mark as explicitly expanded
        // so the >5-cards default-collapse rule doesn't re-collapse it next
        // render.
        collapseSet.delete(name);
        expandSet.add(name);
      } else {
        collapseSet.add(name);
        expandSet.delete(name);
      }
      writeCollapsedSet(collapseSet);
      writeExpandedSet(expandSet);
      setCollapsed(!collapsed);
    }

    const cls = [
      'rail-section',
      `rail-section--${variant}`,
      collapsed ? 'rail-section--collapsed' : '',
    ].filter(Boolean).join(' ');

    return (
      <div className={cls}>
        <div
          className="rail-section-head"
          onClick={toggle}
          role="button"
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${name}`}
        >
          <span className="rail-section-caret">▾</span>
          <span>{name}</span>
          <span className="rail-section-count">{count}</span>
        </div>
        <div className="rail-section-body">
          {children}
        </div>
      </div>
    );
  }

  window.OrderFormRailSection = RailSection;
})();
