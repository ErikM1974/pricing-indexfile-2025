/* Staff convenience and customer output. This module never calculates a selling price. */
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const storageKeys = { draft: 'nwca-quick-quote-inputs', products: 'nwca-quick-quote-products' };
    let bridge, scheduled = false, documentModel, busy = false, restoring = false, draftTimer, searchTimer, searchSeq = 0;
    let recommendation = '', excluded = new Set(), context = '', lastOptions = '', libraryPromise;
    let draftAvailable = false, searchInput, searchMatches = [], lastCopy = '', toolsMode;
    const doc = () => window.QuickQuoteDocument;
    function read(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
    function write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; }
        catch { $('qqDraftStatus').textContent = 'Browser storage is unavailable. Keep this tab open or download your estimate.'; return false; }
    }
    function button(label, action, className = 'btn btn-ghost') {
        const b = document.createElement('button'); b.type = 'button'; b.className = className; b.textContent = label; b.addEventListener('click', action); return b;
    }
    function details() {
        return { mode: bridge.state.mode, customer: $('qqCustomerName').value, company: $('qqCompanyName').value,
            rep: $('qqRepName').value, email: $('qqRepEmail').value, notes: $('qqCustomerNotes').value, showBreaks: $('qqShowBreaks').checked };
    }
    function refresh() {
        if (!bridge || scheduled) return;
        scheduled = true;
        queueMicrotask(() => { scheduled = false; render(); });
    }
    function render() {
        const s = bridge.state;
        const nextContext = s.mode + ':' + (s.mode === 'quick' ? s.product?.style || '' : s.lineMethod);
        if (nextContext !== context) { context = nextContext; recommendation = ''; excluded = new Set(); lastOptions = ''; }
        $('qqModeHelp').textContent = s.mode === 'quick' ? 'One product, different decoration options. Choose which options your customer sees.' : 'Different products, one decoration method. Each option is priced separately.';
        const inputs = bridge.options();
        const all = inputs.map(o => ({ ...o, recommended: o.key === recommendation }));
        const optionsKey = JSON.stringify(all.map(o => [o.key, o.product.style, o.method, o.builderHref]));
        if (optionsKey !== lastOptions) {
            const options = $('qqDocumentOptions'); options.replaceChildren(); lastOptions = optionsKey;
            for (const o of all) {
                const row = document.createElement('div'); row.className = 'qq-option-control';
                const label = document.createElement('label'); label.className = 'qq-check'; label.hidden = all.length === 1;
                const check = document.createElement('input'); check.type = 'checkbox'; check.checked = !excluded.has(o.key); check.dataset.option = o.key;
                check.addEventListener('change', () => { if (check.checked) excluded.delete(o.key); else excluded.add(o.key); refresh(); });
                label.append(check, document.createTextNode(s.mode === 'quick' ? doc().names[o.method] : o.product.style)); row.append(label);
                const recommend = button('Recommend', () => { recommendation = recommendation === o.key ? '' : o.key; refresh(); });
                recommend.dataset.recommend = o.key; recommend.hidden = all.length === 1; row.append(recommend);
                if (o.builderHref) { const link = document.createElement('a'); link.className = 'btn btn-ghost'; link.href = o.builderHref; link.textContent = 'Full quote'; link.title = 'Continue with ' + o.product.style + ' and these decoration settings'; row.append(link); }
                options.append(row);
            }
        }
        document.querySelectorAll('[data-recommend]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.recommend === recommendation)); b.textContent = b.dataset.recommend === recommendation ? 'Recommended' : 'Recommend'; });
        const pending = bridge.pending(), errors = bridge.errors();
        documentModel = doc().model(all.filter(o => !excluded.has(o.key)), details());
        const ready = !pending && !errors.length && documentModel.options.length > 0;
        $('qqDocumentStatus').textContent = errors.length ? errors.join(' ') : pending ? 'Checking products and prices…' : !inputs.length ? 'Enter a style or product name to see price breaks.' : !documentModel.options.length ? 'Select at least one option to include.' : '';
        $('qqSheet').hidden = !ready;
        // Renderer escapes every external string and validates image URLs.
        // eslint-disable-next-line no-unsanitized/property
        $('qqSheet').innerHTML = ready ? doc().html(documentModel) : '';
        $('qqLineDownload').disabled = busy || !ready; $('qqLinePrint').disabled = busy || !ready; $('qqCopy').disabled = busy || !ready;
        if (!ready || lastCopy && lastCopy !== doc().text(documentModel)) { $('qqCopyFallback').hidden = true; $('qqCopyText').value = ''; $('qqCopyStatus').textContent = ''; lastCopy = ''; }
        const extras = [];
        if ((s.mode === 'quick' || ['dtf', 'scp'].includes(s.lineMethod)) && (s.sleeves.left || s.sleeves.right)) extras.push([s.sleeves.left ? 'left' : '', s.sleeves.right ? 'right' : ''].filter(Boolean).join(' + ') + ' sleeve');
        if (s.adv.scpDark && (s.mode === 'quick' || s.lineMethod === 'scp')) extras.push('dark garment');
        if (s.adv.scpStripes && (s.mode === 'quick' || s.lineMethod === 'scp')) extras.push('safety stripes');
        $('qqExtraSummary').textContent = extras.length ? '· ' + extras.join(', ') : '';
        $('qqMoreSettings').hidden = ![...$('qqExtraControls').children].some(node => !node.hidden);
        $('qqProductFinder').hidden = s.mode === 'linesheet' && s.lineStyles.length > 0;
        if (toolsMode !== s.mode) { toolsMode = s.mode; $('qqMoreTools').open = s.mode === 'quick'; }
        const selected = s.mode === 'linesheet' ? s.lineStyles.find(row => row.product) : { product: s.product, color: s.color };
        $('qqCatalogLink').href = selected?.product ? '/product.html?style=' + encodeURIComponent(selected.product.style) + '&color=' + encodeURIComponent(selected.color?.catalog || '') : '/';
        rememberProducts(inputs);
        if (!restoring && !draftAvailable) { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 700); }
    }
    function rememberProducts(inputs) {
        const saved = read(storageKeys.products);
        let list = Array.isArray(saved) ? saved.filter(p => p && typeof p.style === 'string' && /^[A-Z0-9._-]{1,40}$/i.test(p.style)).slice(0, 20) : [];
        let changed = false;
        for (const input of inputs) {
            if (!list.some(p => p.style === input.product.style)) { list.unshift({ style: input.product.style, name: input.product.name, favorite: false }); changed = true; }
        }
        list = list.slice(0, 20);
        if (changed) write(storageKeys.products, list);
        renderSavedProducts(list);
    }
    let savedKey = '';
    function renderSavedProducts(list) {
        const key = JSON.stringify(list); if (key === savedKey) return; savedKey = key;
        const area = $('qqSavedProducts'); area.replaceChildren();
        if (!list.length) return;
        const title = document.createElement('span'); title.className = 'field-help'; title.textContent = 'Recent & favorites'; area.append(title);
        for (const p of [...list].sort((a, b) => Number(b.favorite) - Number(a.favorite)).slice(0, 6)) {
            const row = document.createElement('div'); row.className = 'qq-saved-product';
            row.append(button(p.style, () => choose(p.style, $('qqProductSearch'))));
            const star = button(p.favorite ? '★' : '☆', () => { p.favorite = !p.favorite; write(storageKeys.products, list); renderSavedProducts(list); });
            star.setAttribute('aria-label', (p.favorite ? 'Remove favorite ' : 'Favorite ') + p.style); star.setAttribute('aria-pressed', String(!!p.favorite)); row.append(star); area.append(row);
        }
    }
    function choose(style, target = searchInput) {
        try {
            ++searchSeq; clearTimeout(searchTimer);
            bridge.choose(style, target?.isConnected ? Number(target.dataset.uid) || undefined : undefined);
            $('qqSearchPanel').hidden = true; $('qqSearchResults').replaceChildren(); searchMatches = [];
            $('qqSearchStatus').textContent = '';
        }
        catch (error) { $('qqSearchPanel').hidden = false; $('qqSearchStatus').textContent = error.message; }
    }
    async function search() {
        const target = searchInput, query = target.value.trim(), seq = ++searchSeq;
        $('qqSearchResults').replaceChildren();
        if (query.length < 2) { $('qqSearchStatus').textContent = ''; return; }
        $('qqSearchStatus').textContent = 'Searching products…';
        try {
            const response = await fetch(window.APP_CONFIG.API.BASE_URL + '/api/products/search?q=' + encodeURIComponent(query) + '&limit=8', { signal: AbortSignal.timeout(12000) });
            if (!response.ok) throw new Error('Product search is unavailable. Retry or enter the style number below.');
            const data = await response.json();
            if (seq !== searchSeq || !target.isConnected) return;
            const products = data.data?.products || data.products || [];
            const styleOf = product => product.styleNumber || product.STYLE || '';
            products.sort((a, b) => Number(styleOf(b).toUpperCase() === query.toUpperCase()) - Number(styleOf(a).toUpperCase() === query.toUpperCase()));
            searchMatches = [];
            for (const product of products.slice(0, 5)) {
                const style = product.styleNumber || product.STYLE;
                if (!/^[A-Z0-9._-]{1,40}$/i.test(style || '')) continue;
                searchMatches.push(style);
                $('qqSearchResults').append(button(style + ' · ' + (product.productName || product.PRODUCT_TITLE || style), () => choose(style, target)));
            }
            $('qqSearchStatus').textContent = $('qqSearchResults').children.length ? 'Choose a product to add it.' : 'No matching products. Try a style number or a different name.';
        } catch (error) { if (seq === searchSeq) $('qqSearchStatus').textContent = error.message; }
    }
    function queueSearch(input) {
        searchInput = input; ++searchSeq; clearTimeout(searchTimer); searchMatches = [];
        const panel = $('qqSearchPanel');
        (input.closest('.qq-line-head') || $('qqProductFinder')).after(panel);
        panel.hidden = !input.value.trim(); $('qqSearchResults').replaceChildren(); $('qqSearchStatus').textContent = '';
        searchTimer = setTimeout(search, 250);
    }
    function searchKey(event) {
        const input = event.target.closest('#qqProductSearch, .qq-line-style'); if (!input) return;
        if (event.key === 'Escape') { ++searchSeq; clearTimeout(searchTimer); $('qqSearchPanel').hidden = true; return; }
        if (event.key === 'ArrowDown' && !$('qqSearchPanel').hidden) { event.preventDefault(); $('qqSearchResults').querySelector('button')?.focus(); return; }
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const query = input.value.trim();
        const matches = input === searchInput ? searchMatches : [];
        const exact = matches.find(style => style.toUpperCase() === query.toUpperCase());
        if (exact) choose(exact, input);
        else if (matches.length && !/\d/.test(query)) choose(matches[0], input);
        else if (/^[A-Z0-9._-]{1,40}$/i.test(query)) choose(query.toUpperCase(), input);
        else if (matches.length) choose(matches[0], input);
        else queueSearch(input);
    }
    function saveDraft() {
        const s = bridge.state;
        const products = s.mode === 'linesheet' ? s.lineStyles.filter(r => r.product && r.color).map(r => ({ style: r.product.style, color: r.color.catalog })) : s.product && s.color ? [{ style: s.product.style, color: s.color.catalog }] : [];
        if (!products.length || bridge.pending()) return;
        const draft = { version: 1, savedAt: Date.now(), products, mode: s.mode, lineMethod: s.lineMethod };
        for (const key of ['front', 'back', 'sleeves', 'frontInk', 'backInk', 'sleeveInkL', 'sleeveInkR', 'adv', 'embAddl', 'capEmb', 'qty', 'lineQty', 'sizes', 'useSizes', 'scpDarkUserSet']) draft[key] = s[key];
        // Customer names/notes and all prices deliberately stay out of browser storage.
        if (write(storageKeys.draft, draft)) $('qqDraftStatus').textContent = 'Product & decoration draft saved on this browser. Prices refresh on restore.';
    }
    function validDraft(d) {
        const int = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
        return d?.version === 1 && Date.now() - d.savedAt < 14 * 86400000 && ['quick', 'linesheet'].includes(d.mode)
            && Array.isArray(d.products) && d.products.length > 0 && d.products.length <= 6 && d.products.every(p => /^[A-Z0-9._-]{1,40}$/i.test(p.style || '') && typeof p.color === 'string' && p.color.length <= 100)
            && ['', 'LC', 'CF', 'FF', 'JF'].includes(d.front) && ['', 'CB', 'FB', 'JB'].includes(d.back)
            && ['emb', 'capemb', 'dtg', 'scp', 'dtf'].includes(d.lineMethod) && ['embroidery', '3d-puff', 'laser-patch'].includes(d.capEmb)
            && ['frontInk', 'backInk', 'sleeveInkL', 'sleeveInkR'].every(k => int(d[k], 1, 6)) && int(d.qty, 1, 100000) && (d.lineQty === null || int(d.lineQty, 1, 100000))
            && d.adv && int(d.adv.embStitch, 1000, 1000000) && typeof d.adv.digitizing === 'boolean' && typeof d.adv.scpDark === 'boolean' && typeof d.adv.scpStripes === 'boolean'
            && d.sleeves && typeof d.sleeves.left === 'boolean' && typeof d.sleeves.right === 'boolean'
            && Array.isArray(d.embAddl) && d.embAddl.length <= 20 && d.embAddl.every(a => int(a.stitch, 1000, 1000000))
            && d.sizes && Object.entries(d.sizes).every(([size, q]) => /^[A-Z0-9/ -]{1,12}$/.test(size) && int(q, 0, 100000));
    }
    async function restore() {
        const draft = read(storageKeys.draft); restoring = true; $('qqRestore').disabled = true;
        try {
            if (!validDraft(draft)) throw new Error('This draft is no longer usable. Start a fresh estimate.');
            await bridge.restore(draft); draftAvailable = false; $('qqRestoreDraft').hidden = true;
        } catch (error) { $('qqExportError').hidden = false; $('qqExportError').textContent = 'Draft could not be restored: ' + error.message; }
        finally { restoring = false; $('qqRestore').disabled = false; refresh(); }
    }
    function loadPdfLibrary() {
        if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
        if (!libraryPromise) libraryPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js'; script.crossOrigin = 'anonymous'; script.integrity = 'sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3';
            const timer = setTimeout(() => { script.remove(); reject(new Error('PDF download could not load. Retry or use Print to save a PDF.')); }, 15000);
            script.onload = () => { clearTimeout(timer); if (window.jspdf?.jsPDF) resolve(window.jspdf.jsPDF); else reject(new Error('PDF download is unavailable. Use Print to save a PDF.')); };
            script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('PDF download could not load. Retry or use Print to save a PDF.')); };
            document.head.append(script);
        }).catch(error => { libraryPromise = null; throw error; });
        return libraryPromise;
    }
    async function imageData(url, { width = 360, height = 420 } = {}) {
        const image = new Image(); image.crossOrigin = 'anonymous'; image.referrerPolicy = 'no-referrer';
        const timeout = new Promise((_, reject) => { image._deadline = setTimeout(() => reject(new Error('An estimate image could not load. Retry the download.')), 15000); });
        // Supplier images display cross-origin but cannot be read by a PDF canvas.
        // Use the existing same-origin image relay for external product photos.
        const source = new URL(url, window.location.href);
        image.src = source.origin === window.location.origin ? source.href : '/api/image-proxy?url=' + encodeURIComponent(source.href);
        try {
            await Promise.race([image.decode(), timeout]);
            const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
            const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
            const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
            ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h); return canvas.toDataURL('image/png');
        } finally { clearTimeout(image._deadline); }
    }
    async function exportDocument(download) {
        render(); if (!documentModel?.options.length || bridge.pending()) return;
        const snapshot = JSON.stringify(documentModel); busy = true; $('qqExportError').hidden = true; refresh();
        $('qqLineDownload').textContent = download ? 'Preparing PDF…' : 'Download PDF';
        try {
            if (!$('qqRepEmail').reportValidity()) return;
            if (download) {
                const library = await loadPdfLibrary(); const file = await doc().pdf(JSON.parse(snapshot), library, imageData);
                if (JSON.stringify(documentModel) !== snapshot || bridge.pending()) throw new Error('The estimate changed while preparing the PDF. Download it again for current prices.');
                const name = (documentModel.company || documentModel.customer || documentModel.options[0].style).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60);
                file.save('NWCA-estimate-' + name + '.pdf');
            } else {
                await Promise.all([document.fonts.ready, ...[...$('qqSheet').querySelectorAll('img')].map(image => Promise.race([image.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error('A product photo could not load. Retry printing.')), 15000))]))]);
                if (JSON.stringify(documentModel) !== snapshot || bridge.pending()) throw new Error('The estimate changed. Print again for current prices.');
                window.print();
            }
        } catch (error) { $('qqExportError').hidden = false; $('qqExportError').textContent = error.message || 'The document could not be prepared. Please try again.'; }
        finally { busy = false; $('qqLineDownload').textContent = 'Download PDF'; refresh(); }
    }
    async function copyPrices() {
        render(); if (bridge.pending() || bridge.errors().length || !documentModel?.options.length) return;
        const content = doc().text(documentModel); lastCopy = content;
        try { await navigator.clipboard.writeText(content); if (lastCopy === content) $('qqCopyStatus').textContent = 'Prices copied. Ready to paste into your message.'; }
        catch {
            if (lastCopy !== content) return;
            $('qqCopyStatus').textContent = 'Clipboard access is unavailable. Select and copy the text below.';
            $('qqCopyFallback').hidden = false; $('qqCopyText').value = content; $('qqCopyText').focus(); $('qqCopyText').select();
        }
    }
    function mount(api) {
        bridge = api;
        document.querySelector('.qq-inputs').append(document.querySelector('.qq-customer-details'));
        document.querySelector('.qq-inputs').append($('qqSavedProducts'));
        const quantityField = document.querySelector('.qq-line-quantity'); $('qqLineMethodField').after(quantityField);
        for (const id of ['qqSleeveRow', 'qqScpOptsField']) $('qqExtraControls').append($(id));
        searchInput = $('qqProductSearch');
        document.querySelector('.qq-inputs').addEventListener('input', event => { const input = event.target.closest('#qqProductSearch, .qq-line-style'); if (input) queueSearch(input); });
        document.querySelector('.qq-inputs').addEventListener('keydown', searchKey);
        for (const id of ['qqCustomerName', 'qqCompanyName', 'qqRepName', 'qqRepEmail', 'qqCustomerNotes', 'qqShowBreaks']) $(id).addEventListener('input', refresh);
        $('qqLineDownload').addEventListener('click', () => exportDocument(true)); $('qqLinePrint').addEventListener('click', () => exportDocument(false));
        $('qqCopy').addEventListener('click', copyPrices);
        $('qqSheet').addEventListener('click', event => { const button = event.target.closest('[data-quote-quantity]'); if (button && bridge.state.mode === 'linesheet') { bridge.setQuantity(Number(button.dataset.quoteQuantity)); $('qqLineQty').focus({ preventScroll: true }); } });
        $('qqRestore').addEventListener('click', restore);
        $('qqDiscard').addEventListener('click', () => { try { localStorage.removeItem(storageKeys.draft); } catch { /* visible storage failure appears on the next save */ } draftAvailable = false; $('qqRestoreDraft').hidden = true; });
        draftAvailable = validDraft(read(storageKeys.draft)) && !new URLSearchParams(location.search).has('style');
        $('qqRestoreDraft').hidden = !draftAvailable;
        window.addEventListener('beforeprint', render);
        refresh();
    }
    // Classic page-script boundary; this is not part of a quote-builder module graph.
    // eslint-disable-next-line no-restricted-syntax
    window.QuickQuoteWorkspace = { mount, refresh };
})();
