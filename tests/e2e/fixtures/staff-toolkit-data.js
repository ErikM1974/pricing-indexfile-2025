// Synthetic data only. Used by the original/current browser comparison.
const fixed = '2026-09-09T20:00:00Z';
const serviceCodes = Object.entries({ 'VOL-HOUR-RATE': 80, 'VOL-ORDER-COST': 15, 'VOL-SETUP-MIN': 20, 'VOL-MIN-PER-PC': 2, 'VOL-MIN-GM': 35, 'VOL-MIN-QTY': 144, 'VOL-DENOM-FLOOR': 0.65, 'VOL-SPM': 500, 'VOL-HEADS-WORST': 4, 'VOL-HANDLING-MIN': 1, 'VOL-SLACK': 15, 'CTR-MIN-ORDER': 40, 'VOL-THREAD-PER-1K': 0.02 }).map(([ServiceCode, SellPrice]) => ({ ServiceCode, SellPrice, StitchBase: 8000 }));
const contract = Object.fromEntries(['garments', 'caps', 'fullBack'].map((key, i) => [key, { perThousandRates: { '1-7': 1.5 + i / 10, '8-23': 1.1 + i / 10, '24-47': 0.9 + i / 10, '48-71': 0.8 + i / 10, '72+': 0.7 + i / 10 } }]));
const posts = ['Draft', 'Published'].map((status, i) => ({ slug: 'synthetic-team-guide-' + i, title: ['Synthetic Team Apparel Guide', 'Synthetic Embroidery Care Guide'][i], status, category: 'Guides', author: 'Review Staff', publishedAt: i ? '2026-09-08T17:00:00Z' : '', metaDescription: 'Synthetic editorial content for layout review.', bodyMarkdown: '# Synthetic team guide\n\nChoose comfortable apparel for your team.\n\n- Preserve names\n- Check quantities', heroImageUrl: '' }));
const invites = ['Cedar Outfitters', 'Harbor Club', 'Pine Team'].map((name, i) => ({ PK_ID: 99101 + i, id_Customer: 98101 + i, company_name: 'Synthetic ' + name, email: 'review' + i + '@example.test', account_rep: ['Review Staff', 'Sample Staff', 'Review Staff'][i], enabled: i !== 2, last_login: i === 0 ? '2026-09-09T18:00:00Z' : '' }));
const requests = [{ PK_ID: 99301, Company_Name: 'Synthetic Cedar Outfitters', Email: 'review0@example.test', Style: 'PC54', Product_Title: 'Synthetic Cotton Tee', Design_Number: '88001', Rep: 'Review Staff', Color: 'Navy', Qty: 48, Note: 'Synthetic request; do not send.', Status: 'New', Created: '2026-09-09T16:00:00Z' }];
const mailing = ['Cedar Outfitters', 'Harbor Club', 'Pine Team'].map((name, i) => ({ PK_ID: 99401 + i, Company: 'Synthetic ' + name, First_Name: ['Avery', 'Jordan', 'Casey'][i], Last_Name: 'Example', Contact_Name: ['Avery', 'Jordan', 'Casey'][i] + ' Example', Address: i ? '' : '123 Example Lane', City: 'Tacoma', State: 'WA', Zip: '98402', Phone: '253-555-010' + i, Email: i === 1 ? '' : 'review' + i + '@example.test', Website: '', Source: 'Synthetic review', Category: 'Construction Prospect', Notes: 'Synthetic only; no outreach.', Added_By: 'review@example.test', Created_At: '2026-09-08T16:00:00Z' }));
const late = [{ idOrder: 99501, company: 'Synthetic Cedar Outfitters', dueDate: '2026-09-07', daysUntilDue: -2, subtotal: 1420, blanks: 'none', orderType: 'Embroidery', vendors: [], partiallyShipped: false }, { idOrder: 99502, company: 'Synthetic Harbor Club', dueDate: '2026-09-05', daysUntilDue: -4, subtotal: 780, blanks: 'partial', orderType: 'Screen Print', vendors: ['Synthetic Vendor'], partiallyShipped: true }];
const atRisk = [{ idOrder: 99503, company: 'Synthetic Pine Team', dueDate: '2026-09-11', daysUntilDue: 2, subtotal: 560, blanks: 'ordered', orderType: 'Embroidery', vendors: ['Synthetic Vendor'] }];
const due = { today: '2026-09-09', lookbackDays: 30, ordersScanned: 24, late, atRisk, counts: { late: 2, atRisk: 1, dueSoonOnTrack: 4 }, reps: ['Nika Lao', 'House'], byRep: { 'Nika Lao': { late: [late[0]], atRisk }, House: { late: [late[1]], atRisk: [] } } };
const products = ['REVIEW-TEE', 'REVIEW-CAP', 'REVIEW-JACKET'].map((StyleNumber, i) => ({ ID_Product: 99601 + i, StyleNumber, ProductName: ['Synthetic Cotton Tee', 'Synthetic Cap', 'Synthetic Jacket'][i], Brand: 'Synthetic Vendor', Category: ['Tees', 'Caps', 'Outerwear'][i], DefaultCost: i === 2 ? 0 : 5.25 + i, DefaultSellPrice: i === 1 ? 14 : 0, PricingMethod: i === 1 ? 'Fixed' : 'Auto', IsActive: i !== 2, ImageURL: '', VendorCode: 'SSA' }));
const bundle = { sizes: [{ size: 'S', price: 5.25, sortOrder: 1 }, { size: 'M', price: 5.25, sortOrder: 2 }, { size: '2XL', price: 7.25, sortOrder: 3 }], tiersR: [{ TierLabel: '72+', MinQuantity: 72, MarginDenominator: 0.57 }], allEmbroideryCostsR: [{ ItemType: 'Shirt', TierLabel: '72+', EmbroideryCost: 8, BaseStitchCount: 8000, StitchIncrement: 1000, AdditionalStitchRate: 1.25 }], sellingPriceDisplayAddOns: { S: 0, M: 0, '2XL': 2 }, rulesR: { RoundingMethod: 'HalfDollarCeil' }, locations: [{ code: 'LC', name: 'Left Chest' }, { code: 'RC', name: 'Right Chest' }] };
function response(u) {
  const p = u.pathname;
  if (p === '/api/service-codes') return u.searchParams.has('code') ? serviceCodes.filter(r => r.ServiceCode === u.searchParams.get('code')) : serviceCodes;
  if (p === '/api/contract-pricing') return contract;
  if (p === '/api/staff/employees') return [{ name: 'Review Staff' }];
  if (p === '/api/pricing-bundle') return bundle;
  if (p === '/api/product-details') return [{ PRODUCT_TITLE: 'Synthetic Cotton Tee', BRAND_NAME: 'Synthetic Vendor', PIECE_PRICE: 6.25 }];
  if (p === '/api/sanmar/inventory/PC54') return { inventory: [{ color: 'Navy', totalQty: 900 }, { color: 'White', totalQty: 600 }], grandTotal: 1500 };
  if (p === '/api/crm-proxy/blog-posts') return { posts };
  if (p.startsWith('/api/crm-proxy/blog-posts/')) return { post: posts.find(v => p.endsWith('/' + v.slug)) };
  if (p === '/api/portal-admin/me') return { repName: 'Review Staff', email: 'review@example.test' };
  if (p === '/api/crm-session/me') return { authenticated: true, firstName: 'Review', email: 'review@example.test', permissions: ['staff', 'admin'] };
  if (p === '/api/crm-proxy/customer-portal-access') return { rows: invites };
  if (p === '/api/crm-proxy/customer-rewards/balances') return { balances: { 98101: 125.50, 98102: 0, 98103: 25 } };
  if (p === '/api/crm-proxy/portal-reorder/requests') return { rows: requests };
  if (p === '/api/crm-proxy/jim-mailing-list') return { entries: mailing };
  if (p === '/api/crm-proxy/jim-mailing-list/mailchimp/status') return { ok: true, configured: true, dc: 'us7', audience: { name: 'Synthetic Prospects', members: 3 } };
  if (p === '/api/crm-proxy/ae-dashboard/due-dates-all') return { ...due, lookbackDays: Number(u.searchParams.get('days') || 30) };
  if (p === '/api/non-sanmar-products') return { data: products };
}
module.exports = { fixed, serviceCodes, contract, posts, invites, requests, mailing, due, products, bundle, response };
