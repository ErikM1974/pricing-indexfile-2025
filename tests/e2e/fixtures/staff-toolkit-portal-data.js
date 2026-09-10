const data = require('./staff-toolkit-data');
const ledger = {
    balance: 125.5,
    entries: [
        { amount: 150, type: 'grant', reason: 'Synthetic earned rewards', orderRef: '99901', by: 'Review Staff', created: '2026-09-08T18:00:00Z' },
        { amount: -24.5, type: 'redeem', reason: 'Synthetic redemption', orderRef: '99902', by: 'Review Staff', created: '2026-09-09T18:00:00Z' }
    ]
};
const accrual = {
    partial: false,
    window: { from: '2026-08-01', to: '2026-08-31' },
    program: { configured: true, name: 'Synthetic review program', months: 1, spend: { from: '2026-09-01', to: '2026-09-08' }, tiers: [{ label: 'Review band', ratePct: 3 }], boosts: [] },
    totals: { earned: 75, eligibleRevenue: 2500, granted: 55, pending: 25, redeemedOnOrders: 10, redeemPending: 10, overGranted: 5, ledgerBalance: 125.5 },
    orders: [
        { orderNumber: '99901', designName: 'Synthetic Cedar artwork', invoiceDate: '2026-08-14', eligibleRevenue: 1500, reward: 50, granted: 25, pending: 25, overGranted: 0, lines: [{ style: 'REVIEW-TEE', color: 'Navy', qty: 50, unitPrice: 30, cost: 5.25, tier: 'Review band', ratePct: 3, reward: 50 }] },
        { orderNumber: '99902', designName: 'Synthetic Harbor artwork', invoiceDate: '2026-08-21', eligibleRevenue: 1000, reward: 25, granted: 30, pending: 0, overGranted: 5, redemption: { onOrder: 10, pending: 10 }, lines: [{ style: 'REVIEW-CAP', color: 'Black', qty: 50, unitPrice: 20, cost: 6.25, tier: 'Review band', ratePct: 3, reward: 25 }] }
    ],
    unavailable: [], excludedWebstore: { count: 1, revenue: 400 }, source: { mirrored: 2, manageOrders: 0 }
};
function state() {
    return {
        respond: async u => {
            if (u.pathname === '/api/crm-proxy/company-contacts/search') return { json: { contacts: [{ id_Customer: 98104, CustomerCompanyName: 'Synthetic Maple Team', ContactNumbersEmail: 'maple@example.test', NameFirst: 'Avery', NameLast: 'Example', Account_Owner: 'Review Staff' }] } };
            if (u.pathname.startsWith('/api/crm-proxy/customer-rewards/ledger/')) return { json: structuredClone(ledger) };
            if (u.pathname.startsWith('/api/portal-admin/rewards/accrual/')) return { json: structuredClone(accrual) };
        },
        respondWrite: async req => {
            const p = new URL(req.url()).pathname;
            if (p === '/api/portal-admin/rewards/entry') return { json: { balance: 150.5 } };
            if (p.endsWith('/post')) return { json: { posted: [{ orderNumber: '99901' }], total: 25, redeemed: [{ orderNumber: '99902' }], redeemTotal: 10, failed: [] } };
            if (p.endsWith('/reverse')) return { json: { reversed: 5, overGranted: 5, balance: 120.5 } };
            if (p.startsWith('/api/portal-admin/rewards/expire/')) return { json: { expired: 125.5, balance: 0 } };
            if (p === '/api/portal-admin/send-link' || p.startsWith('/api/crm-proxy/customer-portal-access') || p.startsWith('/api/crm-proxy/portal-reorder/requests')) return { json: { success: true } };
            throw new Error('Unmapped synthetic portal write: ' + p);
        }
    };
}
module.exports = { ledger, accrual, state, invites: data.invites };
