/**
 * Pricing Cards Component
 * Displays embellishment pricing options
 */

export class PricingCards {
    constructor(container) {
        this.container = container;
        this.styleNumber = null;
        this.colorCode = null;
        
        // Pricing options configuration
        this.pricingOptions = [
            {
                id: 'embroidery',
                name: 'Embroidery',
                icon: '🧵',
                path: '/pricing/embroidery',
                description: 'Traditional thread embroidery'
            },
            {
                id: 'cap-embroidery',
                name: 'Cap Embroidery',
                icon: '🧢',
                path: '/pricing/cap-embroidery',
                description: 'Specialized cap embroidery'
            },
            {
                id: 'dtg',
                name: 'DTG Printing',
                icon: '👕',
                path: '/pricing/dtg',
                description: 'Direct to garment printing'
            },
            {
                id: 'screen-print',
                name: 'Screen Printing',
                icon: '🖨️',
                path: '/pricing/screen-print',
                description: 'Traditional screen printing'
            },
            {
                id: 'dtf',
                name: 'DTF Transfer',
                icon: '🎨',
                path: '/pricing/dtf',
                description: 'Direct to film transfer'
            }
        ];
    }

    update(styleNumber, colorCode) {
        this.styleNumber = styleNumber;
        this.colorCode = colorCode;
        this.render();
    }

    render() {
        const cardsHtml = this.pricingOptions.map(option => 
            this.createCardHtml(option)
        ).join('');

        this.container.innerHTML = cardsHtml;

        // Add hover effects
        this.container.querySelectorAll('.pricing-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-5px)';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
            });
        });
    }

    createCardHtml(option) {
        const isReady = this.styleNumber && this.colorCode;
        const href = isReady 
            ? `${option.path}?StyleNumber=${encodeURIComponent(this.styleNumber)}&COLOR=${encodeURIComponent(this.colorCode)}`
            : '#';

        return `
            <a href="${href}" 
               class="pricing-card ${!isReady ? 'disabled' : ''}"
               ${!isReady ? 'onclick="return false;"' : ''}>
                <div class="pricing-icon">${option.icon}</div>
                <h4>${option.name}</h4>
                <p class="pricing-description">${option.description}</p>
                ${!isReady ? '<p class="disabled-note">Select a product first</p>' : ''}
            </a>
        `;
    }
}