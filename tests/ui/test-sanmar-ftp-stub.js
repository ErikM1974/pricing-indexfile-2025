/* Test harness stub for the SanMar Downloads page. Intercepts the /api/staff/
   sanmar-ftp/list call with sample data so the real page JS renders offline
   (the live page is SAML-gated). External file to satisfy CSP (no inline JS). */
(function () {
  var SAMPLE = {
    files: [
      { dir: '/SanMarPDD/SanMarPI/', name: 'SanMarPI-Bulk-139942.csv', size: 337772575, modifiedAt: '2026-07-20T13:22:00.000Z' },
      { dir: '/SanMarPDD/SanMarPI/', name: 'Category_TShirts_07-22-2026.csv', size: 131404208, modifiedAt: '2026-07-22T00:00:00.000Z' },
      { dir: '/SanMarPDD/SanMarPI/', name: 'Category_PolosKnits_07-20-2026.csv', size: 62462873, modifiedAt: '2026-07-20T00:03:00.000Z' },
      { dir: '/SanMarPDD/', name: 'sanmar_dip.txt', size: 154210000, modifiedAt: '2026-07-22T06:00:00.000Z' },
      { dir: '/SanMarPDD/', name: 'Sanmar_SaleItems.txt', size: 2410000, modifiedAt: '2026-07-22T02:10:00.000Z' }
    ],
    masterKey: '/SanMarPDD/SanMarPI/SanMarPI-Bulk-139942.csv',
    checkedAt: '2026-07-22T14:30:00.000Z'
  };
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opts) {
    if (String(url).indexOf('/api/staff/sanmar-ftp/list') === 0) {
      return Promise.resolve({
        status: 200,
        json: function () { return Promise.resolve(SAMPLE); }
      });
    }
    return realFetch ? realFetch(url, opts) : Promise.reject(new Error('no fetch'));
  };
})();
