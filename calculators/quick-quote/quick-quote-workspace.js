/* Staff convenience and customer output. This module never calculates a selling price. */
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const storageKeys = { draft: 'nwca-quick-quote-inputs', products: 'nwca-quick-quote-products' };
    const STYLE_CHARS = /^[A-Z0-9._-]{1,40}$/i;
    // Matches quick-quote.js looksLikeStyle(): a style number has a digit and no spaces.
    const styleLike = value => /^[A-Z0-9._/-]{2,20}$/i.test(value) && /\d/.test(value);
    let bridge, scheduled = false, documentModel, busy = false, restoring = false, draftTimer, searchTimer, searchSeq = 0;
    let recommendation = '', excluded = new Set(), context = '', lastOptions = '', lastMarkup = '', libraryPromise;
    let draftAvailable = false, searchInput = null, searchMatches = [], lastCopy = '', savedHome = '', printing = false;
    const doc = () => window.QuickQuoteDocument;
    function read(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
    function write(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; }
        catch { $('qqDraftStatus').textContent = 'Browser storage is unavailable. Keep this tab open or download your sheet.'; return false; }
    }
    function button(label, action, className = 'btn btn-ghost') {
        const b = document.createElement('button'); b.type = 'button'; b.className = className; b.textContent = label; b.addEventListener('click', action); return b;
    }
    function details() {
        return { mode: bridge.state.mode, method: bridge.method(), subtitle: bridge.subtitle(), customer: $('qqCustomerName').value, company: $('qqCompanyName').value,
            rep: $('qqRepName').value, email: $('qqRepEmail').value, notes: $('qqCustomerNotes').value, showBreaks: $('qqShowBreaks').checked,
            release: window.QuickQuoteReleases ? window.QuickQuoteReleases.current() : '' };
    }
    function refresh() {
        if (!bridge || scheduled) return;
        scheduled = true;
        queueMicrotask(() => { scheduled = false; render(); });
    }
    function renderOptionControls(all, quick) {
        const optionsKey = JSON.stringify([quick, all.map(o => [o.key, o.product.style, o.method, o.builderHref])]);
        if (optionsKey !== lastOptions) {
            const options = $('qqDocumentOptions'); options.replaceChildren(); lastOptions = optionsKey;
            for (const o of all) {
                const row = document.createElement('div'); row.className = 'qq-option-control';
                const label = document.createElement('label'); label.className = 'qq-check'; label.hidden = all.length === 1;
                const check = document.createElement('input'); check.type = 'checkbox'; check.checked = !excluded.has(o.key); check.dataset.option = o.key;
                check.addEventListener('change', () => { if (check.checked) excluded.delete(o.key); else excluded.add(o.key); refresh(); });
                label.append(check, document.createTextNode(quick ? doc().names[o.method] : o.product.style)); row.append(label);
                const recommend = button('Recommend', () => { recommendation = recommendation === o.key ? '' : o.key; refresh(); });
                recommend.dataset.recommend = o.key; recommend.hidden = all.length === 1; row.append(recommend);
                if (o.builderHref) { const link = document.createElement('a'); link.className = 'btn btn-ghost'; link.href = o.builderHref; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Full quote'; link.title = 'Open ' + o.product.style + ' with these decoration settings in the full Quote Builder'; row.append(link); }
                if (row.querySelector('label:not([hidden]), button:not([hidden]), a')) options.append(row);
            }
        }
        document.querySelectorAll('[data-recommend]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.recommend === recommendation)); b.textContent = b.dataset.recommend === recommendation ? 'Recommended' : 'Recommend'; });
    }
    function render() {
        if (printing) return; // the print notice stays until the dialog closes
        const s = bridge.state, quick = s.mode === 'quick';
        const nextContext = s.mode + ':' + (quick ? s.product?.style || '' : s.lineMethod);
        if (nextContext !== context) { context = nextContext; recommendation = ''; excluded = new Set(); lastOptions = ''; lastMarkup = null; }
        const inputs = bridge.options();
        const all = inputs.map(o => ({ ...o, recommended: o.key === recommendation }));
        renderOptionControls(all, quick);
        const pending = bridge.pending(), errors = bridge.errors();
        documentModel = doc().model(all.filter(o => !excluded.has(o.key)), details());
        const hasSheet = documentModel.options.length > 0;
        const ready = hasSheet && !pending && !errors.length;
        $('qqDocumentTitle').textContent = quick ? 'Customer estimate' : 'Line sheet';
        const status = $('qqDocumentStatus');
        status.textContent = errors.length ? 'Before sending: ' + errors.join(' ')
            : pending ? 'Updating prices…'
            : !inputs.length ? (quick ? 'Price a style to send these options as a customer estimate.' : 'Type a style number to see its price breaks.')
            : !hasSheet ? 'Select at least one option to include.'
            : quick ? 'Copy, download or print the priced options above as a customer estimate.' : '';
        status.classList.toggle('is-error', errors.length > 0);
        // While prices update, keep the last sheet on screen (dimmed) instead of emptying it.
        const sheet = $('qqSheet');
        if (!(pending && lastMarkup) || lastMarkup === null) {
            const markup = hasSheet ? doc().html(documentModel) : '';
            // Renderer escapes every external string and validates image URLs.
            // eslint-disable-next-line no-unsanitized/property
            if (markup !== lastMarkup) { sheet.innerHTML = markup; lastMarkup = markup; }
        }
        sheet.hidden = !lastMarkup;
        sheet.classList.toggle('is-updating', pending);
        sheet.setAttribute('aria-busy', String(pending));
        $('qqLineDownload').disabled = busy || !ready; $('qqLinePrint').disabled = busy || !ready; $('qqCopy').disabled = busy || !ready;
        if (!ready || lastCopy && lastCopy !== doc().text(documentModel)) { $('qqCopyFallback').hidden = true; $('qqCopyText').value = ''; $('qqCopyStatus').textContent = ''; lastCopy = ''; }
        const selected = quick ? { product: s.product, color: s.color } : s.lineStyles.find(row => row.product);
        $('qqCatalogLink').href = selected?.product ? '/product.html?style=' + encodeURIComponent(selected.product.style) + '&color=' + encodeURIComponent(selected.color?.catalog || '') : '/catalog';
        placeSavedProducts(quick);
        rememberProducts(inputs);
        if (draftAvailable && inputs.length && !restoring) { draftAvailable = false; $('qqRestoreDraft').hidden = true; }
        if (!restoring && !draftAvailable) { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 700); }
    }
    // Browser print (Ctrl+P) bypasses the disabled Print button: never print prices that are updating.
    function beforePrint() {
        printing = false; render();
        if (!bridge.pending() && !bridge.errors().length) return;
        const sheet = $('qqSheet'), note = document.createElement('p');
        note.textContent = 'Prices are still updating or a style needs attention. Print again once the sheet is ready.';
        sheet.replaceChildren(note); sheet.hidden = false; lastMarkup = null; printing = true;
    }
    function afterPrint() { if (printing) { printing = false; refresh(); } }

    // ---- recent & favorite styles (browser-only; style numbers, never prices) ----
    function placeSavedProducts(quick) {
        const home = quick ? 'quick' : 'line';
        if (home === savedHome) return;
        savedHome = home;
        (quick ? $('qqStyleStatus') : $('qqLineAdd')).after($('qqSavedProducts'));
    }
    function rememberProducts(inputs) {
        const saved = read(storageKeys.products);
        let list = Array.isArray(saved) ? saved.filter(p => p && typeof p.style === 'string' && STYLE_CHARS.test(p.style)).slice(0, 20) : [];
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
        const title = document.createElement('span'); title.className = 'qq-saved-title'; title.textContent = 'Recent'; area.append(title);
        for (const p of [...list].sort((a, b) => Number(b.favorite) - Number(a.favorite)).slice(0, 6)) {
            const row = document.createElement('span'); row.className = 'qq-saved-product';
            const pick = button(p.style, () => choose(p.style, null), 'btn btn-ghost qq-saved-pick');
            pick.title = p.name ? 'Add ' + p.style + ' · ' + p.name : 'Add ' + p.style;
            const star = button(p.favorite ? '★' : '☆', () => { p.favorite = !p.favorite; write(storageKeys.products, list); savedKey = ''; renderSavedProducts(list); }, 'btn btn-ghost qq-saved-star');
            star.setAttribute('aria-label', (p.favorite ? 'Remove favorite ' : 'Favorite ') + p.style); star.setAttribute('aria-pressed', String(!!p.favorite));
            row.append(pick, star); area.append(row);
        }
    }

    // ---- product-name search (style numbers are looked up directly by quick-quote.js) ----
    function hideSearch() {
        ++searchSeq; clearTimeout(searchTimer); searchMatches = [];
        $('qqSearchPanel').hidden = true; $('qqSearchResults').replaceChildren(); $('qqSearchStatus').textContent = '';
    }
    function choose(style, target = searchInput) {
        hideSearch(); $('qqExportError').hidden = true;
        try {
            const uid = target && target.isConnected && target.classList.contains('qq-line-style') ? Number(target.dataset.uid) : undefined;
            bridge.choose(style, uid);
        } catch (error) { $('qqExportError').hidden = false; $('qqExportError').textContent = error.message; }
    }
    async function search(afterMiss) {
        const target = searchInput, query = target ? target.value.trim() : '', seq = ++searchSeq;
        $('qqSearchResults').replaceChildren();
        if (query.length < 2 || !target.isConnected) { hideSearch(); return; }
        $('qqSearchStatus').textContent = 'Searching products…';
        try {
            let response;
            try { response = await fetch(window.APP_CONFIG.API.BASE_URL + '/api/products/search?q=' + encodeURIComponent(query) + '&limit=8', { signal: AbortSignal.timeout(12000) }); }
            catch { throw new Error('Product search is unavailable. Type the style number instead.'); }
            if (!response.ok) throw new Error('Product search is unavailable. Type the style number instead.');
            const data = await response.json();
            if (seq !== searchSeq || !target.isConnected) return;
            const products = data.data?.products || data.products || [];
            const styleOf = product => product.styleNumber || product.STYLE || '';
            products.sort((a, b) => Number(styleOf(b).toUpperCase() === query.toUpperCase()) - Number(styleOf(a).toUpperCase() === query.toUpperCase()));
            searchMatches = [];
            for (const product of products.slice(0, 5)) {
                const style = styleOf(product);
                if (!STYLE_CHARS.test(style)) continue;
                searchMatches.push(style);
                $('qqSearchResults').append(button(style + ' · ' + (product.productName || product.PRODUCT_TITLE || style), () => choose(style, target)));
            }
            const found = searchMatches.length > 0;
            $('qqSearchStatus').textContent = found ? (afterMiss ? 'Did you mean:' : 'Choose a product:')
                : afterMiss ? 'No similar products found. Check the style number.' : 'No matching products. Try a style number or another name.';
        } catch (error) { if (seq === searchSeq) $('qqSearchStatus').textContent = error.message; }
    }
    function queueSearch(input, afterMiss = false) {
        searchInput = input; ++searchSeq; clearTimeout(searchTimer); searchMatches = [];
        const panel = $('qqSearchPanel');
        (input.closest('.qq-line-head') || input.closest('.field') || input).after(panel);
        panel.hidden = false; $('qqSearchResults').replaceChildren(); $('qqSearchStatus').textContent = '';
        searchTimer = setTimeout(() => search(afterMiss), afterMiss ? 0 : 250);
    }
    // quick-quote.js calls this when a typed style number is not in the catalog.
    function suggest(input) { if (input && input.isConnected && input.value.trim().length >= 2) queueSearch(input, true); }
    // quick-quote.js re-renders style rows; keep an open name search under the same row.
    function reattach(input) {
        if (!input) return;
        const panel = $('qqSearchPanel');
        searchInput = input;
        input.closest('.qq-line-head').after(panel);
        panel.hidden = !($('qqSearchResults').children.length || $('qqSearchStatus').textContent);
    }
    function onInput(event) {
        const input = event.target.closest('#qqStyle, .qq-line-style'); if (!input) return;
        const value = input.value.trim();
        if (value.length >= 2 && !styleLike(value)) queueSearch(input);
        else if (input === searchInput) hideSearch();
    }
    function searchKey(event) {
        const input = event.target.closest('#qqStyle, .qq-line-style'); if (!input) return;
        const open = !$('qqSearchPanel').hidden && searchInput === input;
        if (event.key === 'Escape' && open) { hideSearch(); return; }
        if (event.key === 'ArrowDown' && open) { const first = $('qqSearchResults').querySelector('button'); if (first) { event.preventDefault(); first.focus(); } return; }
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const query = input.value.trim(); if (!query) return;
        const matches = open ? searchMatches : [];
        const exact = matches.find(style => style.toUpperCase() === query.toUpperCase());
        if (exact) choose(exact, input);
        else if (styleLike(query)) { hideSearch(); bridge.commit(input); }
        else if (matches.length) choose(matches[0], input);
        else if (STYLE_CHARS.test(query)) { hideSearch(); bridge.commit(input); }
        else queueSearch(input);
    }
    function resultsKey(event) {
        const buttons = [...$('qqSearchResults').querySelectorAll('button')], i = buttons.indexOf(document.activeElement);
        if (event.key === 'ArrowDown' && i < buttons.length - 1) { event.preventDefault(); buttons[i + 1].focus(); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); (i > 0 ? buttons[i - 1] : searchInput)?.focus(); }
        else if (event.key === 'Escape') { searchInput?.focus(); hideSearch(); }
    }

    // ---- input-only draft (no customer details, no prices) ----
    function saveDraft() {
        const s = bridge.state;
        const products = s.mode === 'linesheet' ? s.lineStyles.filter(r => r.product && r.color).map(r => ({ style: r.product.style, color: r.color.catalog })) : s.product && s.color ? [{ style: s.product.style, color: s.color.catalog }] : [];
        if (!products.length || bridge.pending()) return;
        if (s.mode === 'quick' && s.lineStyles.some(r => r.product)) return; // keep the line sheet as the saved draft
        const draft = { version: 1, savedAt: Date.now(), products, mode: s.mode, lineMethod: s.lineMethod };
        for (const key of ['front', 'back', 'sleeves', 'frontInk', 'backInk', 'sleeveInkL', 'sleeveInkR', 'adv', 'embAddl', 'capEmb', 'qty', 'lineQty', 'sizes', 'useSizes', 'scpDarkUserSet']) draft[key] = s[key];
        // Customer names/notes and all prices deliberately stay out of browser storage.
        if (write(storageKeys.draft, draft)) $('qqDraftStatus').textContent = 'Styles and decoration saved on this browser. Prices refresh when you come back.';
    }
    function validDraft(d) {
        const int = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
        return d?.version === 1 && Date.now() - d.savedAt < 14 * 86400000 && ['quick', 'linesheet'].includes(d.mode)
            && Array.isArray(d.products) && d.products.length > 0 && d.products.length <= 6 && d.products.every(p => STYLE_CHARS.test(p.style || '') && typeof p.color === 'string' && p.color.length <= 100)
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
            if (!validDraft(draft)) throw new Error('This saved quote is no longer usable. Start a fresh one.');
            $('qqExportError').hidden = true;
            await bridge.restore(draft); draftAvailable = false; $('qqRestoreDraft').hidden = true;
        } catch (error) { $('qqExportError').hidden = false; $('qqExportError').textContent = 'Saved quote could not be restored: ' + error.message; }
        finally { restoring = false; $('qqRestore').disabled = false; refresh(); }
    }

    // ---- copy, print and PDF (exports only when every row is priced) ----
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
        const timeout = new Promise((_, reject) => { image._deadline = setTimeout(() => reject(new Error('An image could not load.')), 15000); });
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
    function exportReady() {
        render();
        return !!documentModel?.options.length && !bridge.pending() && !bridge.errors().length;
    }
    function fileName() {
        const m = documentModel, label = m.company || m.customer || m.options.map(o => o.style).join('-');
        return (m.quick ? 'NWCA-estimate-' : 'NWCA-line-sheet-') + label.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) + '.pdf';
    }
    async function exportDocument(download) {
        if (!exportReady()) return;
        const email = $('qqRepEmail');
        if (!email.checkValidity()) { email.closest('details').open = true; email.reportValidity(); return; }
        const snapshot = JSON.stringify(documentModel); busy = true; $('qqExportError').hidden = true; refresh();
        $('qqLineDownload').textContent = download ? 'Preparing PDF…' : 'Download PDF';
        let missing = 0;
        try {
            if (download) {
                const library = await loadPdfLibrary();
                // A missing photo leaves a gap and a note; it never blocks the prices.
                const photo = async (url, size) => { try { return await imageData(url, size); } catch { missing += 1; return null; } };
                const file = await doc().pdf(JSON.parse(snapshot), library, photo);
                if (JSON.stringify(documentModel) !== snapshot || bridge.pending()) throw new Error('The sheet changed while preparing the PDF. Download it again for current prices.');
                file.save(fileName());
            } else {
                const photos = [...$('qqSheet').querySelectorAll('img:not([hidden])')].map(image => image.decode().catch(() => { image.hidden = true; missing += 1; }));
                await Promise.all([document.fonts.ready, Promise.race([Promise.all(photos), new Promise(resolve => setTimeout(resolve, 15000))])]);
                if (JSON.stringify(documentModel) !== snapshot || bridge.pending()) throw new Error('The sheet changed. Print again for current prices.');
                window.print();
            }
            if (missing) { $('qqExportError').hidden = false; $('qqExportError').textContent = missing + (missing === 1 ? ' image' : ' images') + ' could not be loaded and ' + (missing === 1 ? 'was' : 'were') + ' left out. Prices are complete.'; }
        } catch (error) { $('qqExportError').hidden = false; $('qqExportError').textContent = error.message || 'The sheet could not be prepared. Please try again.'; }
        finally { busy = false; $('qqLineDownload').textContent = 'Download PDF'; refresh(); }
    }
    async function copyPrices() {
        if (!exportReady()) return;
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
        const inputs = document.querySelector('.qq-inputs');
        inputs.addEventListener('input', onInput);
        inputs.addEventListener('keydown', searchKey);
        $('qqSearchResults').addEventListener('keydown', resultsKey);
        for (const id of ['qqCustomerName', 'qqCompanyName', 'qqRepName', 'qqRepEmail', 'qqCustomerNotes', 'qqShowBreaks']) $(id).addEventListener('input', refresh);
        $('qqLineDownload').addEventListener('click', () => exportDocument(true)); $('qqLinePrint').addEventListener('click', () => exportDocument(false));
        $('qqCopy').addEventListener('click', copyPrices);
        $('qqSheet').addEventListener('error', event => { if (event.target.matches?.('img')) event.target.hidden = true; }, true);
        $('qqRestore').addEventListener('click', restore);
        $('qqDiscard').addEventListener('click', () => { try { localStorage.removeItem(storageKeys.draft); } catch { /* visible storage failure appears on the next save */ } draftAvailable = false; $('qqRestoreDraft').hidden = true; });
        draftAvailable = validDraft(read(storageKeys.draft)) && !new URLSearchParams(location.search).has('style');
        $('qqRestoreDraft').hidden = !draftAvailable;
        window.addEventListener('beforeprint', beforePrint);
        window.addEventListener('afterprint', afterPrint);
        // Some print paths never send afterprint; the next interaction restores the sheet.
        for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, afterPrint, true);
        refresh();
    }
    // Classic page-script boundary; this is not part of a quote-builder module graph.
    // eslint-disable-next-line no-restricted-syntax
    window.QuickQuoteWorkspace = { mount, refresh, suggest, reattach };
})();
