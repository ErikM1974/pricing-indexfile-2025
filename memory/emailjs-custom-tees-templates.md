# EmailJS Templates — Custom T-Shirts Storefront (2026-06-10)

The storefront success page (`pages/js/custom-tees-success.js`) sends TWO emails through
EmailJS service `service_1c4k67j`. We REUSE the legacy 3-Day Tees template IDs (no code
change): **`template_sample_customer`** and **`template_sample_sales`**. Only rename the
display names and replace Subject + Content with the blocks below.

> **Triple braces `{{{ }}}` are required** on every HTML parameter (payment_confirmation,
> products_table, delivery_section, shipping_row, tax_row, ltm_row, rush_banner,
> message_section, questions_cta). Double braces would show raw HTML tags.
> Rush vs standard is handled by `{{{rush_banner}}}` / `{{rush_flag}}` — empty on
> standard orders, so ONE template serves both.

## Parameters the code sends (do not invent others)

`order_number, customer_name, customer_email, customer_phone, company_name,
print_location, subtotal, total, ship_promise, rush_flag, company_phone, reply_to,
to_email, to_name` (plain) — `payment_confirmation, products_table, delivery_section,
shipping_row, tax_row, ltm_row, rush_banner, message_section, questions_cta` (HTML).

---

## Template 1 — `template_sample_customer`

- **Rename display name to:** `Custom T-Shirts Order Confirmation — Customer`
- **Subject:** `Your order is confirmed! {{order_number}} — Northwest Custom Apparel`
- **To Email:** `{{to_email}}` · **From Name:** `Northwest Custom Apparel`
- **Reply To:** `sales@nwcustomapparel.com` · **Bcc:** `sales@nwcustomapparel.com` (or erik@)

