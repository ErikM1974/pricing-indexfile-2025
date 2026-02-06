/**
 * Fundraiser Pricing Calculator
 * Calculates sell prices for webstore fundraiser programs
 * where a donation per item goes back to the customer's program.
 */

class FundraiserCalculator {
    constructor() {
        this.initElements();
        this.bindEvents();
        this.calculate();
    }

    initElements() {
        this.els = {
            blankCost: document.getElementById('fr-blankCost'),
            donation: document.getElementById('fr-donation'),
            margin: document.getElementById('fr-margin'),
            ccFee: document.getElementById('fr-ccFee'),
            embellishment: document.getElementById('fr-embellishment'),
            decoCost: document.getElementById('fr-decoCost'),
            // Display cards
            dispEmb: document.getElementById('fr-dispEmb'),
            dispDeco: document.getElementById('fr-dispDeco'),
            dispMargin: document.getElementById('fr-dispMargin'),
            dispCC: document.getElementById('fr-dispCC'),
            // Result
            sellPrice: document.getElementById('fr-sellPrice'),
            resultNote: document.getElementById('fr-resultNote'),
            breakdown: document.getElementById('fr-breakdown'),
            brkMargin: document.getElementById('fr-brkMargin'),
            brkEmb: document.getElementById('fr-brkEmb'),
            brkDonation: document.getElementById('fr-brkDonation'),
            brkCC: document.getElementById('fr-brkCC'),
            brkRound: document.getElementById('fr-brkRound'),
            brkProfit: document.getElementById('fr-brkProfit'),
            profitRow: document.getElementById('fr-profitRow'),
            // Customer message
            cmDonation: document.getElementById('fr-cmDonation'),
            // Advanced section
            advSection: document.getElementById('fr-advSection'),
            advArrow: document.getElementById('fr-advArrow'),
            advToggle: document.getElementById('fr-advToggle')
        };
    }

    bindEvents() {
        // All inputs trigger recalculation
        const inputs = [
            this.els.blankCost, this.els.donation, this.els.margin,
            this.els.ccFee, this.els.embellishment, this.els.decoCost
        ];
        inputs.forEach(input => {
            if (input) input.addEventListener('input', () => this.calculate());
        });

        // Advanced toggle
        if (this.els.advToggle) {
            this.els.advToggle.addEventListener('click', () => this.toggleAdvanced());
        }
    }

    toggleAdvanced() {
        this.els.advSection.classList.toggle('show');
        this.els.advToggle.classList.toggle('open');
    }

    calculate() {
        const blankCost = parseFloat(this.els.blankCost.value) || 0;
        const donation = parseFloat(this.els.donation.value) || 0;
        const margin = (parseFloat(this.els.margin.value) || 43) / 100;
        const ccFee = (parseFloat(this.els.ccFee.value) || 3.5) / 100;
        const embellishment = parseFloat(this.els.embellishment.value) || 15;
        const decoCost = parseFloat(this.els.decoCost.value) || 8;

        // Update fixed-cost display cards
        this.els.dispEmb.textContent = '$' + embellishment.toFixed(2);
        this.els.dispDeco.textContent = '$' + decoCost.toFixed(2);
        this.els.dispMargin.textContent = (margin * 100).toFixed(0) + '%';
        this.els.dispCC.textContent = (ccFee * 100).toFixed(1) + '%';

        // Update customer message donation amount
        this.els.cmDonation.textContent = '$' + donation.toFixed(0);

        if (blankCost <= 0) {
            this.els.sellPrice.textContent = 'Enter blank cost';
            this.els.sellPrice.className = 'fr-result-price empty';
            this.els.resultNote.textContent = '';
            this.els.breakdown.style.display = 'none';
            return;
        }

        // FORMULA: (blank / (1 - margin) + embellishment + donation) / (1 - ccFee)
        const blankWithMargin = blankCost / (1 - margin);
        const subtotal = blankWithMargin + embellishment + donation;
        const withCC = subtotal / (1 - ccFee);

        // Round UP to nearest $5
        const sellPrice = Math.ceil(withCC / 5) * 5;

        // Calculate actual profit
        const actualCCfee = sellPrice * ccFee;
        const profit = sellPrice - blankCost - decoCost - actualCCfee - donation;

        // Display sell price
        this.els.sellPrice.textContent = '$' + sellPrice.toFixed(0);
        this.els.sellPrice.className = 'fr-result-price';
        this.els.resultNote.textContent = 'Rounded up to nearest $5 for margin cushion';

        // Show breakdown
        this.els.breakdown.style.display = 'block';
        this.els.brkMargin.textContent = '$' + blankWithMargin.toFixed(2);
        this.els.brkEmb.textContent = '$' + embellishment.toFixed(2);
        this.els.brkDonation.textContent = '$' + donation.toFixed(2);
        this.els.brkCC.textContent = '$' + (withCC - subtotal).toFixed(2);
        this.els.brkRound.textContent = '$' + (sellPrice - withCC).toFixed(2);
        this.els.brkProfit.textContent = '$' + profit.toFixed(2);

        if (profit < 5) {
            this.els.profitRow.className = 'fr-breakdown-row fr-total negative';
        } else {
            this.els.profitRow.className = 'fr-breakdown-row fr-total';
        }
    }
}

// Tab switching logic
function initWebstoreTabs() {
    const tabs = document.querySelectorAll('.ws-tab');
    const panels = document.querySelectorAll('.ws-tab-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update active panel
            panels.forEach(p => p.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initWebstoreTabs();
    window.fundraiserCalculator = new FundraiserCalculator();
});
