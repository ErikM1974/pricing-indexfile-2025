/**
 * TipTap rich-text editor wrapper for Policies Hub.
 *
 * Loads TipTap from esm.sh with a pinned version. No build step required.
 *
 * Capabilities:
 *   - Headings, lists, blockquote, code blocks
 *   - Bold/italic/strike/inline code
 *   - Image insert via:
 *     • Toolbar button (file picker) → POST /api/files/upload → CDN URL
 *     • Drag-drop of files anywhere in the editor
 *     • Paste (Cmd+V) of clipboard images
 *     • Paste of remote image URLs (kept as-is)
 *   - Video embed (YouTube, Loom, Vimeo) via toolbar button → iframe
 *   - Tables, links, horizontal rules, undo/redo
 *
 * Usage:
 *   const editor = await PolicyEditor.mount(domElement, { initialHtml });
 *   const html = editor.getHTML();
 *   editor.destroy();
 */
(function () {
    'use strict';

    const TT_VERSION = '2.10.4';
    const UPLOAD_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files/upload';
    const FILE_BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/files';

    let cachedModules = null;

    async function loadTipTap() {
        if (cachedModules) return cachedModules;
        const [core, starterKit, image, link, table, tableRow, tableCell, tableHeader, placeholder, typography, node, mergeAttrs] = await Promise.all([
            import(`https://esm.sh/@tiptap/core@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/starter-kit@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-image@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-link@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-table@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-table-row@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-table-cell@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-table-header@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-placeholder@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-typography@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/core@${TT_VERSION}/dist/index.js`).then(m => ({ Node: m.Node, mergeAttributes: m.mergeAttributes })),
            Promise.resolve(null) // placeholder for symmetry
        ]);

        cachedModules = {
            Editor: core.Editor,
            Node: core.Node,
            mergeAttributes: core.mergeAttributes,
            StarterKit: starterKit.default || starterKit.StarterKit,
            Image: image.default || image.Image,
            Link: link.default || link.Link,
            Table: table.default || table.Table,
            TableRow: tableRow.default || tableRow.TableRow,
            TableCell: tableCell.default || tableCell.TableCell,
            TableHeader: tableHeader.default || tableHeader.TableHeader,
            Placeholder: placeholder.default || placeholder.Placeholder,
            Typography: typography.default || typography.Typography
        };
        return cachedModules;
    }

    // -------------------- Video URL detection --------------------
    // Convert a paste-friendly URL (youtube.com/watch?v=..., youtu.be/..., loom.com/share/..., vimeo.com/...)
    // into an embed URL suitable for an <iframe src>.
    function detectVideoEmbed(url) {
        if (!url) return null;
        url = url.trim();

        // YouTube — youtube.com/watch?v=ID or youtu.be/ID or youtube.com/shorts/ID
        let m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
        if (m) return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/${m[1]}`, aspect: '16/9' };

        // Loom — loom.com/share/ID or loom.com/embed/ID
        m = url.match(/loom\.com\/(?:share|embed)\/([A-Fa-f0-9]+)/);
        if (m) return { kind: 'loom', embedUrl: `https://www.loom.com/embed/${m[1]}`, aspect: '16/9' };

        // Vimeo — vimeo.com/123456789 or player.vimeo.com/video/123456789
        m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        if (m) return { kind: 'vimeo', embedUrl: `https://player.vimeo.com/video/${m[1]}`, aspect: '16/9' };

        return null;
    }

    // -------------------- Custom Callout node --------------------
    // Renders as a styled box with a leading icon and label. Stored in HTML as:
    //   <div data-callout data-kind="tip">…content…</div>
    // Four kinds: tip / warning / important / info. The kind drives the icon,
    // color, and prefix label via CSS.
    const CALLOUT_KINDS = [
        { key: 'tip', label: 'Tip', icon: 'fa-lightbulb' },
        { key: 'warning', label: 'Warning', icon: 'fa-triangle-exclamation' },
        { key: 'important', label: 'Important', icon: 'fa-bullhorn' },
        { key: 'info', label: 'Note', icon: 'fa-circle-info' }
    ];

    function createCalloutNode(mods) {
        return mods.Node.create({
            name: 'callout',
            group: 'block',
            content: 'block+',
            defining: true,

            addAttributes() {
                return {
                    kind: {
                        default: 'tip',
                        parseHTML: el => el.getAttribute('data-kind') || 'tip',
                        renderHTML: attrs => ({ 'data-kind': attrs.kind })
                    }
                };
            },

            parseHTML() {
                return [{ tag: 'div[data-callout]' }];
            },

            renderHTML({ node, HTMLAttributes }) {
                const kind = node.attrs.kind || 'tip';
                return [
                    'div',
                    mods.mergeAttributes(HTMLAttributes, {
                        'data-callout': '',
                        'data-kind': kind,
                        class: `callout callout-${kind}`
                    }),
                    0  // content goes here
                ];
            },

            addCommands() {
                return {
                    setCallout: (kind = 'tip') => ({ commands }) =>
                        commands.wrapIn(this.name, { kind }),
                    toggleCallout: (kind = 'tip') => ({ commands }) =>
                        commands.toggleWrap(this.name, { kind }),
                    unsetCallout: () => ({ commands }) =>
                        commands.lift(this.name)
                };
            }
        });
    }

    // -------------------- Custom Mermaid Diagram node --------------------
    // Stored in HTML as <pre class="mermaid">source code</pre> — exactly the
    // shape Mermaid expects for client-side rendering. In edit mode, TipTap
    // shows the raw source in a styled <pre>; on the read view, the
    // PolicyMermaid module replaces it with the rendered SVG.
    function createMermaidNode(mods) {
        return mods.Node.create({
            name: 'mermaidDiagram',
            group: 'block',
            content: '',
            atom: true,
            draggable: true,
            selectable: true,

            addAttributes() {
                return {
                    source: {
                        default: '',
                        parseHTML: el => el.textContent || '',
                        renderHTML: () => ({})  // we render source as the child text, not an attribute
                    }
                };
            },

            parseHTML() {
                return [{
                    tag: 'pre.mermaid',
                    getAttrs: el => ({ source: el.textContent || '' })
                }];
            },

            renderHTML({ node }) {
                return [
                    'pre',
                    mods.mergeAttributes({ class: 'mermaid' }),
                    node.attrs.source || ''
                ];
            },

            addNodeView() {
                return ({ node, getPos, editor }) => {
                    const wrap = document.createElement('div');
                    wrap.className = 'tt-mermaid-block';
                    wrap.innerHTML = `
                        <div class="tt-mermaid-label"><i class="fas fa-diagram-project"></i> Mermaid diagram</div>
                        <pre class="tt-mermaid-source">${node.attrs.source.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</pre>
                        <button type="button" class="tt-mermaid-edit-btn">Edit diagram</button>
                    `;
                    wrap.querySelector('.tt-mermaid-edit-btn').addEventListener('click', () => {
                        if (window.PolicyMermaid && typeof window.PolicyMermaid.openInsertModal === 'function') {
                            // Pop the modal with current source as the starting point.
                            // For now we just delete + re-insert via the modal — author can copy/paste old source.
                            // Phase 2: pass starting source to modal.
                            window.PolicyMermaid.openInsertModal(editor);
                        }
                    });
                    return { dom: wrap, contentDOM: null };
                };
            }
        });
    }

    // -------------------- Custom VideoEmbed node --------------------
    // Renders as a responsive container with an iframe inside. Stored in HTML as:
    //   <div data-video-embed data-src="EMBED_URL" data-kind="youtube"></div>
    // ...with the iframe injected on render. Roundtrips cleanly because we
    // own both the toDOM and parseDOM contract.
    function createVideoEmbedNode(mods) {
        return mods.Node.create({
            name: 'videoEmbed',
            group: 'block',
            atom: true,
            draggable: true,

            addAttributes() {
                return {
                    src: { default: null },
                    kind: { default: null }
                };
            },

            parseHTML() {
                return [
                    {
                        tag: 'div[data-video-embed]',
                        getAttrs: el => ({
                            src: el.getAttribute('data-src'),
                            kind: el.getAttribute('data-kind')
                        })
                    }
                ];
            },

            renderHTML({ HTMLAttributes }) {
                const src = HTMLAttributes.src || '';
                const kind = HTMLAttributes.kind || 'embed';
                return [
                    'div',
                    mods.mergeAttributes({
                        'data-video-embed': '',
                        'data-src': src,
                        'data-kind': kind,
                        class: `video-embed video-${kind}`
                    }),
                    [
                        'iframe',
                        {
                            src,
                            frameborder: '0',
                            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
                            allowfullscreen: 'true',
                            loading: 'lazy'
                        }
                    ]
                ];
            },

            addCommands() {
                return {
                    setVideoEmbed: ({ src, kind }) => ({ commands }) =>
                        commands.insertContent({
                            type: this.name,
                            attrs: { src, kind }
                        })
                };
            }
        });
    }

    // -------------------- File upload helper --------------------
    async function uploadImageFile(file) {
        if (!file) throw new Error('No file');
        if (!file.type.startsWith('image/')) {
            throw new Error(`Not an image (got ${file.type})`);
        }
        if (file.size > 20 * 1024 * 1024) {
            throw new Error('Image is over 20 MB — please compress and try again');
        }

        const fd = new FormData();
        fd.append('file', file, file.name || `paste-${Date.now()}.png`);
        const res = await fetch(UPLOAD_URL, { method: 'POST', body: fd });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Upload failed (${res.status}): ${body.slice(0, 200)}`);
        }
        const data = await res.json();
        if (!data.success || !data.externalKey) {
            throw new Error('Upload response missing externalKey');
        }
        return `${FILE_BASE_URL}/${data.externalKey}`;
    }

    function showUploadingPlaceholder(editor) {
        const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        editor.chain().focus().insertContent({
            type: 'paragraph',
            content: [{ type: 'text', text: `⏳ Uploading image…`, marks: [{ type: 'italic' }] }]
        }).run();
        return id;
    }

    async function uploadAndInsert(editor, file) {
        showUploadingPlaceholder(editor);
        try {
            const url = await uploadImageFile(file);
            // Remove the placeholder paragraph (it's the most recently inserted text node)
            // and insert the real image
            editor.chain().focus().undo().setImage({ src: url, alt: file.name }).run();
        } catch (e) {
            console.error('[policy-editor] image upload failed:', e);
            editor.chain().focus().undo().run();
            alert(`Image upload failed: ${e.message}`);
        }
    }

    // -------------------- Toolbar --------------------
    function buildToolbarHtml() {
        return `
            <div class="tt-toolbar" role="toolbar" aria-label="Formatting">
                <button type="button" data-cmd="bold" title="Bold (Ctrl+B)"><i class="fas fa-bold"></i></button>
                <button type="button" data-cmd="italic" title="Italic (Ctrl+I)"><i class="fas fa-italic"></i></button>
                <button type="button" data-cmd="strike" title="Strikethrough"><i class="fas fa-strikethrough"></i></button>
                <button type="button" data-cmd="code" title="Inline code"><i class="fas fa-code"></i></button>
                <span class="tt-sep"></span>
                <button type="button" data-cmd="h1" title="Heading 1">H1</button>
                <button type="button" data-cmd="h2" title="Heading 2">H2</button>
                <button type="button" data-cmd="h3" title="Heading 3">H3</button>
                <span class="tt-sep"></span>
                <button type="button" data-cmd="bulletList" title="Bullet list"><i class="fas fa-list-ul"></i></button>
                <button type="button" data-cmd="orderedList" title="Numbered list"><i class="fas fa-list-ol"></i></button>
                <button type="button" data-cmd="blockquote" title="Quote"><i class="fas fa-quote-right"></i></button>
                <button type="button" data-cmd="codeBlock" title="Code block"><i class="fas fa-file-code"></i></button>
                <span class="tt-sep"></span>
                <button type="button" data-cmd="link" title="Add link"><i class="fas fa-link"></i></button>
                <button type="button" data-cmd="imageUpload" title="Upload image"><i class="fas fa-image"></i></button>
                <button type="button" data-cmd="videoEmbed" title="Embed YouTube / Loom / Vimeo video"><i class="fas fa-video"></i></button>
                <button type="button" data-cmd="mermaidDiagram" title="Insert a flowchart / diagram (Mermaid)"><i class="fas fa-diagram-project"></i></button>
                <span class="tt-dropdown" data-dropdown="callout">
                    <button type="button" class="tt-dropdown-trigger" title="Insert callout box (Tip / Warning / Important / Note)">
                        <i class="fas fa-comment-dots"></i> <i class="fas fa-caret-down tt-dropdown-caret"></i>
                    </button>
                    <div class="tt-dropdown-menu" role="menu">
                        <button type="button" data-cmd="callout-tip"><i class="fas fa-lightbulb"></i> Tip</button>
                        <button type="button" data-cmd="callout-warning"><i class="fas fa-triangle-exclamation"></i> Warning</button>
                        <button type="button" data-cmd="callout-important"><i class="fas fa-bullhorn"></i> Important</button>
                        <button type="button" data-cmd="callout-info"><i class="fas fa-circle-info"></i> Note</button>
                    </div>
                </span>
                <button type="button" data-cmd="table" title="Insert table"><i class="fas fa-table"></i></button>
                <span class="tt-sep"></span>
                <button type="button" data-cmd="hr" title="Horizontal rule"><i class="fas fa-minus"></i></button>
                <button type="button" data-cmd="undo" title="Undo (Ctrl+Z)"><i class="fas fa-undo"></i></button>
                <button type="button" data-cmd="redo" title="Redo (Ctrl+Shift+Z)"><i class="fas fa-redo"></i></button>
                <span class="tt-sep"></span>
                <button type="button" data-cmd="source" class="tt-source-btn" title="View / edit raw HTML source — needed when pasting NWCA-styled docs (.nwca-doc) so custom classes survive">
                    <i class="fas fa-code"></i> <span class="tt-source-label">Source</span>
                </button>
                <span class="tt-sep"></span>
                <button type="button" data-cmd="aiAssist" class="tt-ai-btn" title="AI Assist — let Claude help you write or polish">
                    <i class="fas fa-sparkles"></i> <span class="tt-ai-label">AI</span>
                </button>
                <input type="file" accept="image/*" class="tt-file-input" hidden>
            </div>
        `;
    }

    function wireToolbar(toolbarEl, editor) {
        const fileInput = toolbarEl.querySelector('.tt-file-input');

        // Hidden file input — used by the Image button
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            e.target.value = ''; // reset so re-selecting same file fires change
            if (file) await uploadAndInsert(editor, file);
        });

        toolbarEl.querySelectorAll('button[data-cmd]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const cmd = btn.dataset.cmd;
                const chain = editor.chain().focus();
                switch (cmd) {
                    case 'bold': chain.toggleBold().run(); break;
                    case 'italic': chain.toggleItalic().run(); break;
                    case 'strike': chain.toggleStrike().run(); break;
                    case 'code': chain.toggleCode().run(); break;
                    case 'h1': chain.toggleHeading({ level: 1 }).run(); break;
                    case 'h2': chain.toggleHeading({ level: 2 }).run(); break;
                    case 'h3': chain.toggleHeading({ level: 3 }).run(); break;
                    case 'bulletList': chain.toggleBulletList().run(); break;
                    case 'orderedList': chain.toggleOrderedList().run(); break;
                    case 'blockquote': chain.toggleBlockquote().run(); break;
                    case 'codeBlock': chain.toggleCodeBlock().run(); break;
                    case 'hr': chain.setHorizontalRule().run(); break;
                    case 'undo': chain.undo().run(); break;
                    case 'redo': chain.redo().run(); break;
                    case 'link': {
                        const prev = editor.getAttributes('link').href || '';
                        const url = window.prompt('URL:', prev);
                        if (url === null) return;
                        if (url === '') {
                            chain.extendMarkRange('link').unsetLink().run();
                        } else {
                            chain.extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
                        }
                        break;
                    }
                    case 'imageUpload': {
                        fileInput.click();
                        break;
                    }
                    case 'videoEmbed': {
                        const url = window.prompt('Paste a YouTube, Loom, or Vimeo URL:');
                        if (!url) return;
                        const detected = detectVideoEmbed(url);
                        if (!detected) {
                            alert("Sorry — that doesn't look like a YouTube, Loom, or Vimeo URL.");
                            return;
                        }
                        editor.chain().focus().setVideoEmbed({ src: detected.embedUrl, kind: detected.kind }).run();
                        break;
                    }
                    case 'table': {
                        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                        break;
                    }
                    case 'source': {
                        toggleSourceMode(editor);
                        break;
                    }
                    case 'aiAssist': {
                        if (!window.PolicyAIAssist) {
                            alert('AI Assist not loaded yet. Refresh the page and try again.');
                            break;
                        }
                        // The detail page exposes the policy meta on window.POLICIES_CURRENT
                        const ctx = window.POLICIES_CURRENT || {};
                        window.PolicyAIAssist.open(editor, { title: ctx.Title, category: ctx.Category });
                        break;
                    }
                    case 'callout-tip':
                    case 'callout-warning':
                    case 'callout-important':
                    case 'callout-info': {
                        const kind = cmd.split('-')[1];
                        chain.toggleCallout(kind).run();
                        break;
                    }
                    case 'mermaidDiagram': {
                        if (!window.PolicyMermaid || typeof window.PolicyMermaid.openInsertModal !== 'function') {
                            alert('Mermaid not loaded yet. Refresh and try again.');
                            break;
                        }
                        window.PolicyMermaid.openInsertModal(editor);
                        break;
                    }
                }
                updateToolbarState(toolbarEl, editor);
            });
        });

        editor.on('selectionUpdate', () => updateToolbarState(toolbarEl, editor));
        editor.on('transaction', () => updateToolbarState(toolbarEl, editor));
    }

    function updateToolbarState(toolbarEl, editor) {
        const set = (cmd, active) => {
            const btn = toolbarEl.querySelector(`button[data-cmd="${cmd}"]`);
            if (btn) btn.classList.toggle('is-active', !!active);
        };
        set('bold', editor.isActive('bold'));
        set('italic', editor.isActive('italic'));
        set('strike', editor.isActive('strike'));
        set('code', editor.isActive('code'));
        set('h1', editor.isActive('heading', { level: 1 }));
        set('h2', editor.isActive('heading', { level: 2 }));
        set('h3', editor.isActive('heading', { level: 3 }));
        set('bulletList', editor.isActive('bulletList'));
        set('orderedList', editor.isActive('orderedList'));
        set('blockquote', editor.isActive('blockquote'));
        set('codeBlock', editor.isActive('codeBlock'));
        set('link', editor.isActive('link'));
    }

    // -------------------- Drag-drop + paste handlers --------------------
    function wireFileDropAndPaste(editorEl, editor) {
        // Drag-drop
        editorEl.addEventListener('dragover', (e) => {
            if (e.dataTransfer?.types?.includes('Files')) {
                e.preventDefault();
                editorEl.classList.add('tt-drop-active');
            }
        });
        editorEl.addEventListener('dragleave', () => {
            editorEl.classList.remove('tt-drop-active');
        });
        editorEl.addEventListener('drop', async (e) => {
            editorEl.classList.remove('tt-drop-active');
            const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
            if (files.length === 0) return;
            e.preventDefault();
            for (const file of files) {
                await uploadAndInsert(editor, file);
            }
        });

        // Paste (clipboard images — e.g., screenshots)
        editorEl.addEventListener('paste', async (e) => {
            const items = Array.from(e.clipboardData?.items || []);
            const imageItems = items.filter(it => it.kind === 'file' && it.type.startsWith('image/'));
            if (imageItems.length === 0) return; // let normal paste handle text/HTML
            e.preventDefault();
            for (const item of imageItems) {
                const file = item.getAsFile();
                if (file) await uploadAndInsert(editor, file);
            }
        });
    }

    // -------------------- Dropdown helper --------------------
    function wireDropdowns(toolbarEl) {
        const triggers = toolbarEl.querySelectorAll('.tt-dropdown-trigger');
        triggers.forEach(trigger => {
            const wrap = trigger.closest('.tt-dropdown');
            const menu = wrap.querySelector('.tt-dropdown-menu');
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const wasOpen = wrap.classList.contains('open');
                // Close all dropdowns first
                toolbarEl.querySelectorAll('.tt-dropdown.open').forEach(d => d.classList.remove('open'));
                if (!wasOpen) wrap.classList.add('open');
            });
            // Close menu when a child button is clicked
            menu.addEventListener('click', () => {
                wrap.classList.remove('open');
            });
        });
        // Click outside closes
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.tt-dropdown')) {
                toolbarEl.querySelectorAll('.tt-dropdown.open').forEach(d => d.classList.remove('open'));
            }
        });
    }

    // -------------------- Source-mode (raw HTML) helpers --------------------
    // The TipTap WYSIWYG schema strips unknown classes / semantic tags on parse.
    // For policies that need rich custom HTML (e.g. .nwca-doc spec sheets with
    // .masthead, .hotline, .quick-ref, etc.), an admin can flip to source mode:
    // a textarea takes over, edits/saves bypass TipTap entirely. The marker
    // <!-- nwca-rich --> is auto-stamped on first source-mode save and triggers
    // auto-source-mode on subsequent opens so classes survive round-trips.
    const NWCA_RICH_MARKER = '<!-- nwca-rich -->';

    function isRichDoc(html) {
        if (!html) return false;
        return html.indexOf(NWCA_RICH_MARKER) !== -1 || /class\s*=\s*["'][^"']*\bnwca-doc\b/.test(html);
    }

    function stampRichMarker(html) {
        if (!html) return html;
        if (html.indexOf(NWCA_RICH_MARKER) !== -1) return html;
        // Stamp at the very top so it survives even if the body is wrapped later
        return NWCA_RICH_MARKER + '\n' + html;
    }

    function enterSourceMode(editor) {
        if (editor._policyMode === 'source') return;
        const host = editor._sourceHost;
        const ta = editor._sourceTextarea;
        const editorEl = editor._editorEl;
        if (!host || !ta || !editorEl) return;

        // Pull content into the textarea. Special-case the FIRST entry after
        // mount: if the original initialHtml was a rich doc, use it verbatim
        // (TipTap will have stripped the marker comment and .nwca-doc classes
        // during its initial parse — we want the un-stripped original).
        let html;
        if (!editor._sourceModeEnteredOnce && editor._originalInitialHtml && isRichDoc(editor._originalInitialHtml)) {
            html = editor._originalInitialHtml;
        } else {
            html = editor._originalGetHTML();
        }
        if (isRichDoc(html)) html = stampRichMarker(html);
        ta.value = html;
        editor._sourceModeEnteredOnce = true;

        // Show source, hide WYSIWYG
        editorEl.style.display = 'none';
        host.style.display = '';
        editor._policyMode = 'source';

        // Toggle button state
        markSourceButtonActive(editor._toolbarEl, true);
        // Disable formatting buttons that don't apply in source mode
        setFormattingDisabled(editor._toolbarEl, true);

        // Focus textarea
        try { ta.focus(); } catch (e) { /* ignore */ }
    }

    function exitSourceMode(editor, opts = {}) {
        if (editor._policyMode !== 'source') return;
        const host = editor._sourceHost;
        const ta = editor._sourceTextarea;
        const editorEl = editor._editorEl;
        if (!host || !ta || !editorEl) return;

        const html = ta.value;
        // Warn if the doc looks rich (has .nwca-doc / masthead / hotline / etc.) —
        // TipTap will strip those classes when it parses, and the user will lose work.
        if (!opts.skipWarn && isRichDoc(html)) {
            const ok = window.confirm(
                "Switching back to WYSIWYG will normalize this doc through TipTap's schema and " +
                "strip custom classes like .nwca-doc / .masthead / .hotline. Your styled layout " +
                "will be lost on the next save.\n\nKeep editing in Source mode (recommended)?\n\n" +
                "OK = stay in Source · Cancel = switch to WYSIWYG anyway"
            );
            if (ok) return;  // stay in source
        }

        // Push textarea content back into the editor (will normalize through schema)
        editor.commands.setContent(html || '<p></p>', /* emitUpdate */ true);

        host.style.display = 'none';
        editorEl.style.display = '';
        editor._policyMode = 'wysiwyg';

        markSourceButtonActive(editor._toolbarEl, false);
        setFormattingDisabled(editor._toolbarEl, false);
    }

    function toggleSourceMode(editor) {
        if (editor._policyMode === 'source') {
            exitSourceMode(editor);
        } else {
            enterSourceMode(editor);
        }
    }

    function markSourceButtonActive(toolbarEl, active) {
        if (!toolbarEl) return;
        const btn = toolbarEl.querySelector('button[data-cmd="source"]');
        if (btn) btn.classList.toggle('is-active', !!active);
    }

    function setFormattingDisabled(toolbarEl, disabled) {
        if (!toolbarEl) return;
        // Disable everything except the source button + AI button (AI can still run on raw HTML)
        toolbarEl.querySelectorAll('button[data-cmd]').forEach(btn => {
            const cmd = btn.dataset.cmd;
            if (cmd === 'source' || cmd === 'aiAssist') return;
            btn.disabled = !!disabled;
            btn.style.opacity = disabled ? '0.4' : '';
        });
    }

    async function mount(container, { initialHtml = '', placeholder = 'Start writing your policy…' } = {}) {
        const mods = await loadTipTap();
        const VideoEmbed = createVideoEmbedNode(mods);
        const Callout = createCalloutNode(mods);
        const MermaidDiagram = createMermaidNode(mods);

        container.classList.add('tt-host');
        container.innerHTML = `
            ${buildToolbarHtml()}
            <div class="tt-editor"></div>
            <div class="tt-source-host" style="display:none;">
                <div class="tt-source-banner">
                    <i class="fas fa-code"></i>
                    <span><strong>Source mode</strong> — raw HTML. Custom classes (e.g. <code>.nwca-doc</code>) and semantic tags survive save in this mode. Click <strong>Source</strong> again to return to WYSIWYG (will strip custom classes).</span>
                </div>
                <textarea class="tt-source" spellcheck="false" autocomplete="off" placeholder="<div class='nwca-doc'>&#10;  <header class='masthead'>...</header>&#10;  ...&#10;</div>"></textarea>
            </div>
        `;
        const toolbarEl = container.querySelector('.tt-toolbar');
        const editorEl = container.querySelector('.tt-editor');
        const sourceHost = container.querySelector('.tt-source-host');
        const sourceTextarea = container.querySelector('.tt-source');

        const editor = new mods.Editor({
            element: editorEl,
            extensions: [
                mods.StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
                mods.Image.configure({ inline: false, allowBase64: false }),
                mods.Link.configure({ openOnClick: false, autolink: true }),
                mods.Table.configure({ resizable: true }),
                mods.TableRow,
                mods.TableHeader,
                mods.TableCell,
                mods.Placeholder.configure({ placeholder }),
                mods.Typography,
                VideoEmbed,
                Callout,
                MermaidDiagram
            ],
            content: initialHtml || '<p></p>',
            editorProps: {
                attributes: { class: 'tt-content' }
            }
        });

        // Stash references the source-mode helpers need
        editor._toolbarEl = toolbarEl;
        editor._editorEl = editorEl;
        editor._sourceHost = sourceHost;
        editor._sourceTextarea = sourceTextarea;
        editor._policyMode = 'wysiwyg';
        // Stash the un-touched initialHtml so the first source-mode entry can
        // restore it verbatim (TipTap will have stripped HTML comments and
        // unknown classes during its own parse step).
        editor._originalInitialHtml = initialHtml;
        editor._sourceModeEnteredOnce = false;

        // Monkey-patch getHTML so the existing save flow (collectEditPayload,
        // autosave, cancel-diff) automatically gets the right value depending
        // on mode — no changes needed in policy-detail.js.
        editor._originalGetHTML = editor.getHTML.bind(editor);
        editor.getHTML = function () {
            if (editor._policyMode === 'source' && editor._sourceTextarea) {
                let html = editor._sourceTextarea.value || '';
                // Auto-stamp the rich-doc marker if the body uses .nwca-doc but
                // the marker isn't there yet — so the next open auto-flips back
                // to source mode.
                if (isRichDoc(html) && html.indexOf(NWCA_RICH_MARKER) === -1) {
                    html = stampRichMarker(html);
                    editor._sourceTextarea.value = html;
                }
                return html;
            }
            return editor._originalGetHTML();
        };

        wireToolbar(toolbarEl, editor);
        wireDropdowns(toolbarEl);
        wireFileDropAndPaste(editorEl, editor);
        updateToolbarState(toolbarEl, editor);

        // Auto-flip to source mode if the initial HTML carries the rich marker
        // or a .nwca-doc wrapper — preserves classes on round-trip edits.
        if (isRichDoc(initialHtml)) {
            // Defer one tick so TipTap finishes initial mount
            setTimeout(() => enterSourceMode(editor), 0);
        }

        return editor;
    }

    window.PolicyEditor = { mount, loadTipTap, detectVideoEmbed, NWCA_RICH_MARKER };
})();
