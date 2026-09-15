/* One customer document model for the screen, paper and downloadable PDF. Prices are engine results. */
(function (root) {
    'use strict';
    const names = { emb: 'Embroidery', capemb: 'Cap embroidery', dtg: 'Full-color direct print (DTG)', scp: 'Screen printing', dtf: 'Full-color transfers (DTF)' };
    const money = value => value != null && Number.isFinite(Number(value)) ? '$' + Number(value).toFixed(2) : '—';
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const sum = rows => rows.reduce((total, row) => total + Number(row.amount || 0), 0);
    const date = value => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'America/Los_Angeles' }).format(value);
    const safeImage = value => /^(https?:\/\/|\/[^/])/.test(String(value || '')) ? value : '';

    function option(input) {
        const p = input.preview;
        if (!p?.ok || !Number.isFinite(p.groupTotal) || !(p.itemQuantity > 0)) return null;
        const setup = (p.fees || []).filter(f => f.oneTime).map(f => ({ label: f.label || f.code || 'One-time setup', amount: Number(f.amount) }));
        if (setup.some(f => !Number.isFinite(f.amount))) return null;
        const smallOrder = Number(p.ltm?.fee || 0);
        const merchandise = Math.round((p.groupTotal - sum(setup)) * 100) / 100;
        return {
            key: input.key, style: input.product.style, name: input.product.name,
            color: input.color?.name || 'Color to be confirmed', image: safeImage(input.color?.image),
            method: input.method, methodName: names[input.method], description: input.description,
            placements: input.placements || [], sizes: input.sizes, quantity: p.itemQuantity, hasQuantity: input.quantityRequested !== false,
            merchandise, unit: merchandise / p.itemQuantity, setup, smallOrder, total: p.groupTotal,
            tiers: input.tiers || [], recommended: !!input.recommended,
            builderHref: input.builderHref || '',
        };
    }

    function model(inputs, details = {}, now = new Date()) {
        const options = inputs.map(option).filter(Boolean);
        const expiry = new Date(now); expiry.setDate(expiry.getDate() + 30);
        const lowest = options.length ? Math.min(...options.map(o => o.total)) : null;
        return {
            title: details.mode === 'quick' ? 'Decoration options' : 'Quantity price sheet', options,
            customer: String(details.customer || '').trim(), company: String(details.company || '').trim(),
            rep: String(details.rep || '').trim(), email: String(details.email || '').trim(),
            notes: String(details.notes || '').trim(), date: date(now), expires: date(expiry),
            lowest, showBreaks: details.showBreaks !== false,
            assumptions: (options.length > 1 ? 'Each option is a separate estimate; options are not added together. ' : '') + 'Tax and shipping are not included. Confirm sizes, stock and artwork. Per-piece figures are rounded; totals use exact pricing.',
            next: 'Contact your rep to confirm your quote. This estimate does not place an order.',
        };
    }

    function tierQuantity(tier, option) {
        return option.hasQuantity && option.quantity >= tier.range.min && option.quantity <= tier.range.max ? option.quantity : tier.sampleQuantity;
    }
    function tierPrice(tier, option) {
        return option.hasQuantity && tierQuantity(tier, option) === option.quantity ? option.unit : tier.sampleUnit;
    }
    function tierSetup(tier, option) {
        return option.hasQuantity && tierQuantity(tier, option) === option.quantity ? sum(option.setup) : Number(tier.sampleSetup || 0);
    }
    function tierLabel(tier) { return String(tier.label || '').replace(/-/g, '–'); }
    function ladder(option) {
        if (!option.tiers.length) return '';
        const active = t => option.hasQuantity && tierQuantity(t, option) === option.quantity ? ' class="is-current"' : '';
        return '<div class="qq-sheet-ladder-wrap" role="region" aria-label="Quantity prices for ' + escape(option.style) + '" tabindex="0"><table class="qq-sheet-ladder"><caption>Per-piece prices at the quantities shown · small-order pricing included</caption><thead><tr><th scope="col">Price break</th>'
            + option.tiers.map(t => '<th scope="col"' + active(t) + '>' + escape(tierLabel(t)) + '</th>').join('')
            + '</tr></thead><tbody><tr><th scope="row">Price at qty</th>' + option.tiers.map(t => '<td' + active(t) + '><button type="button" class="btn btn-ghost qq-table-action" data-quote-quantity="' + tierQuantity(t, option) + '" aria-label="Use ' + tierQuantity(t, option) + ' pieces for ' + escape(option.style) + '">' + tierQuantity(t, option) + '</button></td>').join('')
            + '</tr><tr><th scope="row">Per piece</th>' + option.tiers.map(t => '<td' + active(t) + '>' + money(tierPrice(t, option)) + '</td>').join('') + '</tr>'
            + (option.tiers.some(t => tierSetup(t, option) > 0) ? '<tr><th scope="row">Setup · one time</th>' + option.tiers.map(t => '<td' + active(t) + '>' + money(tierSetup(t, option)) + '</td>').join('') + '</tr>' : '')
            + '</tbody></table></div>';
    }
    function chargeRows(o) {
        return [{ label: o.quantity + ' pieces · garment + decoration' + (o.smallOrder ? ' + small-order pricing' : ''), amount: o.merchandise }]
            .concat(o.setup.map(f => ({ ...f, label: f.label + ' · one time' })));
    }
    function html(doc) {
        return '<header class="qq-sheet-head"><div class="qq-sheet-htext"><div class="qq-sheet-brand">Northwest Custom Apparel</div><div class="qq-sheet-sub">' + escape(doc.title) + ' · Estimate</div></div><div class="qq-document-date">' + escape(doc.date) + '<br>Valid through ' + escape(doc.expires) + '</div></header>'
            + ((doc.customer || doc.company) ? '<p class="qq-document-customer">Prepared for <strong>' + escape([doc.customer, doc.company].filter(Boolean).join(' · ')) + '</strong></p>' : '')
            + doc.options.map((o, i) => '<article class="qq-sheet-item"><div class="qq-document-product">'
                + (o.image ? '<img class="qq-sheet-img" src="' + escape(o.image) + '" alt="' + escape(o.name + ' in ' + o.color) + '" referrerpolicy="no-referrer">' : '')
                + '<div>' + (doc.options.length > 1 ? '<span class="qq-option-label">Option ' + (i + 1) + (o.recommended ? ' · Our recommendation' : '') + '</span>' : '') + '<h2>' + escape(o.style + ' · ' + o.name) + '</h2><p>' + escape(o.color) + '</p><strong>' + escape(o.methodName) + '</strong><p>' + escape(o.description) + '</p></div></div>'
                + (doc.showBreaks ? ladder(o) : '')
                + (o.hasQuantity ? '<p class="qq-document-unit">' + o.quantity + ' pieces · <strong>' + money(o.unit) + '/piece</strong> including small-order pricing' + (o.setup.length ? '; setup separate' : '') + '</p>'
                + '<dl class="qq-document-charges">' + chargeRows(o).map(f => '<div><dt>' + escape(f.label) + '</dt><dd>' + money(f.amount) + '</dd></div>').join('')
                + '<div class="qq-document-total"><dt>Estimated total</dt><dd>' + money(o.total) + '</dd></div></dl>'
                : '') + '<p class="qq-document-sizes">' + escape(o.sizes) + '</p></article>').join('')
            + '<footer class="qq-sheet-foot">' + (doc.notes ? '<p>' + escape(doc.notes) + '</p>' : '')
            + '<p>' + escape(doc.assumptions) + '</p><strong>' + escape(doc.rep || 'Northwest Custom Apparel') + '</strong><br>' + escape(doc.email || 'sales@nwcustomapparel.com') + ' · (253) 922-5793</footer>';
    }

    function text(doc) {
        const lines = ['Northwest Custom Apparel — ' + doc.title, 'Valid through ' + doc.expires];
        if (doc.customer || doc.company) lines.push('Prepared for ' + [doc.customer, doc.company].filter(Boolean).join(' · '));
        doc.options.forEach((o, i) => {
            lines.push('', (doc.options.length > 1 ? 'Option ' + (i + 1) + (o.recommended ? ' (recommended)' : '') + ': ' : '') + o.style + ' · ' + o.name + ' · ' + o.color, o.methodName + ': ' + o.description);
            if (doc.showBreaks) o.tiers.forEach(t => lines.push(tierLabel(t) + ' pieces — at ' + tierQuantity(t, o) + ': ' + money(tierPrice(t, o)) + '/piece' + (tierSetup(t, o) ? '; one-time setup ' + money(tierSetup(t, o)) : '')));
            if (o.hasQuantity) {
                lines.push(o.quantity + ' pieces at ' + money(o.unit) + '/piece.');
                o.setup.forEach(f => lines.push(f.label + ' (one time): ' + money(f.amount)));
                lines.push('Estimated total: ' + money(o.total));
            }
            lines.push('Per-piece prices include garment, decoration and applicable small-order pricing.', o.sizes);
        });
        lines.push('', doc.assumptions, doc.notes, doc.rep, (doc.email || 'sales@nwcustomapparel.com') + ' · (253) 922-5793');
        return lines.filter(line => line !== undefined && line !== null).join('\n');
    }

    // jsPDF writes text as text, never customer-supplied HTML. Both outputs use chargeRows().
    async function pdf(doc, JsPDF, getImage) {
        const file = new JsPDF({ unit: 'pt', format: 'letter', compress: true });
        const clean = s => String(s ?? '').replace(/≤/g, 'up to ').replace(/×/g, 'x').replace(/[–—]/g, '-').replace(/·/g, ' | ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
        const width = 524, left = 44, right = left + width, bottom = 714;
        const pieces = quantity => quantity + (quantity === 1 ? ' piece' : ' pieces');
        const colors = { ink: [36, 51, 42], green: [47, 125, 62], pale: [238, 245, 239], muted: [89, 103, 94], rule: [213, 222, 215], white: [255, 255, 255] };
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
        const rule = top => { file.setDrawColor(...colors.rule); file.setLineWidth(0.6); file.line(left, top, right, top); };
        // The existing local logo avoids a new third-party dependency for branding.
        const logo = getImage ? await getImage('/images/nwca-logo.png', { width: 440, height: 240 }) : null;
        const head = () => {
            if (logo) file.addImage(logo, 'PNG', left, 40, 80, 44);
            const x = logo ? left + 100 : left;
            write('Northwest Custom Apparel', x, 40, 17, true, right - x);
            write(doc.title, x, 64, 22, true, right - x);
            write('Customer estimate', left, 107, 10, true, 160, colors.green);
            write(doc.date + '  |  Valid through ' + doc.expires, right, 107, 9, false, 350, colors.muted, 'right');
            file.setDrawColor(...colors.green); file.setLineWidth(1.5); file.line(left, 132, right, 132);
            y = 149; pageTop = y;
        };
        const newPage = () => {
            file.addPage(); head();
            if (context) y += write(context + ' (continued)', left, y, 9, true) + 12;
        };
        const ensure = height => { if (y + height > bottom && y > pageTop) newPage(); };
        // Long notes and decoration descriptions can span pages without crossing the footer.
        const flow = (s, size = 10, bold = false, max = width, x = left, color = colors.ink) => {
            for (const line of lines(s, size, bold, max)) {
                ensure(size * 1.3);
                y += write(line, x, y, size, bold, max, color);
            }
        };
        const tableRows = (o, tiers) => [
            { values: ['Quantity range', ...tiers.map(t => tierLabel(t))], size: 10, bold: true, header: true },
            { values: ['Priced at', ...tiers.map(t => pieces(tierQuantity(t, o)))], size: 9 },
            { values: ['Per piece', ...tiers.map(t => money(tierPrice(t, o)))], size: 13, bold: true },
            ...(tiers.some(t => tierSetup(t, o) > 0) ? [{ values: ['One-time setup', ...tiers.map(t => money(tierSetup(t, o)))], size: 9 }] : []),
        ];
        const tableLayout = (o, tiers) => {
            const widths = [104, ...tiers.map(() => (width - 104) / tiers.length)];
            return tableRows(o, tiers).map(row => ({ ...row, widths, height: Math.max(...row.values.map((v, i) => lines(v, i ? row.size : 9, row.bold, widths[i] - 16).length * (i ? row.size : 9) * 1.3)) + (o.hasQuantity ? 14 : 18) }));
        };
        head();
        if (doc.customer || doc.company) {
            flow('Prepared for ' + [doc.customer, doc.company].filter(Boolean).join(' | '), 11, true); y += 18;
        }
        for (const [i, o] of doc.options.entries()) {
            context = '';
            const photo = o.image && getImage ? await getImage(o.image) : null;
            const tiers = doc.showBreaks ? o.tiers : [], compact = o.hasQuantity && tiers.length > 0;
            const photoWidth = compact ? 96 : 114, photoHeight = photoWidth * 7 / 6;
            const contentWidth = photo ? width - photoWidth - 20 : width, x = photo ? left + photoWidth + 20 : left;
            const productRows = [
                ...(doc.options.length > 1 ? [{ text: 'Option ' + (i + 1) + (o.recommended ? ' | Our recommendation' : ''), size: 9, bold: true, color: colors.green }] : []),
                { text: o.style, size: 10, bold: true, color: colors.green },
                { text: o.name, size: 16, bold: true },
                { text: 'Color: ' + o.color, size: 10 },
                { text: o.methodName, size: 10, bold: true },
                { text: o.description, size: 9.5, color: colors.muted },
            ];
            const rowGap = compact ? 4 : 6;
            const productHeight = Math.max(photo ? photoHeight : 0, productRows.reduce((h, row) => h + lines(row.text, row.size, row.bold, contentWidth).length * row.size * 1.3 + rowGap, 0));
            const firstTableHeight = tiers.length ? tableLayout(o, tiers.slice(0, 5)).reduce((h, row) => h + row.height, 0) + 65 : 0;
            const chargesHeight = o.hasQuantity ? 95 + chargeRows(o).reduce((h, row) => h + lines(row.label, 9, false, 405).length * 11.7 + 10, 0) : 0;
            // Keep an ordinary option together; oversized content still flows safely.
            ensure(Math.min(bottom - pageTop, productHeight + firstTableHeight + chargesHeight + 40));
            context = (doc.options.length > 1 ? 'Option ' + (i + 1) + ' | ' : '') + o.style;
            const productPage = file.getNumberOfPages(), photoBottom = y + photoHeight;
            if (photo) file.addImage(photo, 'PNG', left, y, photoWidth, photoHeight);
            for (const row of productRows) { flow(row.text, row.size, row.bold, contentWidth, x, row.color); y += rowGap; }
            if (photo && file.getNumberOfPages() === productPage) y = Math.max(y, photoBottom);
            y += compact ? 12 : 16;
            for (let start = 0; start < tiers.length; start += 5) {
                const group = tiers.slice(start, start + 5), rows = tableLayout(o, group);
                ensure(rows.reduce((h, row) => h + row.height, 0) + 65);
                flow('Quantity pricing', 13, true); y += 5;
                flow('Garment, decoration and applicable small-order pricing included.', 9, false, width, left, colors.muted); y += 10;
                for (const row of rows) {
                    let xx = left;
                    row.values.forEach((value, col) => {
                        const current = col > 0 && o.hasQuantity && tierQuantity(group[col - 1], o) === o.quantity;
                        file.setFillColor(...(row.header ? colors.green : current || col === 0 ? colors.pale : colors.white));
                        file.setDrawColor(...colors.rule); file.setLineWidth(0.5);
                        file.rect(xx, y, row.widths[col], row.height, 'FD');
                        const size = col ? row.size : 9;
                        const height = lines(value, size, row.bold, row.widths[col] - 16).length * size * 1.3;
                        write(value, col ? xx + row.widths[col] / 2 : xx + 8, y + (row.height - height) / 2, size, row.bold, row.widths[col] - 16, row.header ? colors.white : colors.ink, col ? 'center' : 'left');
                        xx += row.widths[col];
                    });
                    y += row.height;
                }
                y += 10;
                flow('Per-piece prices apply at the quantities shown above.', 8.5, false, width, left, colors.muted); y += compact ? 10 : 16;
            }
            if (o.hasQuantity) {
                ensure(90);
                flow(pieces(o.quantity) + ' at ' + money(o.unit) + ' per piece', 12, true); y += 5;
                if (!tiers.length) { flow('Includes applicable small-order pricing.' + (o.setup.length ? ' One-time setup is listed separately.' : ''), 9, false, width, left, colors.muted); y += 10; }
                const charges = chargeRows(o);
                for (const [n, row] of charges.entries()) {
                    const height = lines(row.label, 9, false, 405).length * 9 * 1.3 + 10;
                    ensure(height + (n === charges.length - 1 ? 46 : 0));
                    write(row.label.replace(/^1 pieces /, '1 piece '), left, y, 9, false, 405);
                    write(money(row.amount), right, y, 10, false, 110, colors.ink, 'right'); y += height;
                }
                ensure(38); file.setFillColor(...colors.pale); file.rect(left, y, width, 36, 'F');
                write('Estimated total', left + 10, y + 9, 12, true);
                write(money(o.total), right - 10, y + 7, 16, true, 140, colors.ink, 'right'); y += 48;
            }
            flow(o.sizes, 9, false, width, left, colors.muted); y += 22;
            if (i < doc.options.length - 1) { rule(y); y += 22; }
        }
        context = '';
        if (doc.notes) { ensure(48); flow('Notes', 11, true); y += 6; context = 'Notes'; flow(doc.notes); context = ''; y += 18; }
        const contact = [doc.rep, doc.email || 'sales@nwcustomapparel.com', '(253) 922-5793'].filter(Boolean).join(' | ');
        const endingHeight = lines(doc.assumptions, 9).length * 11.7 + lines(doc.next, 10).length * 13 + lines(contact, 10, true).length * 13 + 48;
        ensure(endingHeight); rule(y); y += 14;
        flow(doc.assumptions, 9, false, width, left, colors.muted); y += 14;
        flow(doc.next, 10); y += 8;
        flow(contact, 10, true, width, left, colors.green);
        const pages = file.getNumberOfPages();
        for (let page = 1; page <= pages; page++) {
            file.setPage(page);
            write('Page ' + page + ' of ' + pages, right, 750, 8, false, 100, colors.muted, 'right');
        }
        file.setProperties({ title: 'NWCA ' + doc.title, author: doc.rep || 'Northwest Custom Apparel' });
        return file;
    }
    const api = { model, html, pdf, text, option, chargeRows, money, escape, names };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.QuickQuoteDocument = api;
})(typeof window !== 'undefined' ? window : globalThis);
