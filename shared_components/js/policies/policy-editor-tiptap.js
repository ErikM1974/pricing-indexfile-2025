/**
 * TipTap rich-text editor wrapper for Policies Hub.
 *
 * Loads TipTap from esm.sh with a pinned version. No build step required.
 *
 * Usage:
 *   const editor = await PolicyEditor.mount(domElement, { initialHtml });
 *   const html = editor.getHTML();
 *   editor.destroy();
 *
 * DOMPurify is loaded alongside for sanitizing render output (NOT shown here —
 * see policy-detail.js where it's used).
 */
(function () {
    'use strict';

    const TT_VERSION = '2.10.4';

    let cachedModules = null;

    async function loadTipTap() {
        if (cachedModules) return cachedModules;

        // Use dynamic import for ESM — works without a build step.
        const [core, starterKit, image, link, table, tableRow, tableCell, tableHeader, placeholder, typography] = await Promise.all([
            import(`https://esm.sh/@tiptap/core@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/starter-kit@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-image@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-link@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-table@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-table-row@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-table-cell@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-table-header@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-placeholder@${TT_VERSION}`),
            import(`https://esm.sh/@tiptap/extension-typography@${TT_VERSION}`)
        ]);

        cachedModules = {
            Editor: core.Editor,
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
                <button type="button" data-cmd="image" title="Insert image URL"><i class="fas fa-image"></i></button>
                <button type="button" data-cmd="table" title="Insert table"><i class="fas fa-table"></i></button>
                <span class="tt-sep"></span>
                <button type="button" data-cmd="hr" title="Horizontal rule"><i class="fas fa-minus"></i></button>
                <button type="button" data-cmd="undo" title="Undo (Ctrl+Z)"><i class="fas fa-undo"></i></button>
                <button type="button" data-cmd="redo" title="Redo (Ctrl+Shift+Z)"><i class="fas fa-redo"></i></button>
            </div>
        `;
    }

    function wireToolbar(toolbarEl, editor) {
        toolbarEl.querySelectorAll('button[data-cmd]').forEach(btn => {
            btn.addEventListener('click', (e) => {
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
                    case 'image': {
                        const url = window.prompt('Image URL (paste a URL — file upload coming in Phase 2):');
                        if (url) editor.chain().focus().setImage({ src: url }).run();
                        break;
                    }
                    case 'table': {
                        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
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

    async function mount(container, { initialHtml = '', placeholder = 'Start writing your policy…' } = {}) {
        const mods = await loadTipTap();

        // Build chrome: toolbar above + editor area below
        container.classList.add('tt-host');
        container.innerHTML = `
            ${buildToolbarHtml()}
            <div class="tt-editor"></div>
        `;
        const toolbarEl = container.querySelector('.tt-toolbar');
        const editorEl = container.querySelector('.tt-editor');

        const editor = new mods.Editor({
            element: editorEl,
            extensions: [
                mods.StarterKit.configure({
                    heading: { levels: [1, 2, 3] }
                }),
                mods.Image,
                mods.Link.configure({ openOnClick: false, autolink: true }),
                mods.Table.configure({ resizable: true }),
                mods.TableRow,
                mods.TableHeader,
                mods.TableCell,
                mods.Placeholder.configure({ placeholder }),
                mods.Typography
            ],
            content: initialHtml || '<p></p>',
            editorProps: {
                attributes: {
                    class: 'tt-content'
                }
            }
        });

        wireToolbar(toolbarEl, editor);
        updateToolbarState(toolbarEl, editor);

        return editor;
    }

    window.PolicyEditor = { mount, loadTipTap };
})();
