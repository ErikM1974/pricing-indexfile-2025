/* Shared service-guide controls. All work stays in the current document. */
(() => {
    'use strict';
    const root = document.querySelector('[data-ui="unified"][data-training="service"]');
    if (!root) return;
    root.querySelector('[data-training-back]')?.addEventListener('click', () => {
        window.location.href = '/staff-dashboard.html';
    });
    root.querySelectorAll('.training-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const open = button.getAttribute('aria-expanded') !== 'true';
            button.setAttribute('aria-expanded', String(open));
            button.closest('.training-disclosure').classList.toggle('is-open', open);
        });
    });
    root.classList.add('training-ready');
    root.querySelectorAll('main img').forEach(img => {
        const original = img.src;
        const status = document.createElement('p');
        status.className = 'training-image-status';
        status.setAttribute('role', 'status');
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn-secondary training-image-retry';
        retry.textContent = 'Retry image';
        retry.setAttribute('aria-label', 'Retry image: ' + img.alt);
        retry.hidden = true;
        img.after(status, retry);
        const loading = () => {
            status.textContent = 'Loading image: ' + img.alt + '…';
            status.classList.remove('is-error');
            retry.hidden = true;
        };
        const loaded = () => {
            status.textContent = '';
            status.classList.remove('is-error');
            retry.hidden = true;
        };
        const failed = () => {
            status.textContent = 'Image unavailable: ' + img.alt + '. Try loading it again.';
            status.classList.add('is-error');
            retry.hidden = false;
        };
        img.addEventListener('load', loaded);
        img.addEventListener('error', failed);
        retry.addEventListener('click', () => {
            loading();
            const url = new window.URL(original);
            url.searchParams.set('training-retry', String(Date.now()));
            img.src = url.href;
        });
        if (img.complete) {
            if (img.naturalWidth) loaded();
            else failed();
        } else loading();
    });
})();
