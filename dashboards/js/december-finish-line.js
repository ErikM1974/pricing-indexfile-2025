'use strict';

(() => {
    const byId = id => document.getElementById(id);
    const fileUrl = value => '/admin/december-finish-line/files/' + value.split('/').map(encodeURIComponent).join('/');
    let pending = false;
    async function load() {
        if (pending) return;
        pending = true;
        byId('finish-loading').hidden = false;
        byId('finish-error').hidden = true;
        byId('finish-content').hidden = true;
        byId('finish-primary').hidden = true;
        byId('finish-login').hidden = true;
        try {
            const response = await fetch('/admin/december-finish-line/catalog', { cache: 'no-store', credentials: 'same-origin' });
            if (response.redirected || response.status === 401) {
                byId('finish-login').hidden = false;
                throw new Error('Your staff session has ended. Sign in again to open the private reports.');
            }
            if (response.status === 403) throw new Error('This area is available only to staff with the admin role.');
            if (!response.ok) throw new Error('The saved report package is temporarily unavailable. Try again, or contact Erik if it continues.');
            const catalog = await response.json();
            if (!catalog.primary || !Array.isArray(catalog.links)) throw new Error('The report list could not be read. Try again.');
            byId('finish-open').href = fileUrl(catalog.primary);
            byId('finish-snapshot').textContent = `Financial source snapshot: ${catalog.snapshotLabel}. Prepared for the December 2026 finish line.`;
            const links = byId('finish-links');
            links.replaceChildren();
            for (const item of catalog.links) {
                const link = document.createElement('a');
                link.className = 'finish-link';
                link.href = fileUrl(item.path);
                const title = document.createElement('strong');
                title.textContent = item.title;
                const description = document.createElement('span');
                description.textContent = item.description;
                link.append(title, description);
                links.append(link);
            }
            byId('finish-content').hidden = false;
            byId('finish-primary').hidden = false;
        } catch (error) {
            byId('finish-error-message').textContent = error instanceof Error ? error.message : 'Unable to load the reports. Try again.';
            byId('finish-error').hidden = false;
        } finally {
            pending = false;
            byId('finish-loading').hidden = true;
        }
    }
    byId('finish-retry').addEventListener('click', load);
    load();

    const money = value => Number.isSafeInteger(value) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100) : 'Unavailable';
    const dateLabel = value => value ? new Date(value + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : 'None reported';
    let livePending = false, lastAttempt = 0;
    function row(table, values) {
        const tr = document.createElement('tr');
        values.forEach((value, index) => {
            const cell = document.createElement(index ? 'td' : 'th');
            if (index) cell.className = 'num'; else cell.scope = 'row';
            cell.textContent = String(value);
            tr.append(cell);
        });
        table.append(tr);
    }
    async function refreshLive(force = false) {
        if (livePending) return;
        livePending = true; lastAttempt = Date.now();
        byId('finish-refresh').disabled = true;
        byId('finish-live-data').hidden = true;
        byId('finish-live-error').hidden = true;
        byId('finish-live-status').textContent = 'Checking current sales and orders…';
        try {
            const response = await fetch('/admin/december-finish-line/live' + (force ? '?refresh=true' : ''), { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(35000) });
            if (response.redirected || response.status === 401) throw new Error('Your staff session has ended. Sign in again to refresh current data.');
            if (response.status === 403) throw new Error('Only admins can open the Finish Line data.');
            if (!response.ok) throw new Error('Current data is unavailable. Use Refresh current data to try again.');
            const data = await response.json();
            if (!data.window || !Array.isArray(data.errors)) throw new Error('Current data could not be read. Try again.');
            byId('finish-live-status').textContent = `Checked ${new Date(data.retrievedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} Pacific. Checks every 5 minutes while this page is open.`;
            byId('finish-live-error').replaceChildren();
            for (const message of data.errors) {
                const p = document.createElement('p'); p.textContent = message; byId('finish-live-error').append(p);
            }
            byId('finish-live-error').hidden = data.errors.length === 0;
            const sales = data.sales;
            byId('finish-sales').textContent = money(sales?.revenueCents);
            byId('finish-goal').textContent = money(data.goalCents);
            byId('finish-remaining').textContent = sales && data.goalCents ? money(Math.max(0, data.goalCents - sales.revenueCents)) : 'Unavailable';
            byId('finish-progress').textContent = sales && data.goalCents ? `${(100 * sales.revenueCents / data.goalCents).toFixed(1)}% of the current company sales goal. ${sales.orders.toLocaleString()} invoices counted once.` : 'Progress will appear when sales and the company goal are both available.';
            byId('finish-sales-date').textContent = sales ? `Latest archived sales date: ${dateLabel(sales.lastArchivedSalesDate)}. Latest invoice in the fresh ShopWorks window: ${dateLabel(sales.lastLiveInvoiceDate)}.` : 'No partial year-to-date total is shown when a required source fails.';
            const months = byId('finish-months'); months.replaceChildren();
            for (const month of sales?.months || []) {
                const future = month.month > data.window.end.slice(0, 7);
                row(months, [new Date(month.month + '-15T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long' }), future ? 'Not started' : money(month.revenueCents), future ? '—' : month.orders.toLocaleString()]);
            }
            const reps = byId('finish-reps'); reps.replaceChildren();
            for (const rep of sales?.reps || []) row(reps, [rep.name, money(rep.revenueCents)]);
            if (!sales?.reps) row(reps, ['Rep breakdown unavailable', '—']);
            byId('finish-workload').textContent = data.workload ? `Recent uninvoiced work: ${data.workload.orders.toLocaleString()} orders / ${money(data.workload.subtotalCents)} ordered ${dateLabel(data.workload.start)}–${dateLabel(data.workload.end)}. This is a recent window, not the complete backlog or accounts receivable, and is not added to invoiced sales.` : 'Recent uninvoiced work is unavailable for this period.';
            byId('finish-coverage').textContent = data.coverageNote;
            byId('finish-financial-note').textContent = data.financialNote;
            const comparison = sales?.comparison;
            byId('finish-comparison').textContent = comparison ? `At the saved ${dateLabel(comparison.asOf)} cutoff: accounting net sales ${money(comparison.financialNetSalesCents)}; ShopWorks invoiced sales ${money(comparison.operationalSalesCents)}; difference ${money(comparison.differenceCents)}. These sources use different accounting timing and adjustments; this difference needs reconciliation before updating the profit model.` : 'The accounting comparison is unavailable until the saved baseline and current sales are both available.';
            byId('finish-live-data').hidden = false;
        } catch (error) {
            byId('finish-live-status').textContent = 'Current figures could not be refreshed.';
            byId('finish-live-error').textContent = error instanceof Error ? error.message : 'Unable to refresh current data.';
            byId('finish-live-error').hidden = false;
        } finally {
            livePending = false; byId('finish-refresh').disabled = false;
        }
    }
    byId('finish-refresh').addEventListener('click', () => refreshLive(true));
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastAttempt >= 300000) refreshLive(); });
    window.setInterval(() => { if (!document.hidden) refreshLive(); }, 300000);
    refreshLive();
    let printDetails = [];
    window.addEventListener('beforeprint', () => {
        printDetails = [...document.querySelectorAll('details')].map(node => ({ node, open: node.open }));
        printDetails.forEach(({ node }) => { node.open = true; });
    });
    window.addEventListener('afterprint', () => {
        printDetails.forEach(({ node, open }) => { node.open = open; });
        printDetails = [];
    });
})();
