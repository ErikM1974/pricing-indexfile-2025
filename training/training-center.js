/**
 * training-center.js — controller for training/index.html (Training Center)
 *
 * Renders the curated role tracks (static below) and a LIVE list of every
 * Policies Hub policy in the Training category (public proxy API) — so new
 * training modules published in the hub appear here automatically, no deploy.
 */
(function () {
    'use strict';

    var HUB = function (id) {
        return '/pages/policy-detail.html?id=' + encodeURIComponent(id);
    };

    // Curated role tracks. type 'hub' renders the HUB chip.
    var TRACKS = [
        {
            icon: 'fa-seedling',
            title: 'New Employee Orientation',
            desc: 'Start here in your first week.',
            items: [
                { t: 'Employee Onboarding Procedure', h: HUB('onboarding-procedure'), hub: true },
                { t: 'Employee Handbook (22 chapters)', h: HUB('employee-handbook'), hub: true },
                { t: 'Get to Know Erik', h: '/training/get-to-know-erik.html' },
                {
                    t: 'Our Culture, Core Values & Vision',
                    h: HUB('operating-principles-core-values-vision-2026'),
                    hub: true,
                },
                { t: 'Organizational Chart (2026)', h: HUB('org-chart-2026'), hub: true },
                { t: 'NWCA Language Reference', h: '/training/nwca-language-reference.html' },
            ],
        },
        {
            icon: 'fa-headset',
            title: 'CSR / Front Desk',
            desc: 'Phones, ShopWorks basics, customer care.',
            items: [
                { t: 'CSR 90-Day Onboarding Checklist', h: HUB('csr-90-day-onboarding'), hub: true },
                { t: 'Customer Service Manual', h: '/training/customer-service.html' },
                { t: 'Phone Answering & Call Handling', h: HUB('phone-procedures'), hub: true },
                { t: 'ShopWorks Data Entry Guide', h: '/pages/data-entry-guide.html' },
                { t: 'ShopWorks Customer Setup', h: '/training/shopworks-customer-setup.html' },
                { t: 'Customer Categorization', h: '/training/customer-categorization-training.html' },
                { t: 'Sales Tax Code Trainer', h: '/training/sales-tax-code-trainer.html' },
            ],
        },
        {
            icon: 'fa-briefcase',
            title: 'Sales / Account Executives',
            desc: 'From first product question to closed order.',
            items: [
                { t: 'AE Sales Foundations', h: HUB('ae-sales-foundations'), hub: true },
                { t: 'Sales Coordinator Manual', h: '/training/sales-coordinator-manual.html' },
                { t: 'Lead Follow-Up Guide', h: '/training/lead-follow-up-guide.html' },
                { t: 'Lead Email Templates', h: '/training/lead-email-templates.html' },
                { t: 'Lead Source Training', h: '/training/lead-source-training.html' },
                { t: 'Cap Training', h: '/training/cap-training.html' },
                { t: 'ShopWorks: Embroidery Order Type', h: '/training/shopworks-embroidery-order-type.html' },
                { t: 'ShopWorks Notes', h: '/training/shopworks-notes.html' },
            ],
        },
        {
            icon: 'fa-shirt',
            title: 'Production / Embroidery / DTG',
            desc: 'Quality, machine operation, daily ops.',
            items: [
                { t: 'Embroidery Quality Basics', h: HUB('embroidery-quality-basics'), hub: true },
                { t: 'Operator 90-Day Training', h: HUB('operator-90-day-training'), hub: true },
                { t: 'Embroidery Production Daily Operations', h: HUB('embroidery-production-daily-ops'), hub: true },
                { t: 'DTG Production Daily Operations', h: HUB('dtg-production-daily-ops'), hub: true },
                { t: 'Training Video Library', h: HUB('training-video-library'), hub: true },
            ],
        },
        {
            icon: 'fa-truck-fast',
            title: 'Shipping / Receiving / Purchasing',
            desc: 'Goods in, goods out, POs.',
            items: [
                { t: 'Shipping & Receiving Guide', h: '/training/shipping-receiving-guide.html' },
                { t: 'SanMar Purchasing Guide', h: '/training/sanmar-purchasing-guide.html' },
                { t: 'Shipping & Receiving Handbook', h: HUB('shipping-receiving-handbook'), hub: true },
            ],
        },
        {
            icon: 'fa-clipboard-list',
            title: 'Office Assistant',
            desc: 'Sales-support playbook and daily how-tos.',
            items: [
                { t: 'Office Assistant Role & Daily Operations', h: HUB('office-assistant-role'), hub: true },
                { t: 'Thank You Card Guide', h: '/training/thank-you-card-guide.html' },
                { t: 'Google Review Guide', h: '/training/google-review-guide.html' },
                { t: 'Lead Sheet Guide', h: '/training/lead-sheet-guide.html' },
                { t: 'Art Approval Guide', h: '/training/art-approval-guide.html' },
                { t: 'Bonus & Incentives Policy', h: HUB('bonus-and-incentives'), hub: true },
            ],
        },
        {
            icon: 'fa-gamepad',
            title: 'Games & Quick Reference',
            desc: 'Learn by playing; refresh in 5 minutes.',
            items: [
                { t: 'Training Games Hub', h: '/training/training-games-hub.html' },
                { t: 'Quick Hitter Tips Archive', h: '/training/quick-reference-tips.html' },
                { t: 'Team Match Game', h: '/training/team-match-game.html' },
                { t: 'ShopWorks Sales Tax Training', h: '/training/shopworks-sales-tax-training.html' },
            ],
        },
    ];

    document.addEventListener('DOMContentLoaded', function () {
        renderTracks();
        refreshHubTraining();
        document.getElementById('tc-retry').addEventListener('click', refreshHubTraining);
        document
            .querySelector('.dash-error-banner-close')
            .addEventListener('click', () => (document.querySelector('.dash-error-banner').hidden = true));
    });
    async function refreshHubTraining() {
        const retry = document.getElementById('tc-retry'),
            list = document.getElementById('tc-hub-list'),
            banner = document.querySelector('.dash-error-banner');
        retry.disabled = true;
        banner.hidden = true;
        list.setAttribute('aria-busy', 'true');
        list.innerHTML = '<li>Loading…</li>';
        try {
            await loadHubTraining();
            retry.hidden = true;
        } catch {
            list.innerHTML = '<li>Live training modules are unavailable. The role tracks above are ready to use.</li>';
            banner.querySelector('.dash-error-banner-message').textContent =
                'Unable to load the live hub training list. Retry when your connection is ready.';
            banner.hidden = false;
            retry.hidden = false;
        } finally {
            retry.disabled = false;
            list.setAttribute('aria-busy', 'false');
        }
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderTracks() {
        // All hub titles/summaries and curated destinations are escaped; IDs are URL encoded.
        // eslint-disable-next-line no-unsanitized/property
        document.getElementById('tc-grid').innerHTML = TRACKS.map(function (tr) {
            var lis = tr.items
                .map(function (it) {
                    var chip = it.hub ? ' <span class="tc-chip tc-chip--hub">HUB</span>' : '';
                    return '<li><a href="' + esc(it.h) + '">' + esc(it.t) + chip + '</a></li>';
                })
                .join('');
            return (
                '<section class="tc-track"><h2><i class="fas ' +
                tr.icon +
                '" aria-hidden="true"></i> ' +
                esc(tr.title) +
                '</h2><p class="tc-desc">' +
                esc(tr.desc) +
                '</p><ul>' +
                lis +
                '</ul></section>'
            );
        }).join('');
    }

    async function loadHubTraining() {
        // Public hub reads live on the proxy (no auth needed for Published policies).
        var base =
            (typeof window !== 'undefined' &&
                window.APP_CONFIG &&
                window.APP_CONFIG.API &&
                window.APP_CONFIG.API.BASE_URL) ||
            '';
        if (!base) throw new Error('APP_CONFIG.API.BASE_URL missing — the proxy host is not configured');
        var resp = await fetch(base + '/api/policies-public/?category=Training', { cache: 'no-store' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var data = await resp.json();
        if (
            !data ||
            !Array.isArray(data.policies) ||
            !data.policies.every(
                (p) =>
                    p &&
                    typeof p === 'object' &&
                    typeof p.Title === 'string' &&
                    typeof p.Status === 'string' &&
                    (typeof p.Policy_ID === 'string' || typeof p.Policy_ID === 'number'),
            )
        )
            throw new Error('Invalid training modules response');
        var pols = data.policies.filter(function (p) {
            return p.Status === 'Published';
        });
        pols.sort(function (a, b) {
            return String(a.Title).localeCompare(String(b.Title));
        });
        var el = document.getElementById('tc-hub-list');
        el.classList.remove('dash-loading');
        // All hub titles/summaries and curated destinations are escaped; IDs are URL encoded.
        // eslint-disable-next-line no-unsanitized/property
        el.innerHTML = pols.length
            ? pols
                  .map(function (p) {
                      return (
                          '<li><a href="/pages/policy-detail.html?id=' +
                          encodeURIComponent(p.Policy_ID) +
                          '">' +
                          esc(p.Title) +
                          '<span class="tc-sub">' +
                          esc((p.Summary || '').slice(0, 110)) +
                          '</span></a></li>'
                      );
                  })
                  .join('')
            : '<li>No hub training modules published yet.</li>';
    }
})();
