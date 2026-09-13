/* Shared readiness for staff call sheets, labels and thread documents. */
(function (global) {
    'use strict';

    async function printWhenReady(printWindow) {
        if (!printWindow || printWindow.closed) throw new Error('The print window was closed or blocked.');
        const doc = printWindow.document;
        const failure = () => new Error('The print preview could not finish loading. Please try printing again.');
        const styles = [...doc.querySelectorAll('[data-print-styles]')];
        const cleanup = [];
        let timer;
        function loaded(node, ready) {
            return new Promise((resolve, reject) => {
                const done = () => resolve();
                const fail = () => reject(failure());
                node.addEventListener('load', done, { once: true });
                node.addEventListener('error', fail, { once: true });
                cleanup.push(() => { node.removeEventListener('load', done); node.removeEventListener('error', fail); });
                if (ready()) done();
            });
        }
        try {
            if (styles.length !== 3) throw failure();
            await Promise.race([
                (async () => {
                    await Promise.all(styles.map(link => loaded(link, () => Boolean(link.sheet))));
                    await Promise.all([...doc.images].map(async img => {
                        if (!img.complete) await loaded(img, () => img.complete);
                        if (!img.naturalWidth) throw failure();
                    }));
                    if (doc.fonts) await doc.fonts.ready;
                })(),
                new Promise((resolve, reject) => { timer = setTimeout(() => reject(failure()), 20000); })
            ]);
            if (printWindow.closed) throw new Error('The print window was closed.');
            printWindow.print();
        } catch (error) {
            if (!printWindow.closed) {
                const notice = doc.createElement('p');
                notice.className = 'staff-print-error';
                notice.setAttribute('role', 'alert');
                notice.textContent = error.message;
                doc.body.prepend(notice);
            }
            throw error;
        } finally {
            clearTimeout(timer);
            cleanup.forEach(remove => remove());
        }
    }

    global.NWCAStaffPrint = { printWhenReady };
})(window);
