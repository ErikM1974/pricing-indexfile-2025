/* One customer document model for the screen, paper and downloadable PDF. Prices are engine results. */
(function (root) {
    'use strict';
    const names = { emb: 'Embroidery', capemb: 'Cap embroidery', dtg: 'DTG print', scp: 'Screen print', dtf: 'DTF transfer' };
    const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    const money = value => value != null && Number.isFinite(Number(value)) ? currency.format(Number(value)) : '—';
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const sum = rows => rows.reduce((total, row) => total + Number(row.amount || 0), 0);
    const cents = value => Math.round(Number(value) * 100) / 100;
    const date = value => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'America/Los_Angeles' }).format(value);
    const safeImage = value => /^(https?:\/\/|\/[^/])/.test(String(value || '')) ? value : '';
    const LOGO = '/images/nwca-logo.png';
    const CONTACT = 'Northwest Custom Apparel · (253) 922-5793';

    // Ladder rows arrive from quick-quote.js probes: base = per piece without the
    // small-batch fee or one-time setup, ltmFee = the flat once-per-order fee.
    function tier(t) {
        const min = Number(t?.range?.min), max = Number(t?.range?.max);
        if (!Number.isFinite(min) || !Number.isFinite(Number(t.base))) return null;
        return { label: String(t.label || ''), min, max: Number.isFinite(max) ? max : null, base: Number(t.base), ltmFee: Number(t.ltmFee || 0), setup: cents(t.setup || 0) };
    }
    function option(input) {
        const p = input.preview;
        if (!p?.ok || !Number.isFinite(p.groupTotal) || !(p.itemQuantity > 0)) return null;
        const setup = (p.fees || []).filter(f => f.oneTime).map(f => ({ label: f.label || f.code || 'One-time setup', amount: Number(f.amount) }));
        if (setup.some(f => !Number.isFinite(f.amount))) return null;
        const merchandise = cents(p.groupTotal - sum(setup));
        return {
            key: input.key, style: input.product.style, name: input.product.name,
            color: input.color?.name || 'Color to be confirmed', image: safeImage(input.color?.image),
            method: input.method, methodName: names[input.method], description: input.description || '',
            unitWord: input.unitWord === 'cap' ? 'cap' : 'pc',
            sizes: input.sizes || '', quantity: p.itemQuantity, hasQuantity: input.quantityRequested !== false,
            merchandise, unit: merchandise / p.itemQuantity, setup, smallOrder: Number(p.ltm?.fee || 0), total: p.groupTotal,
            tiers: (input.tiers || []).map(tier).filter(Boolean), recommended: !!input.recommended,
            builderHref: input.builderHref || '',
        };
    }

    function model(inputs, details = {}, now = new Date()) {
        const options = inputs.map(option).filter(Boolean);
        const expiry = new Date(now); expiry.setDate(expiry.getDate() + 30);
        const quick = details.mode === 'quick';
        return {
            title: quick ? 'Decoration options' : 'Line Sheet', quick, method: quick ? '' : String(details.method || ''),
            subtitle: String(details.subtitle || '').trim(), options,
            customer: String(details.customer || '').trim(), company: String(details.company || '').trim(),
            rep: String(details.rep || '').trim(), email: String(details.email || '').trim(),
            notes: String(details.notes || '').trim(), date: date(now), expires: date(expiry),
            showBreaks: details.showBreaks !== false,
            release: /^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(details.release || '') ? details.release : '',
            smallBatch: options.some(o => o.tiers.some(t => t.ltmFee > 0)),
            terms: 'Estimate only · pricing valid 30 days · confirm stock & sizes at order time.',
            assumptions: (options.some(o => o.sizes) ? 'Priced for the sizes listed.' : 'Standard sizes shown; 2XL and up may cost more.')
                + (details.showBreaks !== false && options.some(o => o.tiers.length) ? ' Each price applies from the first quantity in its range.' : '')
                + ' Tax and shipping not included.'
                + (options.length > 1 ? (quick ? ' Each option is a separate estimate; options are not added together.' : ' Each style is priced on its own.') : ''),
        };
    }

    // A row priced differently from the sheet (a cap on an Embroidery sheet) names its own decoration.
    const ownMethod = (doc, o) => doc.quick || (doc.method && o.method !== doc.method);
    const heading = (doc, o) => o.methodName + (o.description ? ' · ' + o.description : '');
    const rangeText = t => t.max === null ? t.min + '+' : t.min + '–' + t.max;
    const inTier = (t, q) => q >= t.min && (t.max === null || q <= t.max);
    const current = (t, o) => o.hasQuantity && inTier(t, o.quantity);
    const pieces = (q, word) => q + ' ' + (word === 'cap' ? (q === 1 ? 'cap' : 'caps') : (q === 1 ? 'pc' : 'pcs'));
    // One-time setup is a constant for most methods; show it once unless a tier differs.
    function setupSummary(o) {
        const values = [...new Set(o.tiers.map(t => t.setup))];
        return { varies: values.length > 1, amount: values.length === 1 ? values[0] : 0, labels: [...new Set(o.setup.map(f => f.label))].join(', ') };
    }
    function feeCell(t) { return t.ltmFee > 0 ? '+' + money(t.ltmFee) : '–'; }
    function exactText(o) {
        const setup = sum(o.setup);
        return pieces(o.quantity, o.unitWord) + ': ' + money(o.unit) + '/' + o.unitWord + ' all-in · ' + money(o.total) + ' total'
            + (setup ? ' incl. ' + money(setup) + ' one-time setup' : '');
    }
    function ladder(o) {
        if (!o.tiers.length) return '';
        const cell = (t, extra = '') => { const cls = [current(t, o) ? 'is-current' : '', extra].filter(Boolean).join(' '); return cls ? ' class="' + cls + '"' : ''; };
        const setup = setupSummary(o);
        return '<div class="qq-sheet-ladder-wrap" role="region" aria-label="Price breaks for ' + escape(o.style) + '" tabindex="0"><table class="qq-sheet-ladder"><thead><tr><th scope="col">Qty</th>'
            + o.tiers.map(t => '<th scope="col"' + cell(t) + '>' + escape(rangeText(t)) + '</th>').join('')
            + '</tr></thead><tbody><tr><th scope="row">Per ' + o.unitWord + '</th>' + o.tiers.map(t => '<td' + cell(t) + '>' + money(t.base) + '</td>').join('') + '</tr>'
            + (o.tiers.some(t => t.ltmFee > 0) ? '<tr class="qq-fee-row"><th scope="row">Small-batch fee</th>' + o.tiers.map(t => '<td' + cell(t, t.ltmFee > 0 ? 'warn' : '') + '>' + feeCell(t) + '</td>').join('') + '</tr>' : '')
            + (setup.varies ? '<tr><th scope="row">Setup (one time)</th>' + o.tiers.map(t => '<td' + cell(t) + '>' + money(t.setup) + '</td>').join('') + '</tr>' : '')
            + '</tbody></table></div>'
            + (!setup.varies && setup.amount > 0 ? '<p class="qq-sheet-note">Plus ' + money(setup.amount) + ' one-time setup' + (setup.labels ? ' (' + escape(setup.labels) + ')' : '') + '.</p>' : '');
    }
    function html(doc) {
        return '<header class="qq-sheet-head"><img class="qq-sheet-logo" src="' + LOGO + '" alt="Northwest Custom Apparel">'
            + '<div class="qq-sheet-htext"><div class="qq-sheet-brand">Northwest Custom Apparel</div><div class="qq-sheet-sub">' + escape(doc.title + (doc.subtitle ? ' · ' + doc.subtitle : '')) + '</div></div>'
            + '<div class="qq-document-date">' + escape(doc.date) + '<br>Valid through ' + escape(doc.expires) + '</div></header>'
            + ((doc.customer || doc.company) ? '<p class="qq-document-customer">Prepared for <strong>' + escape([doc.customer, doc.company].filter(Boolean).join(' · ')) + '</strong></p>' : '')
            + doc.options.map((o, i) => '<article class="qq-sheet-item">'
                + (o.image ? '<img class="qq-sheet-img" src="' + escape(o.image) + '" alt="' + escape(o.name + ' in ' + o.color) + '" referrerpolicy="no-referrer">' : '<span class="qq-sheet-img"></span>')
                + '<div class="qq-sheet-item-main">'
                + ((doc.quick && doc.options.length > 1) || o.recommended ? '<span class="qq-option-label">' + escape([doc.quick && doc.options.length > 1 ? 'Option ' + (i + 1) : '', o.recommended ? 'Our recommendation' : ''].filter(Boolean).join(' · ')) + '</span>' : '')
                + '<h3 class="qq-sheet-item-head"><span class="qq-sheet-style">' + escape(o.style) + '</span> · ' + escape(o.name) + ' <span class="qq-sheet-color">Color: ' + escape(o.color) + '</span></h3>'
                + (ownMethod(doc, o) ? '<p class="qq-sheet-method"><strong>' + escape(o.methodName) + '</strong>' + (o.description ? ' · ' + escape(o.description) : '') + '</p>' : '')
                + (doc.showBreaks ? ladder(o) : '')
                + (o.hasQuantity ? '<p class="qq-sheet-exact" data-total="' + o.total + '"><strong>' + escape(exactText(o)) + '</strong></p>' : '')
                + (o.sizes ? '<p class="qq-sheet-note">' + escape(o.sizes) + '</p>' : '')
                + '</div></article>').join('')
            + '<footer class="qq-sheet-foot">' + (doc.notes ? '<p class="qq-sheet-notes">' + escape(doc.notes) + '</p>' : '')
            + '<div>' + escape(doc.terms) + (doc.smallBatch ? ' Small-batch fee is charged once per order.' : '') + '</div>'
            + '<div>' + escape(doc.assumptions) + '</div>'
            + '<div>' + escape((doc.rep ? doc.rep + ' · ' : '') + CONTACT + ' · ' + (doc.email || 'sales@nwcustomapparel.com')) + '</div></footer>';
    }

    function text(doc) {
        const lines = ['Northwest Custom Apparel — ' + doc.title + (doc.subtitle ? ' · ' + doc.subtitle : ''), doc.date + ' · valid through ' + doc.expires];
        if (doc.customer || doc.company) lines.push('Prepared for ' + [doc.customer, doc.company].filter(Boolean).join(' · '));
        doc.options.forEach((o, i) => {
            lines.push('', (doc.quick && doc.options.length > 1 ? 'Option ' + (i + 1) + ': ' : '') + o.style + ' · ' + o.name + ' · Color: ' + o.color + (o.recommended ? ' (our recommendation)' : ''));
            if (ownMethod(doc, o)) lines.push(heading(doc, o));
            if (doc.showBreaks) {
                o.tiers.forEach(t => lines.push('  ' + rangeText(t) + ': ' + money(t.base) + '/' + o.unitWord + (t.ltmFee > 0 ? ' + ' + money(t.ltmFee) + ' small-batch fee (once per order)' : '') + (setupSummary(o).varies && t.setup ? '; one-time setup ' + money(t.setup) : '')));
                const setup = setupSummary(o);
                if (!setup.varies && setup.amount > 0) lines.push('  Plus ' + money(setup.amount) + ' one-time setup' + (setup.labels ? ' (' + setup.labels + ')' : ''));
            }
            if (o.hasQuantity) lines.push('  ' + exactText(o));
            if (o.sizes) lines.push('  ' + o.sizes);
        });
        lines.push('', doc.terms + (doc.smallBatch ? ' Small-batch fee is charged once per order.' : ''), doc.assumptions);
        if (doc.notes) lines.push(doc.notes);
        lines.push((doc.rep ? doc.rep + ' · ' : '') + CONTACT + ' · ' + (doc.email || 'sales@nwcustomapparel.com'));
        return lines.join('\n');
    }

    // jsPDF writes text as text, never customer-supplied HTML. It follows the same rows as html().
    async function pdf(doc, JsPDF, getImage) {
        const file = new JsPDF({ unit: 'pt', format: 'letter', compress: true });
        const clean = s => String(s ?? '').replace(/≤/g, 'up to ').replace(/×/g, 'x').replace(/[–—]/g, '-').replace(/·/g, ' | ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
        const width = 524, left = 44, right = left + width, bottom = 714;
        const colors = { ink: [36, 51, 42], green: [47, 125, 62], pale: [238, 245, 239], muted: [89, 103, 94], rule: [213, 222, 215], white: [255, 255, 255], warn: [138, 74, 8] };
        let y = 0, pageTop = 0, context = '';
        file.setLineHeightFactor(1.3);
        const lines = (s, size = 10, bold = false, max = width) => {
            file.setFont('helvetica', bold ? 'bold' : 'normal'); file.setFontSize(size);
            return file.splitTextToSize(clean(s), max);
        };
        const write = (s, x, top, size = 10, bold = false, max = width, color = colors.ink, align = 'left') => {
            const wrapped = lines(s, size, bold, max);
            file.setTextColor(...color); file.text(wrapped, x, top + size, { align });
            return wrapped.length * size * 1.3;
        };
        const rule = (top, color = colors.rule, weight = 0.6) => { file.setDrawColor(...color); file.setLineWidth(weight); file.line(left, top, right, top); };
        const logo = getImage ? await getImage(LOGO, { width: 440, height: 240 }) : null;
        const head = () => {
            if (logo) file.addImage(logo, 'PNG', left, 38, 80, 44);
            const x = logo ? left + 96 : left, dateWidth = 150;
            write('Northwest Custom Apparel', x, 40, 17, true, right - x - dateWidth);
            write(doc.title + (doc.subtitle ? ' · ' + doc.subtitle : ''), x, 62, 10, false, right - x - dateWidth, colors.muted);
            write(doc.date, right, 42, 9, false, dateWidth, colors.muted, 'right');
            write('Valid through ' + doc.expires, right, 55, 9, false, dateWidth, colors.muted, 'right');
            rule(96, colors.green, 1.5);
            y = 110; pageTop = y;
        };
        const newPage = () => {
            file.addPage(); head();
            if (context) y += write(context + ' (continued)', left, y, 9, true) + 10;
        };
        const ensure = height => { if (y + height > bottom && y > pageTop) newPage(); };
        const flow = (s, size = 10, bold = false, max = width, x = left, color = colors.ink) => {
            for (const line of lines(s, size, bold, max)) {
                ensure(size * 1.3);
                y += write(line, x, y, size, bold, max, color);
            }
        };
        const photoWidth = 64, photoHeight = 76, gap = 14;
        const tableRows = (o, tiers) => {
            const setup = setupSummary(o);
            return [
                { values: ['Qty', ...tiers.map(rangeText)], header: true, size: 9.5, bold: true },
                { values: ['Per ' + o.unitWord, ...tiers.map(t => money(t.base))], size: 10.5, bold: true },
                ...(o.tiers.some(t => t.ltmFee > 0) ? [{ values: ['Small-batch fee', ...tiers.map(feeCell)], size: 9.5, fee: true }] : []),
                ...(setup.varies ? [{ values: ['Setup (one time)', ...tiers.map(t => money(t.setup))], size: 9 }] : []),
            ];
        };
        const layout = (o, tiers, tableWidth) => {
            const widths = [88, ...tiers.map(() => (tableWidth - 88) / tiers.length)];
            return tableRows(o, tiers).map(row => ({ ...row, widths, height: Math.max(...row.values.map((v, i) => lines(v, row.size, row.bold, widths[i] - 10).length * row.size * 1.3)) + 10 }));
        };
        head();
        if (doc.customer || doc.company) { flow('Prepared for ' + [doc.customer, doc.company].filter(Boolean).join(' | '), 11, true); y += 10; }
        for (const [i, o] of doc.options.entries()) {
            context = '';
            const photo = o.image && getImage ? await getImage(o.image) : null;
            const x = left + photoWidth + gap, contentWidth = right - x;
            const groups = [];
            if (doc.showBreaks) for (let start = 0; start < o.tiers.length; start += 6) groups.push(o.tiers.slice(start, start + 6));
            const label = [doc.quick && doc.options.length > 1 ? 'Option ' + (i + 1) : '', o.recommended ? 'Our recommendation' : ''].filter(Boolean).join(' | ');
            const texts = [
                ...(label ? [{ text: label, size: 8.5, bold: true, color: colors.green }] : []),
                { text: o.style + ' · ' + o.name, size: 12, bold: true },
                { text: 'Color: ' + o.color, size: 9.5, color: colors.muted },
                ...(ownMethod(doc, o) ? [{ text: heading(doc, o), size: 9.5, bold: true }] : []),
            ];
            const textHeight = texts.reduce((h, row) => h + lines(row.text, row.size, row.bold, contentWidth).length * row.size * 1.3 + 2, 0);
            const tableHeight = groups.reduce((h, g) => h + layout(o, g, contentWidth).reduce((s, row) => s + row.height, 0) + 8, 0);
            const setup = setupSummary(o);
            const extraHeight = (!setup.varies && setup.amount > 0 ? 14 : 0) + (o.hasQuantity ? 18 : 0) + (o.sizes ? 14 : 0);
            // Keep an ordinary style block together; an oversized one still flows safely.
            ensure(Math.min(bottom - pageTop, Math.max(photoHeight, textHeight + tableHeight + extraHeight) + 16));
            context = (label ? label + ' | ' : '') + o.style;
            const top = y, page = file.getNumberOfPages();
            if (photo) file.addImage(photo, 'PNG', left, y, photoWidth, photoHeight);
            for (const row of texts) { flow(row.text, row.size, row.bold, contentWidth, x, row.color); y += 2; }
            y += 4;
            for (const group of groups) {
                const rows = layout(o, group, contentWidth);
                ensure(rows.reduce((h, row) => h + row.height, 0) + 8);
                for (const row of rows) {
                    let xx = x;
                    row.values.forEach((value, col) => {
                        const tierRow = col > 0 ? group[col - 1] : null;
                        const shade = tierRow && current(tierRow, o);
                        file.setFillColor(...(row.header ? colors.green : shade || col === 0 ? colors.pale : colors.white));
                        file.setDrawColor(...colors.rule); file.setLineWidth(0.5);
                        file.rect(xx, y, row.widths[col], row.height, 'FD');
                        const color = row.header ? colors.white : row.fee && tierRow && tierRow.ltmFee > 0 ? colors.warn : colors.ink;
                        const height = lines(value, row.size, row.bold, row.widths[col] - 10).length * row.size * 1.3;
                        write(value, col ? xx + row.widths[col] / 2 : xx + 6, y + (row.height - height) / 2, row.size, row.bold || col === 0, row.widths[col] - 10, color, col ? 'center' : 'left');
                        xx += row.widths[col];
                    });
                    y += row.height;
                }
                y += 8;
            }
            if (!setup.varies && setup.amount > 0 && doc.showBreaks) flow('Plus ' + money(setup.amount) + ' one-time setup' + (setup.labels ? ' (' + setup.labels + ')' : '') + '.', 9, false, contentWidth, x, colors.muted);
            if (o.hasQuantity) { y += 2; flow(exactText(o), 10.5, true, contentWidth, x); }
            if (o.sizes) flow(o.sizes, 9, false, contentWidth, x, colors.muted);
            if (photo && file.getNumberOfPages() === page) y = Math.max(y, top + photoHeight);
            y += 10;
            if (i < doc.options.length - 1) { rule(y); y += 12; }
        }
        context = '';
        const contact = (doc.rep ? doc.rep + ' | ' : '') + CONTACT + ' | ' + (doc.email || 'sales@nwcustomapparel.com');
        const terms = doc.terms + (doc.smallBatch ? ' Small-batch fee is charged once per order.' : '');
        const notesHeight = doc.notes ? lines(doc.notes, 10).length * 13 + 26 : 0;
        ensure(notesHeight + lines(terms, 9).length * 11.7 + lines(doc.assumptions, 9).length * 11.7 + lines(contact, 10, true).length * 13 + 40);
        rule(y); y += 12;
        if (doc.notes) { flow('Notes', 11, true); y += 4; context = 'Notes'; flow(doc.notes); context = ''; y += 10; }
        flow(terms, 9, false, width, left, colors.muted); y += 2;
        flow(doc.assumptions, 9, false, width, left, colors.muted); y += 8;
        flow(contact, 10, true, width, left, colors.green);
        const pages = file.getNumberOfPages();
        for (let page = 1; page <= pages; page++) {
            file.setPage(page);
            write('Page ' + page + ' of ' + pages, right, 750, 8, false, 100, colors.muted, 'right');
        }
        // The Quick Quote version stays out of the customer's view; it is only in the file properties.
        file.setProperties({ title: 'NWCA ' + doc.title, author: doc.rep || 'Northwest Custom Apparel', creator: 'NWCA Quick Quote' + (doc.release ? ' ' + doc.release : '') });
        return file;
    }
    const api = { model, html, pdf, text, option, exactText, money, escape, names };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.QuickQuoteDocument = api;
})(typeof window !== 'undefined' ? window : globalThis);
