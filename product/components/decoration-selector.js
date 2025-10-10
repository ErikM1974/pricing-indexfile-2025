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
                feature: { icon: 'fas fa-star', text: 'Premium quality', color: '#ffa500' },
                path: '/pricing/embroidery',
                cta: 'View Embroidery Pricing'
            },
            'cap-embroidery': {
                icon: '🧢',
                name: 'Cap Embroidery',
                label: 'Cap\nEmbroidery',
                tagline: 'Specialized embroidery for headwear',
                feature: { icon: 'fas fa-hat-cowboy', text: '3D puff available', color: '#2f661e' },
                path: '/pricing/cap-embroidery',
                cta: 'View Cap Pricing'
            },
            'dtg': {
                icon: '👕',
                name: 'DTG',
                label: 'DTG',
                tagline: 'Full-color printing for complex designs',
                feature: { icon: 'fas fa-palette', text: 'Unlimited colors', color: '#e91e63' },
                path: '/pricing/dtg',
                cta: 'View DTG Pricing'
            },
            'screen-print': {
                icon: '🖨️',
                name: 'Screen Print',
                label: 'Screen\nPrint',
                tagline: 'Classic printing for bold graphics',
                feature: { icon: 'fas fa-dollar-sign', text: 'Great for bulk', color: '#4caf50' },
                path: '/pricing/screen-print',
                cta: 'View Screen Print Pricing'
            },
            'dtf': {
                icon: '🎨',
                name: 'DTF',
                label: 'DTF',
                tagline: 'Versatile heat transfer for any fabric',
                feature: { icon: 'fas fa-tshirt', text: 'Works on all fabrics', color: '#2196f3' },
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
            <h3>How would you like to customize this?</h3>

            <div class="decoration-methods-grid">
                ${Object.entries(this.methods).map(([key, method]) => `
                    <button class="method-card ${key === this.selectedMethod ? 'active' : ''}"
                            data-method="${key}">
                        <span class="method-icon">${method.icon}</span>
                        <span class="method-name">${method.name}</span>
                        <span class="method-feature" style="color: ${method.feature.color};">
                            <i class="${method.feature.icon}"></i>
                            ${method.feature.text}
                        </span>
                    </button>
                `).join('')}
            </div>

            <div class="method-content" id="method-content">
                ${this.renderMethodContent(this.methods[this.selectedMethod])}
            </div>
        `;

        // Add event listeners
        this.container.querySelectorAll('.method-card').forEach(button => {
            button.addEventListener('click', (e) => {
                const method = e.currentTarget.dataset.method;
                this.selectMethod(method);
            });
        });

        // Add CTA button listener
        const ctaButton = this.container.querySelector('.cta-button');
        if (ctaButton) {
            ctaButton.addEventListener('click', () => {
                this.navigateToPricing();
            });
        }
    }

    renderMethodContent(method) {
        return `
            <div class="method-info">
                <h4 class="method-title">${method.name}</h4>
                <p class="method-tagline">${method.tagline}</p>
            </div>
            <div class="method-details">
                <div class="detail-item">
                    <i class="${method.feature.icon}" style="color: ${method.feature.color};"></i>
                    <span>${method.feature.text}</span>
                </div>
            </div>
            <button class="cta-button">
                ${method.cta}
                <i class="fas fa-arrow-right"></i>
            </button>
        `;
    }

    selectMethod(methodKey) {
        this.selectedMethod = methodKey;

        // Update active state
        this.container.querySelectorAll('.method-card').forEach(button => {
            button.classList.toggle('active', button.dataset.method === methodKey);
        });

        // Update content
        const method = this.methods[methodKey];
        const contentEl = this.container.querySelector('#method-content');
        if (contentEl) {
            contentEl.innerHTML = this.renderMethodContent(method);

            // Re-add CTA listener
            const ctaButton = contentEl.querySelector('.cta-button');
            if (ctaButton) {
                ctaButton.addEventListener('click', () => {
                    this.navigateToPricing();
                });
            }
        }
    }

    navigateToPricing() {
        const method = this.methods[this.selectedMethod];
        const url = `${method.path}?StyleNumber=${encodeURIComponent(this.styleNumber)}&COLOR=${encodeURIComponent(this.colorCode)}`;
        window.location.href = url;
    }
}