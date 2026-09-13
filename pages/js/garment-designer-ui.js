/* Presentation lifecycle for the garment designer. Artwork stays in its renderer. */
(function () {
  'use strict';
  const stack = [];
  const inertBefore = new Map();
  let printSession = null;
  const focusable = (modal) => [...modal.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.disabled && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');

  function syncBackground() {
    const top = stack.at(-1)?.modal;
    if (!top) {
      for (const [element, inert] of inertBefore) element.inert = inert;
      inertBefore.clear();
      document.body.classList.remove('designer-dialog-open');
      return;
    }
    for (const element of document.body.children) {
      if (['SCRIPT', 'LINK', 'STYLE'].includes(element.tagName)) continue;
      if (!inertBefore.has(element)) inertBefore.set(element, element.inert);
      element.inert = element !== top && !element.contains(top) && element.id !== 'toast';
    }
    document.body.classList.add('designer-dialog-open');
  }

  function openDialog(modal, visibleClass) {
    if (stack.some((entry) => entry.modal === modal)) return;
    stack.push({modal, visibleClass, opener: document.activeElement});
    modal.classList.add(visibleClass);
    syncBackground();
    const target = focusable(modal)[0] || modal.querySelector('[role="dialog"]') || modal;
    if (!target.matches('button, input, select, textarea, a[href]')) target.tabIndex = -1;
    target.focus({preventScroll: true});
  }

  function closeDialog(modal) {
    const index = stack.findIndex((entry) => entry.modal === modal);
    if (index < 0) return;
    const [entry] = stack.splice(index, 1);
    modal.classList.remove(entry.visibleClass);
    syncBackground();
    if (entry.opener?.isConnected && !entry.opener.closest('[inert]')) entry.opener.focus({preventScroll: true});
  }

  document.addEventListener('keydown', (event) => {
    const top = stack.at(-1);
    if (!top) return;
    if (event.key === 'Escape') {
      // Let the customer picker close its suggestions before closing the form.
      if (top.modal.querySelector('.ccp-open')) return;
      event.preventDefault();
      closeDialog(top.modal);
    } else if (event.key === 'Tab') {
      const items = focusable(top.modal);
      if (!items.length) event.preventDefault();
      else if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault(); items.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault(); items[0].focus();
      }
    } else return;
    event.stopPropagation();
  }, true);

  // Stop page shortcuts after input/drop-zone keyboard handlers have run.
  document.addEventListener('keydown', (event) => {
    if (stack.length) event.stopImmediatePropagation();
  });

  function preparePrint(kind) {
    if (printSession) return;
    const active = stack.at(-1)?.modal;
    printSession = {hadSheet: document.body.classList.contains('print-spec'), active: null};
    if (!kind && printSession.hadSheet) return;
    const entry = window.current();
    if (!kind && active) {
      printSession.active = active;
      active.classList.add('designer-print-active');
      document.body.dataset.garmentPrint = 'dialog';
    } else if (entry?.status === 'ready') {
      if (kind === 'spec') window.buildSpecSheet(entry);
      else window.buildProofSheet(entry);
      document.body.classList.add('print-spec');
    }
  }

  function restorePrint() {
    if (!printSession) return;
    if (!printSession.hadSheet) document.body.classList.remove('print-spec');
    printSession.active?.classList.remove('designer-print-active');
    delete document.body.dataset.garmentPrint;
    printSession = null;
  }

  function printSheet(kind) {
    preparePrint(kind);
    try { window.print(); } catch (error) { restorePrint(); throw error; }
  }
  window.addEventListener('beforeprint', () => preparePrint());
  window.addEventListener('afterprint', restorePrint);
  window.matchMedia('print').addEventListener('change', (event) => {
    if (!event.matches) restorePrint();
  });
  document.addEventListener('garment:open-dialog', (event) => openDialog(event.detail.modal, event.detail.visibleClass));
  document.addEventListener('garment:close-dialog', (event) => closeDialog(event.detail.modal));
  document.addEventListener('garment:print-sheet', (event) => printSheet(event.detail.kind));
}());
