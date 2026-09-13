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
            placements: input.placements || [], sizes: input.sizes, quantity: p.itemQuantity,
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
            title: details.mode === 'quick' ? 'Decoration options' : 'Product options', options,
            customer: String(details.customer || '').trim(), company: String(details.company || '').trim(),
            rep: String(details.rep || '').trim(), email: String(details.email || '').trim(),
            notes: String(details.notes || '').trim(), date: date(now), expires: date(expiry),
            lowest, showBreaks: details.showBreaks !== false,
            assumptions: 'Each option is a separate estimate. Options are not added together. Tax and shipping are not included. Confirm sizes, stock and artwork before ordering. Per-piece figures are rounded; totals use exact pricing.',
            next: 'Ready to choose? Contact your rep to confirm your option, sizes and artwork. This estimate does not place an order.',
        };
    }

    function diagram(placements) {
        if (!placements.length) return '';
        const back = placements.some(p => /back/i.test(p));
        const front = placements.some(p => /front|chest/i.test(p));
        const sleeve = placements.some(p => /sleeve/i.test(p));
        const cap = placements.some(p => /cap/i.test(p));
        return '<span class="qq-placement-figure" role="img" aria-label="Placement guide: ' + escape(placements.join(', ')) + '">'
            + '<svg viewBox="0 0 110 66" width="110" height="66" aria-hidden="true">'
            + (cap ? '<path d="M23 40C23 11 72 11 72 40L92 48H18Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="49" cy="32" r="5" fill="currentColor"/>'
                : '<path d="M14 18L30 10Q39 20 48 10L63 18L72 33L60 39L55 30V58H22V30L16 39L5 33Z" fill="none" stroke="currentColor" stroke-width="2"/>'
                + (front ? '<circle cx="45" cy="26" r="4" fill="currentColor"/>' : '')
                + (sleeve ? '<circle cx="13" cy="28" r="4" fill="currentColor"/>' : '')
                + (back ? '<rect x="82" y="21" width="20" height="26" rx="3" fill="none" stroke="currentColor"/><circle cx="92" cy="33" r="4" fill="currentColor"/>' : ''))
            + '</svg><small>Placement guide</small></span>';
    }

    function tierQuantity(tier, option) {
        return option.quantity >= tier.range.min && option.quantity <= tier.range.max ? option.quantity : tier.sampleQuantity;
    }
    function tierPrice(tier, option) {
        return tierQuantity(tier, option) === option.quantity ? option.unit : tier.sampleUnit;
    }
    function ladder(option) {
        if (!option.tiers.length) return '';
        const active = t => option.quantity >= t.range.min && option.quantity <= t.range.max ? ' class="is-current"' : '';
        return '<div class="qq-sheet-ladder-wrap" role="region" aria-label="Quantity prices for ' + escape(option.style) + '" tabindex="0"><table class="qq-sheet-ladder"><caption>Quantity options · includes small-order pricing; setup separate</caption><thead><tr><th scope="col">At quantity</th>'
            + option.tiers.map(t => '<th scope="col"' + active(t) + '>' + tierQuantity(t, option) + '</th>').join('')
            + '</tr></thead><tbody><tr><th scope="row">Per piece</th>' + option.tiers.map(t => '<td' + active(t) + '>' + money(tierPrice(t, option)) + '</td>').join('')
            + '</tr></tbody></table></div>';
    }
    function chargeRows(o) {
        return [{ label: o.quantity + ' pieces · garment + decoration' + (o.smallOrder ? ' + small-order pricing' : ''), amount: o.merchandise }]
            .concat(o.setup.map(f => ({ ...f, label: f.label + ' · one time' })));
    }
    function html(doc) {
        return '<header class="qq-sheet-head"><div class="qq-sheet-htext"><div class="qq-sheet-brand">Northwest Custom Apparel</div><div class="qq-sheet-sub">' + escape(doc.title) + ' · Estimate</div></div><div class="qq-document-date">' + escape(doc.date) + '<br>Valid through ' + escape(doc.expires) + '</div></header>'
            + ((doc.customer || doc.company) ? '<p class="qq-document-customer">Prepared for <strong>' + escape([doc.customer, doc.company].filter(Boolean).join(' · ')) + '</strong></p>' : '')
            + '<p class="qq-document-assumptions">' + escape(doc.assumptions) + '</p>'
            + doc.options.map((o, i) => '<article class="qq-sheet-item"><div class="qq-document-product">'
                + (o.image ? '<img class="qq-sheet-img" src="' + escape(o.image) + '" alt="' + escape(o.name + ' in ' + o.color) + '" referrerpolicy="no-referrer">' : '')
                + '<div><span class="qq-option-label">Option ' + (i + 1) + (o.recommended ? ' · Our recommendation' : '') + '</span><h2>' + escape(o.name) + '</h2><p>' + escape(o.style + ' · ' + o.color) + '</p></div></div>'
                + '<div class="qq-document-decoration">' + diagram(o.placements) + '<div><strong>' + escape(o.methodName) + '</strong><p>' + escape(o.description) + '</p><p>' + escape(o.sizes) + '</p></div></div>'
                + '<dl class="qq-document-charges">' + chargeRows(o).map(f => '<div><dt>' + escape(f.label) + '</dt><dd>' + money(f.amount) + '</dd></div>').join('')
                + '<div class="qq-document-total"><dt>Estimated total</dt><dd>' + money(o.total) + '</dd></div></dl>'
                + '<p class="qq-document-unit">' + money(o.unit) + '/piece including small-order pricing; setup separate' + (doc.options.length > 1 && o.total === doc.lowest ? ' · Lowest price at this quantity' : '') + '</p>'
                + (doc.showBreaks ? ladder(o) : '') + '</article>').join('')
            + '<footer class="qq-sheet-foot">' + (doc.notes ? '<p>' + escape(doc.notes) + '</p>' : '')
            + '<p>' + escape(doc.next) + '</p><strong>' + escape(doc.rep || 'Northwest Custom Apparel') + '</strong><br>' + escape(doc.email || 'sales@nwcustomapparel.com') + ' · (253) 922-5793</footer>';
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
            const description = file.splitTextToSize(clean(o.description + '\n' + o.sizes), 405).length * 13;
            const needed = 168 + description + chargeRows(o).length * 17 + (doc.showBreaks && o.tiers.length ? 78 : 0);
            if (y + needed > 650 && i > 0) { file.addPage(); head(); }
            const image = o.image && getImage ? await getImage(o.image) : null;
            if (image) file.addImage(image, 'PNG', left, y, 66, 76);
            const x = image ? left + 82 : left;
            write('OPTION ' + (i + 1) + (o.recommended ? ' | OUR RECOMMENDATION' : ''), x, y + 10, 9, true, 430);
            let titleY = y + 29;
            titleY += write(o.name, x, titleY, 13, true, 430);
            write(o.style + ' | ' + o.color, x, titleY + 4, 10, false, 430);
            y = Math.max(y + 91, titleY + 30);
            y += write(o.methodName, left, y, 11, true);
            y += write(o.description, left, y + 3, 10);
            y += write(o.sizes, left, y + 3, 9); y += 14;
            for (const row of chargeRows(o)) { write(row.label, left, y, 10, false, 405); file.text(money(row.amount), 568, y, { align: 'right' }); y += 17; }
            file.setDrawColor(205, 215, 207); file.line(left, y - 5, 568, y - 5); y += 12;
            write('Estimated total', left, y, 13, true); file.text(money(o.total), 568, y, { align: 'right' }); y += 18;
            y += write(money(o.unit) + '/piece including small-order pricing; setup separate' + (doc.options.length > 1 && o.total === doc.lowest ? ' | Lowest price at this quantity' : ''), left, y, 9);
            if (doc.showBreaks && o.tiers.length) {
                y += 14; y += write('Other quantities | Per piece including small-order pricing; setup separate', left, y, 9, true);
                const cell = width / o.tiers.length;
                o.tiers.forEach((t, n) => { write('Qty ' + tierQuantity(t, o), left + cell * n, y + 4, 9, true, cell); write(money(tierPrice(t, o)), left + cell * n, y + 18, 9); });
                y += 45;
            }
            y += 22;
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
    const api = { model, html, pdf, option, chargeRows, money, escape, names };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.QuickQuoteDocument = api;
})(typeof window !== 'undefined' ? window : globalThis);
