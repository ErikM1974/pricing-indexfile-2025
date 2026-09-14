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
        const width = 524, left = 44; let y = 0;
        const write = (s, x, yy, size = 10, bold = false, max = width) => {
            file.setFont('helvetica', bold ? 'bold' : 'normal'); file.setFontSize(size);
            const lines = file.splitTextToSize(clean(s), max); file.text(lines, x, yy); return lines.length * size * 1.25;
        };
        const head = () => {
            file.setTextColor(26, 51, 38); y = 48;
            y += write('Northwest Custom Apparel', left, y, 18, true);
            y += write(doc.title + ' | Estimate', left, y + 3, 11);
            y += write(doc.date + ' | Valid through ' + doc.expires, left, y + 4, 9);
            if (doc.customer || doc.company) y += write('Prepared for ' + [doc.customer, doc.company].filter(Boolean).join(' | '), left, y + 5, 11, true);
            y += 13; file.setDrawColor(47, 125, 62); file.line(left, y, 568, y); y += 18;
        };
        head();
        for (const [i, o] of doc.options.entries()) {
            const contentWidth = o.image ? width - 82 : width;
            file.setFontSize(11);
            const description = file.splitTextToSize(clean(o.name + '\n' + o.methodName + '\n' + o.description), contentWidth).length * 15;
            const needed = Math.max(86, description + 28) + (o.hasQuantity ? 65 + chargeRows(o).length * 24 : 0) + (doc.showBreaks && o.tiers.length ? 112 : 0) + 44;
            if (y + needed > 650 && i > 0) { file.addPage(); head(); }
            const image = o.image && getImage ? await getImage(o.image) : null;
            if (image) file.addImage(image, 'PNG', left, y, 66, 76);
            const x = image ? left + 82 : left;
            let titleY = y + 11;
            if (doc.options.length > 1) titleY += write('Option ' + (i + 1) + (o.recommended ? ' | Our recommendation' : ''), x, titleY, 9, true, contentWidth);
            titleY += write(o.style + ' | ' + o.name, x, titleY + 3, 12, true, contentWidth) + 5;
            titleY += write(o.color + ' | ' + o.methodName, x, titleY, 10, false, contentWidth) + 4;
            titleY += write(o.description, x, titleY, 10, false, contentWidth);
            y = Math.max(y + (image ? 87 : 0), titleY + 12);
            if (doc.showBreaks && o.tiers.length) {
                y += write('Price breaks | Prices at the quantities shown, including small-order pricing', left, y, 9, true) + 4;
                const cell = width / o.tiers.length;
                const setup = o.tiers.some(t => tierSetup(t, o) > 0);
                o.tiers.forEach((t, n) => {
                    const xx = left + cell * n;
                    write(tierLabel(t) + ' pieces', xx, y + 4, 9, true, cell - 5);
                    write('At ' + tierQuantity(t, o) + ': ' + money(tierPrice(t, o)) + '/pc', xx, y + 19, 9, false, cell - 5);
                    if (setup) write('Setup: ' + money(tierSetup(t, o)), xx, y + 34, 9, false, cell - 5);
                });
                y += setup ? 58 : 43;
            }
            if (o.hasQuantity) {
                y += write(o.quantity + ' pieces | ' + money(o.unit) + '/piece, including small-order pricing' + (o.setup.length ? '; setup separate' : ''), left, y, 10, true) + 6;
                for (const row of chargeRows(o)) {
                    const height = write(row.label, left, y, 9, false, 405);
                    file.text(money(row.amount), 568, y, { align: 'right' }); y += Math.max(17, height + 4);
                }
                write('Estimated total', left, y, 12, true); file.text(money(o.total), 568, y, { align: 'right' }); y += 20;
            }
            y += write(o.sizes, left, y, 9) + 16;
        }
        // Notes/next steps flow to another page rather than disappearing beneath a footer.
        const ending = [doc.notes, doc.next, (doc.rep || 'Northwest Custom Apparel') + '\n' + (doc.email || 'sales@nwcustomapparel.com') + ' | (253) 922-5793'].filter(Boolean).join('\n');
        const endLines = file.splitTextToSize(clean(ending), width);
        if (y + endLines.length * 13 > 665) { file.addPage(); head(); }
        write(ending, left, y, 10);
        const pages = file.getNumberOfPages();
        for (let page = 1; page <= pages; page++) {
            file.setPage(page); file.setTextColor(75, 85, 80);
            write(doc.assumptions, left, 696, 8);
            write('Northwest Custom Apparel | (253) 922-5793', left, 737, 9);
            write('Page ' + page + ' of ' + pages, left, 757, 8);
        }
        file.setProperties({ title: 'NWCA ' + doc.title, author: doc.rep || 'Northwest Custom Apparel' });
        return file;
    }
    const api = { model, html, pdf, text, option, chargeRows, money, escape, names };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.QuickQuoteDocument = api;
})(typeof window !== 'undefined' ? window : globalThis);
