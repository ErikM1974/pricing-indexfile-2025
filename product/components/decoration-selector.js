/**
 * Decoration Method Selector Component
 * Displays segmented control for choosing decoration methods
 */

export class DecorationSelector {
    constructor(container) {
        this.container = container;
        this.selectedMethod = 'embroidery';
        this.styleNumber = null;
        this.colorCode = null;
        
        // Decoration methods configuration
        this.methods = {
            'embroidery': {
                icon: '🧵',
                name: 'Embroidery',
                label: 'Embroidery',
                tagline: 'Professional thread embroidery for logos and text',
                feature: { icon: 'fas fa-award', text: 'Experts Since 1977', color: '#ffa500' },
                path: '/pricing/embroidery',
                cta: 'View Embroidery Pricing'
            },
            'cap-embroidery': {
                icon: '🧢',
                name: 'Cap Embroidery',
                label: 'Cap\nEmbroidery',
                tagline: 'Specialized embroidery for headwear',
                feature: { icon: 'fas fa-layer-group', text: 'Add up to 4 Designs', color: '#2f661e' },
                path: '/pricing/cap-embroidery',
                cta: 'View Cap Pricing'
            },
            'dtg': {
                icon: '👕',
                name: 'DTG',
                label: 'DTG',
                tagline: 'Full-color printing for complex designs',
                feature: { icon: 'fas fa-palette', text: 'Full Color on Cotton', color: '#e91e63' },
                path: '/pricing/dtg',
                cta: 'View DTG Pricing'
            },
            'screen-print': {
                icon: '🖨️',
                name: 'Screen Print',
                label: 'Screen\nPrint',
                tagline: 'Classic printing for bold graphics',
                feature: { icon: 'fas fa-dollar-sign', text: 'Bulk Pricing Available', color: '#4caf50' },
                path: '/pricing/screen-print',
                cta: 'View Screen Print Pricing'
            },
            'dtf': {
                icon: '🎨',
                name: 'DTF',
                label: 'DTF',
                tagline: 'Versatile heat transfer for any fabric',
                feature: { icon: 'fas fa-fill-drip', text: 'Colors Pop on Nylon', color: '#2196f3' },
                path: '/pricing/dtf',
                cta: 'View DTF Pricing'
            }
        };
    }

    update(styleNumber, colorCode) {
        this.styleNumber = styleNumber;
        this.colorCode = colorCode;
        this.render();
    }

    render() {
        if (!this.styleNumber || !this.colorCode) {
            this.container.classList.add('hidden');
            return;
        }

        this.container.classList.remove('hidden');

        this.container.innerHTML = `
            <div class="decoration-methods-grid">
                ${Object.entries(this.methods).map(([key, method]) => `
                    <button class="method-card"
                            data-method="${key}"
                            data-path="${method.path}"
                            title="Click to view ${method.name} pricing">
                        <span class="method-icon">${method.icon}</span>
                        <span class="method-name">${method.name}</span>
                        <span class="method-feature" style="color: ${method.feature.color};">
                            <i class="${method.feature.icon}"></i>
                            ${method.feature.text}
                        </span>
                    </button>
                `).join('')}
            </div>
        `;

        // Add direct navigation listeners
        this.container.querySelectorAll('.method-card').forEach(button => {
            button.addEventListener('click', (e) => {
                const method = e.currentTarget.dataset.method;
                this.navigateToMethod(method);
            });
        });
    }

    navigateToMethod(methodKey) {
        const method = this.methods[methodKey];

        // Optional: Add subtle loading state to the clicked card
        const clickedCard = this.container.querySelector(`[data-method="${methodKey}"]`);
        if (clickedCard) {
            clickedCard.style.opacity = '0.7';
            clickedCard.style.pointerEvents = 'none';
        }

        // Build URL with product context
        const url = `${method.path}?StyleNumber=${encodeURIComponent(this.styleNumber)}&COLOR=${encodeURIComponent(this.colorCode)}`;

        // Navigate directly
        window.location.href = url;
    }
}