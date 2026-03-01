/* Old Designs Archive — Image modal, Caspio enhancements, and UX features */
(function() {
    var modal = document.getElementById('image-modal');
    var modalImg = modal.querySelector('img');
    var modalCounter = modal.querySelector('.modal-counter');
    var prevBtn = modal.querySelector('.modal-prev');
    var nextBtn = modal.querySelector('.modal-next');
    var container = document.querySelector('.caspio-container');
    var toastContainer = document.getElementById('toast-container');
    var stickyBar = document.getElementById('sticky-search-bar');

    /* ===========================
       1. Toast Notifications
       =========================== */
    function showToast(message, type) {
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + (type || 'success');
        toast.textContent = message;
        toastContainer.appendChild(toast);
        requestAnimationFrame(function() { toast.classList.add('show'); });
        setTimeout(function() {
            toast.classList.remove('show');
            setTimeout(function() { toast.remove(); }, 300);
        }, 2500);
    }

    /* ===========================
       2. Share Design Image URL
       =========================== */
    function shareDesignImage(card) {
        var img = card.querySelector('img');
        var dds = card.querySelectorAll('dd');
        var designNum = dds.length > 1 ? dds[1].textContent.trim() : 'design';
        var url = img ? img.src : '';
        if (!url || url === window.location.href || url === '') {
            showToast('No image available for this design', 'error');
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function() {
                showToast('Image link copied for ' + designNum + '!', 'success');
            }).catch(function() {
                fallbackCopy(url, designNum);
            });
        } else {
            fallbackCopy(url, designNum);
        }
    }

    function fallbackCopy(text, designNum) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            showToast('Image link copied for ' + designNum + '!', 'success');
        } catch (e) {
            showToast('Could not copy link', 'error');
        }
        document.body.removeChild(ta);
    }

    /* ===========================
       3. Quick Copy Design Number
       =========================== */
    function copyDesignNumber(card) {
        var dds = card.querySelectorAll('dd');
        var designNum = dds.length > 1 ? dds[1].textContent.trim() : '';
        if (!designNum) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(designNum).then(function() {
                showToast('Copied: ' + designNum, 'success');
            });
        } else {
            fallbackCopy(designNum, designNum);
        }
    }

    /* ===========================
       4. Image Modal + Navigation
       =========================== */
    var allImages = [];
    var currentIndex = 0;

    function collectVisibleImages() {
        allImages = [];
        var cards = container.querySelectorAll('[data-cb-name="data-row"]');
        cards.forEach(function(card) {
            var imgs = card.querySelectorAll('img');
            imgs.forEach(function(img) {
                if (img.src && img.src !== window.location.href && img.src !== '' && img.style.display !== 'none') {
                    allImages.push(img.src);
                }
            });
        });
    }

    function openModal(src) {
        collectVisibleImages();
        currentIndex = allImages.indexOf(src);
        if (currentIndex === -1) currentIndex = 0;
        modalImg.src = src;
        updateModalCounter();
        modal.classList.add('active');
    }

    function updateModalCounter() {
        if (allImages.length > 1) {
            modalCounter.textContent = (currentIndex + 1) + ' / ' + allImages.length;
            modalCounter.style.display = 'block';
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
        } else {
            modalCounter.style.display = 'none';
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }
    }

    function navigateModal(dir) {
        if (allImages.length <= 1) return;
        currentIndex = (currentIndex + dir + allImages.length) % allImages.length;
        modalImg.src = allImages[currentIndex];
        updateModalCounter();
    }

    function closeModal() {
        modal.classList.remove('active');
        modalImg.src = '';
    }

    container.addEventListener('click', function(e) {
        /* Share button */
        var shareBtn = e.target.closest('.card-share-btn');
        if (shareBtn) {
            var card = shareBtn.closest('[data-cb-name="data-row"]');
            if (card) shareDesignImage(card);
            return;
        }
        /* Copy button */
        var copyBtn = e.target.closest('.card-copy-btn');
        if (copyBtn) {
            var card = copyBtn.closest('[data-cb-name="data-row"]');
            if (card) copyDesignNumber(card);
            return;
        }
        /* Image click → open modal */
        var img = e.target.closest('img');
        if (img && img.naturalWidth > 0) {
            openModal(img.src);
        }
    });

    modal.addEventListener('click', function(e) {
        if (e.target !== modalImg && !e.target.closest('.modal-nav') && !e.target.closest('.modal-counter')) {
            closeModal();
        }
    });

    prevBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        navigateModal(-1);
    });

    nextBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        navigateModal(1);
    });

    document.addEventListener('keydown', function(e) {
        if (modal.classList.contains('active')) {
            if (e.key === 'Escape') closeModal();
            if (e.key === 'ArrowLeft') navigateModal(-1);
            if (e.key === 'ArrowRight') navigateModal(1);
            return;
        }
        /* Feature 8: / to focus search */
        if (e.key === '/' && !e.target.closest('input, select, textarea')) {
            e.preventDefault();
            var firstInput = container.querySelector('input[type="text"]');
            if (firstInput) firstInput.focus();
        }
    });

    /* ===========================
       5. Caspio Form Restructure
       =========================== */
    function restructureForm() {
        var form = container.querySelector('form');
        if (!form || form.dataset.restructured) return;

        var labels = form.querySelectorAll('.cbFormLabelCell');
        labels.forEach(function(label) {
            var field = label.nextElementSibling;
            if (field && field.classList.contains('cbFormFieldCell')) {
                var wrapper = document.createElement('div');
                wrapper.className = 'form-field-group';
                label.parentNode.insertBefore(wrapper, label);
                wrapper.appendChild(label);
                wrapper.appendChild(field);
            }
        });

        form.classList.add('restructured-form');
        form.dataset.restructured = 'true';

        /* Add keyboard hint near search button */
        var btnContainer = form.querySelector('.cbSearchButtonContainer');
        if (btnContainer && !btnContainer.querySelector('.keyboard-hint')) {
            var hint = document.createElement('span');
            hint.className = 'keyboard-hint';
            hint.innerHTML = 'Press <kbd>/</kbd> to search';
            btnContainer.appendChild(hint);
        }
    }

    /* ===========================
       6. Result Card Cleanup + Inject Action Buttons
       =========================== */
    function cleanupResults() {
        var cards = container.querySelectorAll('[data-cb-name="data-row"]');
        if (!cards.length) return;

        cards.forEach(function(card) {
            if (card.dataset.cleaned) return;

            /* Hide empty images */
            var imgs = card.querySelectorAll('img');
            imgs.forEach(function(img) {
                if (!img.src || img.src === window.location.href || img.src === '') {
                    img.style.display = 'none';
                }
            });

            /* Hide empty DST File dd values */
            var dds = card.querySelectorAll('dd');
            dds.forEach(function(dd) {
                var content = dd.textContent.trim();
                if (content === '' || content === '\u00a0') {
                    var prevDt = dd.previousElementSibling;
                    if (prevDt && prevDt.tagName === 'DT') {
                        if (prevDt.textContent.trim() === 'DST File') {
                            dd.style.display = 'none';
                        }
                    }
                }
            });

            /* Inject action buttons */
            if (!card.querySelector('.card-actions')) {
                var actions = document.createElement('div');
                actions.className = 'card-actions';
                actions.innerHTML =
                    '<button class="card-action-btn card-copy-btn" title="Copy design number"><i class="fa-regular fa-copy"></i></button>' +
                    '<button class="card-action-btn card-share-btn" title="Copy image link for customer"><i class="fa-solid fa-share-from-square"></i></button>';
                card.appendChild(actions);
            }

            card.dataset.cleaned = 'true';
        });

        updateResultCount();
        hideLoading();
        checkEmptyState();
    }

    /* ===========================
       7. Result Count Badge
       =========================== */
    function updateResultCount() {
        var existing = container.querySelector('.result-count-badge');
        var cards = container.querySelectorAll('[data-cb-name="data-row"]');

        if (!cards.length) {
            if (existing) existing.remove();
            return;
        }

        /* Try to read total pages from Caspio nav "of N" text */
        var totalText = '';
        var navTable = container.querySelector('.cbResultSetNavigationTable');
        if (navTable) {
            var navText = navTable.textContent || '';
            var match = navText.match(/of\s+([\d,]+)/i);
            if (match) {
                var pageCount = parseInt(match[1].replace(/,/g, ''), 10);
                if (pageCount > 1) {
                    var estimate = pageCount * 24;
                    totalText = '~' + estimate.toLocaleString() + ' designs found';
                } else {
                    totalText = cards.length + ' designs found';
                }
            }
        }

        if (!totalText) {
            totalText = cards.length + ' designs shown';
        }

        if (!existing) {
            existing = document.createElement('div');
            existing.className = 'result-count-badge';
            var resultsSection = container.querySelector('section.cbColumnarReport, [id^="GridCtnr_"] section');
            if (resultsSection) {
                resultsSection.parentNode.insertBefore(existing, resultsSection);
            }
        }

        existing.innerHTML = '<i class="fa-solid fa-layer-group"></i> ' + totalText;
    }

    /* ===========================
       8. Loading Spinner
       =========================== */
    var loadingEl = null;

    function showLoading() {
        hideLoading();
        loadingEl = document.createElement('div');
        loadingEl.className = 'loading-spinner';
        loadingEl.innerHTML = '<div class="spinner-ring"></div><span>Searching archives...</span>';
        container.appendChild(loadingEl);
    }

    function hideLoading() {
        if (loadingEl) {
            loadingEl.remove();
            loadingEl = null;
        }
    }

    /* Intercept search button click to show spinner */
    container.addEventListener('click', function(e) {
        var searchBtn = e.target.closest('.cbSearchButton, input[type="submit"]');
        if (searchBtn) {
            showLoading();
            /* Remove existing result count + empty state */
            var badge = container.querySelector('.result-count-badge');
            if (badge) badge.remove();
            var empty = container.querySelector('.empty-state');
            if (empty) empty.remove();
        }
    });

    /* ===========================
       9. No Results Empty State
       =========================== */
    function checkEmptyState() {
        var existing = container.querySelector('.empty-state');
        var cards = container.querySelectorAll('[data-cb-name="data-row"]');

        if (cards.length > 0) {
            if (existing) existing.remove();
            return;
        }

        /* Check if Caspio has finished loading (has navigation or error element) */
        var hasNav = container.querySelector('.cbResultSetNavigationTable, .cbResultSetError');
        var hasMessage = container.querySelector('.cbResultSetNavigationMessages');
        var messageText = hasMessage ? hasMessage.textContent : '';
        var hasZero = messageText.indexOf('0') > -1 || messageText.indexOf('No records') > -1;

        if ((hasNav || hasZero) && !existing) {
            var empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML =
                '<i class="fa-solid fa-box-archive"></i>' +
                '<h3>No designs found</h3>' +
                '<p>Try broadening your search or using fewer filters</p>';
            var resultsSection = container.querySelector('section.cbColumnarReport, [id^="GridCtnr_"]');
            if (resultsSection) {
                resultsSection.parentNode.insertBefore(empty, resultsSection.nextSibling);
            } else {
                container.appendChild(empty);
            }
        }
    }

    /* ===========================
       10. Sticky Search Summary Bar
       =========================== */
    var searchFormObserved = false;

    function setupStickyBar() {
        if (searchFormObserved) return;
        var form = container.querySelector('form');
        if (!form) return;
        searchFormObserved = true;

        var io = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (!entry.isIntersecting) {
                    stickyBar.classList.add('visible');
                } else {
                    stickyBar.classList.remove('visible');
                }
            });
        }, { threshold: 0, rootMargin: '-80px 0px 0px 0px' });

        io.observe(form);
    }

    function buildStickyBar(form) {
        var chips = [];
        var selects = form.querySelectorAll('select');
        selects.forEach(function(sel) {
            if (sel.value && sel.value !== '') {
                var label = '';
                var group = sel.closest('.form-field-group');
                if (group) {
                    var lbl = group.querySelector('.cbFormLabelCell, label');
                    if (lbl) label = lbl.textContent.trim();
                }
                if (!label) label = sel.name || 'Filter';
                var display = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : sel.value;
                chips.push('<span class="sticky-chip"><strong>' + label + ':</strong> ' + escapeHtml(display) + '</span>');
            }
        });
        var textInputs = form.querySelectorAll('input[type="text"]');
        textInputs.forEach(function(inp) {
            if (inp.value.trim()) {
                var label = '';
                var group = inp.closest('.form-field-group');
                if (group) {
                    var lbl = group.querySelector('.cbFormLabelCell, label');
                    if (lbl) label = lbl.textContent.trim();
                }
                if (!label) label = 'Search';
                chips.push('<span class="sticky-chip"><strong>' + label + ':</strong> ' + escapeHtml(inp.value.trim()) + '</span>');
            }
        });

        if (chips.length === 0) {
            stickyBar.innerHTML = '<div class="sticky-content"><span class="sticky-label">Showing all designs</span><button class="sticky-edit-btn" onclick="document.querySelector(\'.caspio-container\').scrollIntoView({behavior:\'smooth\'})">Edit Search</button></div>';
        } else {
            stickyBar.innerHTML = '<div class="sticky-content"><span class="sticky-label">Filtered by:</span>' + chips.join('') + '<button class="sticky-edit-btn" onclick="document.querySelector(\'.caspio-container\').scrollIntoView({behavior:\'smooth\'})">Edit Search</button></div>';
        }
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /* ===========================
       MutationObserver — Orchestrates all enhancements
       =========================== */
    function refreshStickyContent() {
        var form = container.querySelector('form');
        if (form) buildStickyBar(form);
    }

    var debounceTimer;
    var observer = new MutationObserver(function() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
            restructureForm();
            cleanupResults();
            setupStickyBar();
            refreshStickyContent();
        }, 150);
    });
    observer.observe(container, { childList: true, subtree: true });

    /* Immediate + safety fallbacks */
    restructureForm();
    setTimeout(function() { restructureForm(); cleanupResults(); setupStickyBar(); }, 500);
    setTimeout(function() { restructureForm(); cleanupResults(); setupStickyBar(); }, 2000);
})();
