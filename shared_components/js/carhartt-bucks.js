/* Showroom campaign dates are Pacific time. This is an offer, not a checkout code. */
(() => {
    'use strict';
    const visitEnd = Date.parse('2026-10-01T00:00:00-07:00');
    const orderEnd = Date.parse('2026-10-16T00:00:00-07:00');
    const customerLink = 'https://www.teamnwca.com/carhartt-bucks';
    const invitation = 'Let\'s plan your team\'s holiday gifts! Visit Northwest Custom Apparel\'s Milton showroom by September 30, 2026, then place a qualifying Carhartt order of $1,000 or more by October 15, 2026, and receive $100 credit toward that order. Appointments are preferred; walk-ins are welcome Monday-Friday, 9 a.m.-5 p.m. Find us at 2025 Freeman Road East, Milton, WA 98354. Call 253-922-5793 to plan your visit. One certificate per company. Cannot be combined with other offers. Details: ' + customerLink;
    const redemption = 'Already visited our showroom by September 30, 2026? Place your qualifying Carhartt order of $1,000 or more by October 15, 2026, to redeem your $100 Carhartt Bucks credit. Contact your rep at 253-922-5793. One certificate per company. Cannot be combined with other offers. Details: ' + customerLink;
    const note = 'Carhartt Bucks 2026\nCompany: \nContact: \nSales rep: \nShowroom visit date: \nCertificate issued (yes/no): \nCertificate reference: NWCA1977\nQualifying order number: \nCarhartt order amount: \nOrder placed date: \n$100 credit applied (yes/no): \nFollow-up date: ';
    function phase(now = Date.now()) {
        return now < visitEnd ? 'visit' : now < orderEnd ? 'redeem' : 'expired';
    }
    function refresh() {
        const current = phase();
        document.querySelectorAll('[data-cb-phase]').forEach(el => {
            el.hidden = !el.dataset.cbPhase.split(' ').includes(current);
        });
        document.querySelectorAll('[data-cb-title]').forEach(el => {
            el.textContent = current === 'visit' ? 'Visit our showroom. Get $100 Carhartt Bucks.' : current === 'redeem' ? 'Visited by September 30? Redeem your Carhartt Bucks.' : 'The 2026 Carhartt Bucks offer has ended.';
        });
        document.querySelectorAll('[data-cb-status]').forEach(el => {
            el.textContent = current === 'visit' ? 'Visit by September 30. Order by October 15, 2026.' : current === 'redeem' ? 'New showroom visits no longer qualify. Eligible customers can redeem through October 15, 2026.' : 'Both deadlines have passed. Contact your rep for current Carhartt options.';
        });
        document.querySelectorAll('[data-cb-invitation]').forEach(el => {
            el.value = current === 'visit' ? invitation : current === 'redeem' ? redemption : 'The 2026 Carhartt Bucks offer ended October 15, 2026. Contact your rep for current Carhartt options: ' + customerLink;
        });
        document.querySelectorAll('[data-cb-note]').forEach(el => { el.value = note; });
    }
    document.addEventListener('click', async event => {
        const button = event.target.closest('[data-cb-copy]');
        if (!button) return;
        refresh();
        const area = button.closest('[data-cb-tools]');
        const status = area.querySelector('[data-cb-copy-status]');
        const kind = button.dataset.cbCopy;
        const field = area.querySelector(kind === 'note' ? '[data-cb-note]' : '[data-cb-invitation]');
        const value = kind === 'link' ? customerLink : kind === 'note' ? note : field.value;
        try {
            await navigator.clipboard.writeText(value);
            status.textContent = kind === 'link' ? 'Customer link copied.' : kind === 'note' ? 'Visit note copied. Paste it into the customer account and fill in the details.' : 'Invitation copied. Personalize it before sharing.';
        } catch {
            if (kind !== 'link' && field) { field.focus(); field.select(); }
            status.textContent = kind === 'link' ? 'Copy was blocked. Select and copy this link: ' + customerLink : 'Copy was blocked. The text is selected; copy it manually.';
        }
    });
    refresh();
    document.addEventListener('visibilitychange', refresh);
    window.setInterval(refresh, 60000);
})();
