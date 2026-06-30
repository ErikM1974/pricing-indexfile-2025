(function () {
  'use strict';

  // Staff PREVIEW reuses this page at /portal-admin/preview/<id>/invoice/<orderNo>.
  var PREVIEW = location.pathname.match(/^\/portal-admin\/preview\/(\d+)\/invoice\/(\d+)/);
  var orderNo = PREVIEW ? PREVIEW[2] : (location.pathname.split('/').pop() || '');
  var INVOICE_API = PREVIEW ? ('/api/portal-admin/preview/' + PREVIEW[1] + '/invoice/' + encodeURIComponent(orderNo)) : ('/api/portal/invoice/' + encodeURIComponent(orderNo));
  var LOGIN_URL = PREVIEW ? '/auth/saml/login' : '/customer/login';
  var BACK_URL = PREVIEW ? ('/portal-admin/preview/' + PREVIEW[1]) : '/portal';
  // Point the "back" links at the right place for the mode we're in.
  document.querySelectorAll('a[href="/portal"]').forEach(function (a) { a.setAttribute('href', BACK_URL); });

  function esc(s) { if (s == null) return ''; var d = document.createElement('div'); d.appendChild(document.createTextNode(String(s))); return d.innerHTML; }
  function money(n) { return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  // UTC components — ManageOrders dates are date-only at UTC midnight; local getDate() would shift them a day back.
  function fdate(s) { if (!s) return ''; var d = new Date(s); if (isNaN(d.getTime())) return ''; var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return m[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(); }
  var SIZE_LABELS = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

  function fail() {
    document.getElementById('ci-loading').style.display = 'none';
    document.getElementById('ci-error').style.display = 'block';
  }

  if (!/^\d+$/.test(orderNo)) { fail(); return; }

  fetch(INVOICE_API, { credentials: 'same-origin' })
    .then(function (r) {
      if (r.status === 401) { location.href = LOGIN_URL; throw new Error('auth'); }
      if (!r.ok) throw new Error('load');
      return r.json();
    })
    .then(render)
    .catch(function (e) { if (e && e.message === 'auth') return; fail(); });

  function sizeStr(sizes) {
    var out = [];
    (sizes || []).forEach(function (v, i) { var n = Number(v) || 0; if (n > 0) out.push(SIZE_LABELS[i] + ' ' + n); });
    return out.join(' · ');
  }

  function render(d) {
    var rows = (d.items || []).map(function (it) {
      var sz = sizeStr(it.sizes);
      return '<tr>' +
        '<td class="num">' + esc(it.quantity) + '</td>' +
        '<td><div class="ci-item-part">' + esc(it.partNumber) + (it.color ? ' &middot; ' + esc(it.color) : '') + '</div>' +
          '<div>' + esc(it.description) + '</div>' +
          (sz ? '<div class="ci-item-sizes">' + esc(sz) + '</div>' : '') + '</td>' +
        '<td class="num">' + (it.unitPrice ? money(it.unitPrice) : '') + '</td>' +
        '<td class="num">' + (it.lineTotal ? money(it.lineTotal) : '') + '</td>' +
        '</tr>';
    }).join('');

    var balClass = (Number(d.balance) || 0) <= 0 ? 'bal paid' : 'bal';
    var html =
      '<div class="ci-head">' +
        '<div class="ci-head-left">' +
          '<img class="ci-logo" src="/images/nwca-logo.png" alt="Northwest Custom Apparel" crossorigin="anonymous">' +
          '<div class="ci-from">2025 Freeman Rd. E, Milton, WA 98354<br>253-922-5793 &middot; accounting@nwcustomapparel.com</div>' +
        '</div>' +
        '<div class="ci-head-right">' +
          '<div class="ci-inv-title">Invoice: ' + esc(d.invoiceNumber) + '</div>' +
          '<div class="ci-inv-meta">Date Ordered: ' + esc(fdate(d.dateOrdered)) + '<br>Date Invoiced: ' + esc(fdate(d.dateInvoiced) || '—') + '<br>Date Due: ' + esc(fdate(d.dueDate) || '—') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ci-parties">' +
        '<div class="ci-party"><h3>Bill To</h3><p><strong>' + esc(d.customerName) + '</strong></p>' +
          (d.contactName ? '<p>' + esc(d.contactName) + '</p>' : '') +
          (d.contactPhone ? '<p>' + esc(d.contactPhone) + '</p>' : '') +
          (d.contactEmail ? '<p>' + esc(d.contactEmail) + '</p>' : '') + '</div>' +
      '</div>' +
      '<div class="ci-meta-grid">' +
        '<div><div class="k">Customer #</div><div class="v">' + esc(d.customerNumber || '') + '</div></div>' +
        '<div><div class="k">PO Number</div><div class="v">' + esc(d.poNumber || '—') + '</div></div>' +
        '<div><div class="k">Terms</div><div class="v">' + esc(d.terms || '—') + '</div></div>' +
        '<div><div class="k">Salesperson</div><div class="v">' + esc(d.salesperson || '—') + '</div></div>' +
        ((d.designId || d.designName) ? '<div style="grid-column:1/-1"><div class="k">Design</div><div class="v">' + (d.designId ? '#' + esc(d.designId) + ' · ' : '') + esc(d.designName || '') + '</div></div>' : '') +
      '</div>' +
      '<table class="ci-table"><thead><tr><th class="num">Qty</th><th>Item</th><th class="num">Unit Price</th><th class="num">Total</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="ci-totals"><table>' +
        '<tr><td class="lbl">Subtotal</td><td class="amt">' + money(d.subtotal) + '</td></tr>' +
        '<tr><td class="lbl">Sales Tax</td><td class="amt">' + money(d.salesTax) + '</td></tr>' +
        '<tr><td class="lbl">Shipping</td><td class="amt">' + money(d.shipping) + '</td></tr>' +
        '<tr class="grand"><td class="lbl">Total</td><td class="amt">' + money(d.total) + '</td></tr>' +
        '<tr><td class="lbl">Paid</td><td class="amt">' + money(d.paid) + '</td></tr>' +
        '<tr class="' + balClass + '"><td class="lbl">Balance Due</td><td class="amt">' + money(d.balance) + '</td></tr>' +
      '</table></div>' +
      '<div class="ci-foot">Thank you for your business! &middot; Northwest Custom Apparel &middot; (253) 922-5793</div>';

    var paper = document.getElementById('ci-paper');
    paper.innerHTML = html;
    document.getElementById('ci-loading').style.display = 'none';
    paper.style.display = 'block';
    document.title = 'Invoice #' + d.invoiceNumber + ' — NWCA';

    document.getElementById('ci-download').addEventListener('click', function () {
      var btn = this, old = btn.textContent;
      btn.disabled = true; btn.textContent = 'Preparing…';
      var opt = {
        margin: [10, 10, 10, 10],
        filename: 'Invoice-' + d.invoiceNumber + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
      };
      var done = function () { btn.disabled = false; btn.textContent = old; };
      if (typeof html2pdf === 'undefined') { window.print(); done(); return; }
      html2pdf().set(opt).from(paper).save().then(done).catch(done);
    });
  }
})();