**Content (Edit Content → Code view, paste everything):**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin:0; padding:0; background:#f3f4f6; font-family:Arial,Helvetica,sans-serif; color:#1f2937; }
  .wrap { max-width:600px; margin:0 auto; background:#ffffff; }
  .header { background:#2d5f3f; color:#ffffff; text-align:center; padding:28px 20px; }
  .header h1 { margin:0 0 6px; font-size:24px; }
  .header p { margin:0; font-size:14px; opacity:.9; }
  .body { padding:24px; }
  .order-box { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; text-align:center; padding:16px; margin:0 0 16px; }
  .order-box .label { font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:.05em; }
  .order-box .num { font-size:22px; font-weight:bold; color:#2d5f3f; margin-top:4px; }
  .section { margin:20px 0; }
  .section h2 { font-size:15px; color:#2d5f3f; border-bottom:2px solid #e5e7eb; padding-bottom:6px; margin:0 0 10px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; background:#f3f4f6; padding:8px; color:#374151; }
  td { padding:8px; border-bottom:1px solid #f3f4f6; }
  .alert-success { background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:12px 16px; margin:14px 0; color:#065f46; }
  .totals { background:#f9fafb; border-radius:8px; padding:12px 16px; margin-top:10px; }
  .grand { display:flex; justify-content:space-between; border-top:2px solid #2d5f3f; margin-top:6px; padding-top:8px; font-size:16px; font-weight:bold; color:#2d5f3f; }
  .promise { background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 16px; margin:14px 0; font-size:14px; }
  .next li { font-size:13px; color:#374151; margin:6px 0; }
  .footer { background:#f3f4f6; text-align:center; font-size:12px; color:#6b7280; padding:18px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🎉 Order Confirmed!</h1>
    <p>Thank you for choosing Northwest Custom Apparel</p>
  </div>
  <div class="body">
    <div class="order-box">
      <div class="label">Your Order Number</div>
      <div class="num">{{order_number}}</div>
    </div>

    {{{rush_banner}}}
    {{{payment_confirmation}}}

    <div class="section">
      <h2>Your Order</h2>
      {{{products_table}}}
      <div class="totals">
        <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;"><span>Subtotal</span><span>{{subtotal}}</span></div>
        {{{ltm_row}}}
        {{{shipping_row}}}
        {{{tax_row}}}
        <div class="grand"><span>Total Paid</span><span>{{total}}</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Delivery</h2>
      {{{delivery_section}}}
      <div class="promise">📅 <strong>Promised:</strong> {{ship_promise}}</div>
    </div>

    <div class="section">
      <h2>What happens next</h2>
      <ol class="next">
        <li>Our art team reviews your design and preps it for print.</li>
        <li>We print your shirts on our DTG presses in Milton, WA.</li>
        <li>We ship UPS Ground (or call you for pickup) by your promised date.</li>
      </ol>
      <p style="font-size:12px;color:#6b7280;">Design placement on your preview is approximate — our print
      team positions your artwork at the standard print location for a professional result.</p>
    </div>

    {{{message_section}}}
    {{{questions_cta}}}
  </div>
  <div class="footer">
    Northwest Custom Apparel · 2025 Freeman Rd E, Milton, WA 98354 · {{company_phone}}<br>
    Family owned &amp; operated since 1977
  </div>
</div>
</body>
</html>
```

---

## Template 2 — `template_sample_sales`

- **Rename display name to:** `Custom T-Shirts New Order — Sales`
- **Subject:** `💰 New T-Shirt Order {{order_number}} — {{customer_name}} {{rush_flag}}`
- **To Email:** `sales@nwcustomapparel.com` (or keep erik@) · **From Name:** `NWCA Storefront`
- **Reply To:** `{{customer_email}}` ← lets a rep hit Reply to answer the customer directly.

**Content:**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin:0; padding:0; background:#f3f4f6; font-family:Arial,Helvetica,sans-serif; color:#1f2937; }
  .wrap { max-width:640px; margin:0 auto; background:#ffffff; }
  .header { background:#1f2937; color:#ffffff; text-align:center; padding:22px 20px; }
  .header h1 { margin:0; font-size:20px; }
  .order-pill { display:inline-block; background:#2d5f3f; color:#fff; border-radius:6px; padding:8px 18px; font-size:16px; font-weight:bold; margin-top:10px; }
  .body { padding:22px; }
  .section { margin:18px 0; }
  .section h2 { font-size:14px; color:#2d5f3f; border-bottom:2px solid #e5e7eb; padding-bottom:5px; margin:0 0 8px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; background:#f3f4f6; padding:7px; color:#374151; }
  td { padding:7px; border-bottom:1px solid #f3f4f6; }
  .alert-success { background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:10px 14px; margin:12px 0; color:#065f46; }
  .kv td { border:none; padding:4px 8px; }
  .kv td:first-child { color:#6b7280; width:130px; }
  .totals { background:#f9fafb; border-radius:8px; padding:10px 14px; }
  .grand { display:flex; justify-content:space-between; border-top:2px solid #2d5f3f; margin-top:6px; padding-top:7px; font-size:15px; font-weight:bold; color:#2d5f3f; }
  .admin-link { display:inline-block; background:#2d5f3f; color:#ffffff !important; text-decoration:none; border-radius:6px; padding:10px 20px; font-size:14px; margin-top:8px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🛒 New Online T-Shirt Order</h1>
    <div class="order-pill">{{order_number}}</div>
  </div>
  <div class="body">
    {{{rush_banner}}}
    {{{payment_confirmation}}}

    <div class="section">
      <h2>Customer</h2>
      <table class="kv">
        <tr><td>Name</td><td><strong>{{customer_name}}</strong></td></tr>
        <tr><td>Email</td><td>{{customer_email}}</td></tr>
        <tr><td>Phone</td><td>{{customer_phone}}</td></tr>
        <tr><td>Company / group</td><td>{{company_name}}</td></tr>
        <tr><td>Print location</td><td>{{print_location}}</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>Order</h2>
      {{{products_table}}}
      <div class="totals">
        <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:14px;"><span>Subtotal</span><span>{{subtotal}}</span></div>
        {{{ltm_row}}}
        {{{shipping_row}}}
        {{{tax_row}}}
        <div class="grand"><span>Total Paid</span><span>{{total}}</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Delivery — promised {{ship_promise}}</h2>
      {{{delivery_section}}}
    </div>

    {{{message_section}}}

    <div class="section">
      <h2>Work the order</h2>
      <p style="font-size:13px;color:#374151;">Artwork files, mockups and totals are on the quote page;
      the order also pushed to ShopWorks with attachments.</p>
      <a class="admin-link" href="https://www.teamnwca.com/quote/{{order_number}}">Open {{order_number}} in Quote Management</a>
    </div>
  </div>
</div>
</body>
</html>
```

---

## Wiring checklist (one-time, in the EmailJS dashboard)

1. Open each template → rename per above → **Subject** per above.
2. Content tab → **Edit Content → Code** view → select-all, delete, paste the block.
3. Settings sidebar: customer template Reply-To `sales@nwcustomapparel.com` (was erik@),
   Bcc `sales@` or erik@; sales template To `sales@nwcustomapparel.com`, Reply-To `{{customer_email}}`.
4. **Test It** with sample params, then place a $1-style test order or rely on the next real order.

No code deploy needed — the page already sends every parameter above (rush_banner added v2026.06.10.13).
