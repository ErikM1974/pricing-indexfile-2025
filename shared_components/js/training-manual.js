/* Shared reading navigation and print-state restoration for training manuals. */
(() => {
    'use strict';
    const root = document.querySelector('[data-ui="unified"][data-training-manual]');
    if (!root) return;
    const chapterMode = root.dataset.manualMode === 'chapters';
    const sections = [...root.querySelectorAll('[data-manual-section]')];
    const links = [...root.querySelectorAll('[data-manual-link]')];
    const contents = root.querySelector('.manual-contents');
    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const focusSection = section => {
        section.focus({ preventScroll: true });
        section.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'instant' : 'smooth' });
    };
    function currentSection() {
        let id;
        try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { id = ''; }
        return sections.find(section => section.id === id) || sections[0];
    }
    function activate(section, focus = false) {
        if (!section) return;
        if (chapterMode) sections.forEach(item => { item.hidden = item !== section; });
        links.forEach(link => {
            const selected = link.getAttribute('href') === '#' + section.id;
            link.classList.toggle('is-active', selected);
            if (selected) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        });
        if (focus) {
            if (contents && window.matchMedia('(max-width: 899px)').matches) contents.open = false;
            focusSection(section);
        }
    }
    if (contents) contents.open = window.matchMedia('(min-width: 900px)').matches;
    links.forEach(link => link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        const section = sections.find(item => '#' + item.id === link.getAttribute('href'));
        if (!section) return;
        event.preventDefault();
        if (window.location.hash !== '#' + section.id) window.history.pushState(null, '', '#' + section.id);
        activate(section, true);
    }));
    window.addEventListener('hashchange', () => activate(currentSection(), true));
    activate(currentSection(), Boolean(window.location.hash));

    // Continuous documents keep their contents marker in step with ordinary scrolling.
    if (!chapterMode && sections.length) {
        const listed = sections.filter(section => links.some(link => link.getAttribute('href') === '#' + section.id));
        let queued = false;
        window.addEventListener('scroll', () => {
            if (queued) return;
            queued = true;
            window.requestAnimationFrame(() => {
                queued = false;
                const reached = listed.filter(section => section.getBoundingClientRect().top <= 160);
                activate(reached[reached.length - 1] || listed[0]);
            });
        }, { passive: true });
    }

    root.querySelectorAll('[data-bio-toggle]').forEach(button => {
        const panel = document.getElementById(button.getAttribute('aria-controls'));
        if (!panel) return;
        button.addEventListener('click', () => {
            panel.hidden = !panel.hidden;
            button.setAttribute('aria-expanded', String(!panel.hidden));
        });
    });
    root.querySelectorAll('[data-manual-top]').forEach(button => button.addEventListener('click', () => {
        const target = chapterMode ? currentSection() : root.querySelector('h1');
        if (target) focusSection(target);
    }));
    root.querySelectorAll('[data-manual-print]').forEach(button => button.addEventListener('click', () => window.print()));

    let printState = null;
    window.addEventListener('beforeprint', () => {
        if (printState) return;
        const panels = [...root.querySelectorAll('[data-manual-section], [data-bio-panel]')];
        const details = [...root.querySelectorAll('details:not(.manual-contents)')];
        printState = { panels: panels.map(panel => [panel, panel.hidden]), details: details.map(detail => [detail, detail.open]) };
        panels.forEach(panel => { panel.hidden = false; });
        details.forEach(detail => { detail.open = true; });
    });
    window.addEventListener('afterprint', () => {
        if (!printState) return;
        printState.panels.forEach(([panel, hidden]) => { panel.hidden = hidden; });
        printState.details.forEach(([detail, open]) => { detail.open = open; });
        printState = null;
    });
})();
