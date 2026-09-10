/* Drain-Pro workspace tabs: preserve the two embedded views and all provider URLs. */
function switchTab(tabName) {
    const selectedButton = document.getElementById(tabName + '-tab-button');
    const selectedContent = document.getElementById(tabName + '-tab');
    if (!selectedButton || !selectedContent) return;
    document.querySelectorAll('.tab-button').forEach(button => {
        const selected = button === selectedButton;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        const selected = content === selectedContent;
        content.classList.toggle('active', selected);
        content.hidden = !selected;
    });
}

document.querySelector('.tab-navigation').addEventListener('keydown', event => {
    const tabs = [...document.querySelectorAll('.tab-button')];
    const current = tabs.indexOf(event.target);
    if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
        (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    switchTab(tabs[next].getAttribute('aria-controls').replace(/-tab$/, ''));
    tabs[next].focus();
});

// Both provider views belong on paper. Restore the selected screen view afterward.
let paperVisibility = null;
window.addEventListener('beforeprint', () => {
    if (paperVisibility) return;
    paperVisibility = [...document.querySelectorAll('.tab-content')].map(content => [content, content.hidden]);
    paperVisibility.forEach(([content]) => { content.hidden = false; });
});
window.addEventListener('afterprint', () => {
    if (!paperVisibility) return;
    paperVisibility.forEach(([content, hidden]) => { content.hidden = hidden; });
    paperVisibility = null;
});
