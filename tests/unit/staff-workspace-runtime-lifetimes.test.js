const fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../..');
let dom;
function browser(body = '') {
    dom = new JSDOM('<!doctype html><html><body>' + body + '</body></html>', { url: 'https://example.test/', runScripts: 'outside-only' });
    dom.window.setTimeout = setTimeout;
    dom.window.clearTimeout = clearTimeout;
    dom.window.print = jest.fn();
    return dom.window;
}
function load(window, file) { window.eval(fs.readFileSync(path.join(root, file), 'utf8')); }
beforeEach(() => jest.useFakeTimers());
afterEach(() => { if (dom) dom.window.close(); jest.useRealTimers(); });
test('returning to a skipped tab still loads it exactly once', () => {
    const w = browser('<div id="tabs" role="tablist">' +
        ['today', 'calls', 'book'].map(x => '<button role="tab" data-tab="' + x + '" aria-controls="' + x + '">' + x + '</button>').join('') +
        '</div>' + ['today', 'calls', 'book'].map(x => '<section id="' + x + '" hidden></section>').join(''));
    load(w, 'shared_components/js/dash-tabs.js');
    const onActivate = jest.fn(), tabs = w.DashTabs.create({ tablist: '#tabs', defaultTab: 'today', activateDelay: 250, onActivate });
    w.document.querySelector('[data-tab="calls"]').click();
    jest.advanceTimersByTime(100);
    w.document.querySelector('[data-tab="book"]').click();
    jest.advanceTimersByTime(250);
    expect(tabs.isMounted('calls')).toBe(false);
    w.document.querySelector('[data-tab="calls"]').click();
    jest.advanceTimersByTime(250);
    expect(onActivate.mock.calls.filter(([id]) => id === 'calls')).toEqual([['calls', true]]);
    expect(tabs.isMounted('calls')).toBe(true);
    w.document.querySelector('[data-tab="book"]').click();
    jest.advanceTimersByTime(250);
    w.document.querySelector('[data-tab="calls"]').click();
    jest.advanceTimersByTime(250);
    expect(onActivate.mock.calls.filter(([id]) => id === 'calls')).toEqual([['calls', true], ['calls', false]]);
});
for (const kind of ['box labels', 'invoice']) {
    test(kind + ': completed print cleanup cannot clear the next job', () => {
        const w = browser(), d = w.document;
        let print, sheetId, bodyClass;
        if (kind === 'box labels') {
            load(w, 'shared_components/js/box-label-template.js');
            print = value => w.BoxLabelTemplate.printSheet('<p>' + value + '</p>');
            sheetId = 'sit-label-sheet'; bodyClass = 'sit-label-printing';
        } else {
            w.fetch = jest.fn(() => new Promise(() => {}));
            load(w, 'shared_components/js/sanmar-invoice-viewer.js');
            w.SanMarInvoiceViewer.open({ wo: 'SYNTHETIC', company: 'Sample', pos: ['SYNTHETIC'] });
            print = value => {
                d.getElementById('smiv-body').innerHTML = '<article class="smiv-inv">' + value + '</article>';
                d.getElementById('smiv-print').disabled = false;
                d.getElementById('smiv-print').click();
            };
            sheetId = 'smiv-print-sheet'; bodyClass = 'smiv-printing';
        }
        print('First report');
        jest.advanceTimersByTime(1000);
        w.dispatchEvent(new w.Event('afterprint'));
        print('Second report');
        jest.advanceTimersByTime(600);
        expect(d.getElementById(sheetId).textContent).toBe('Second report');
        expect(d.body.classList.contains(bodyClass)).toBe(true);
        expect(w.print).toHaveBeenCalledTimes(2);
        jest.advanceTimersByTime(900);
        expect(d.getElementById(sheetId)).toBeNull();
        expect(d.body.classList.contains(bodyClass)).toBe(false);
    });
}
