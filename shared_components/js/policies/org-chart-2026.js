/** Progressive enhancement for the Caspio-managed 2026 org chart. */
(function () {
    'use strict';

    const isChart = () => new URLSearchParams(location.search).get('id') === 'org-chart-2026';
    const children = el => Array.from(el.children);

    function decorateCard(card, variant) {
        if (!card) return;
        card.className = `org-card org-card--${variant}`;
        const parts = children(card);
        ['org-card-name', 'org-card-role', 'org-card-detail'].forEach((name, i) => {
            if (parts[i]) parts[i].className = name;
        });
    }

    function decorateProduction(section) {
        section.className = 'org-production';
        const [heading, grid] = children(section);
        heading.className = 'org-production-heading';
        grid.className = 'org-production-grid';
        children(grid).forEach((column, index) => {
            column.className = 'org-department';
            const [supervisor, operators] = children(column);
            decorateCard(supervisor, 'department');
            if (!operators) return;
            operators.className = 'org-operator-list';
            operators.id = `org-team-${index}`;
            supervisor.setAttribute('role', 'button');
            supervisor.setAttribute('tabindex', '0');
            supervisor.setAttribute('aria-expanded', 'true');
            supervisor.setAttribute('aria-controls', operators.id);
            const toggleTeam = () => {
                const collapsed = column.classList.toggle('is-collapsed');
                supervisor.setAttribute('aria-expanded', String(!collapsed));
            };
            supervisor.addEventListener('click', toggleTeam);
            supervisor.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleTeam();
                }
            });
            children(operators).forEach(operator => {
                operator.className = 'org-operator';
                const spans = children(operator);
                if (spans[0]) spans[0].className = 'org-operator-name';
                if (spans[1]) spans[1].className = 'org-operator-role';
            });
        });
    }

    function buildToolbar(chart, oldBadge) {
        const toolbar = document.createElement('div');
        toolbar.className = 'org-chart-toolbar';
        toolbar.innerHTML = '<span class="org-chart-date">AS OF JULY 2026</span>' +
            '<input class="org-chart-search" type="search" placeholder="Find a team member…" aria-label="Find a team member">' +
            '<button class="org-chart-toggle" type="button" aria-expanded="true">Collapse production</button>';
        oldBadge.replaceWith(toolbar);
        const search = toolbar.querySelector('input');
        const toggle = toolbar.querySelector('button');
        search.addEventListener('input', () => filterPeople(chart, search.value));
        toggle.addEventListener('click', () => {
            const collapsed = chart.classList.toggle('is-production-collapsed');
            toggle.setAttribute('aria-expanded', String(!collapsed));
            toggle.textContent = collapsed ? 'Expand production' : 'Collapse production';
        });
    }

    function filterPeople(chart, value) {
        const query = value.trim().toLowerCase();
        const people = chart.querySelectorAll('.org-card,.org-operator');
        people.forEach(person => {
            const hit = !query || person.textContent.toLowerCase().includes(query);
            person.classList.toggle('org-search-dim', Boolean(query) && !hit);
            person.classList.toggle('org-search-hit', Boolean(query) && hit);
        });
        if (query) chart.classList.remove('is-production-collapsed');
    }

    function enhance() {
        if (!isChart()) return;
        const body = document.getElementById('policyBody');
        const chart = body && Array.from(body.children).find(el => el.tagName === 'DIV');
        if (!chart || chart.dataset.enhanced) return;
        const sections = children(chart);
        if (sections.length < 8) return;
        chart.dataset.enhanced = 'true';
        chart.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
        chart.removeAttribute('style');
        chart.className = 'org-chart';
        body.classList.add('org-chart-view');
        buildToolbar(chart, sections[0]);
        [sections[1], sections[3]].forEach(level => {
            level.className = 'org-chart-level';
            decorateCard(level.firstElementChild, 'leader');
        });
        [sections[2], sections[4]].forEach(connector => connector.className = 'org-chart-connector');
        sections[5].className = 'org-chart-directs';
        children(sections[5]).forEach(card => decorateCard(card, 'direct'));
        decorateProduction(sections[6]);
        sections[7].className = 'org-coverage';
        const coverageParts = children(sections[7]);
        if (coverageParts[0]) coverageParts[0].className = 'org-coverage-title';
    }

    const observer = new MutationObserver(enhance);
    document.addEventListener('DOMContentLoaded', () => {
        const body = document.getElementById('policyBody');
        if (body && isChart()) observer.observe(body, { childList: true });
        enhance();
    });
}());