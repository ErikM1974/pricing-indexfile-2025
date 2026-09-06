/* decoration-selector-mockup-page.js — extracted 2026-09-06 from an inline <script> in tools/decoration-selector-mockup.html (Rule 3). Global scope kept: the page's data-call attributes resolve these functions on window. */
// Method data
const methodData = {
    embroidery: {
        icon: '🧵',
        title: 'Embroidery',
        tagline: 'Professional thread embroidery for a premium, lasting finish',
        bestFor: [
            'Company logos',
            'Monograms & names',
            'Polos & dress shirts',
            'Uniforms & workwear'
        ],
        features: [
            '3D dimensional look',
            'Extremely durable',
            'Professional appearance',
            "Won't fade or peel"
        ],
        durability: 5,
        turnaround: '7-10 days',
        cta: 'Configure Embroidery'
    },
    screenprint: {
        icon: '🖨️',
        title: 'Screen Printing',
        tagline: 'Classic printing method for bold, vibrant designs',
        bestFor: [
            'T-shirt designs',
            'Large quantities',
            'Simple graphics',
            'Team uniforms'
        ],
        features: [
            'Vibrant colors',
            'Cost-effective for bulk',
            'Smooth finish',
            'Great color opacity'
        ],
        durability: 4,
        turnaround: '5-7 days',
        cta: 'Configure Screen Print'
    },
    dtg: {
        icon: '👕',
        title: 'DTG Printing',
        tagline: 'Direct to Garment printing for detailed, full-color designs',
        bestFor: [
            'Photographic images',
            'Complex artwork',
            'Small quantities',
            'Gradient designs'
        ],
        features: [
            'Unlimited colors',
            'No setup fees',
            'Soft hand feel',
            'Fine detail capability'
        ],
        durability: 3,
        turnaround: '3-5 days',
        cta: 'Configure DTG Print'
    },
    dtf: {
        icon: '🎨',
        title: 'DTF Transfer',
        tagline: 'Versatile heat transfer for vibrant designs on any fabric',
        bestFor: [
            'Detailed designs',
            'Mixed fabric types',
            'Small text & logos',
            'Athletic wear'
        ],
        features: [
            'Works on any fabric',
            'Stretchable prints',
            'Vibrant colors',
            'Sharp details'
        ],
        durability: 4,
        turnaround: '5-7 days',
        cta: 'Configure DTF Transfer'
    },
    cap: {
        icon: '🧢',
        title: 'Cap Embroidery',
        tagline: 'Specialized embroidery designed specifically for headwear',
        bestFor: [
            'Baseball caps',
            'Beanies',
            'Visors',
            'Trucker hats'
        ],
        features: [
            '3D puff embroidery',
            'Curved surface expertise',
            'Front, side & back options',
            'Professional finish'
        ],
        durability: 5,
        turnaround: '7-10 days',
        cta: 'Configure Cap Design'
    }
};

function selectMethod(element, methodKey) {
    // Update active state
    document.querySelectorAll('.segment').forEach(seg => seg.classList.remove('active'));
    element.classList.add('active');

    // Get method data
    const method = methodData[methodKey];

    // Generate stars
    const stars = Array(5).fill('★').map((star, i) => 
        `<span class="star${i >= method.durability ? ' empty' : ''}">${star}</span>`
    ).join('');

    // Update content
    document.getElementById('method-content').innerHTML = `
        <div class="method-header">
            <div class="method-icon-large">${method.icon}</div>
            <div class="method-info">
                <h4>${method.title}</h4>
                <div class="method-tagline">${method.tagline}</div>
            </div>
        </div>

        <div class="method-details">
            <div class="detail-block">
                <h5>Best For:</h5>
                <ul>
                    ${method.bestFor.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
            <div class="detail-block">
                <h5>Key Features:</h5>
                <ul>
                    ${method.features.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; font-size: 14px;">
            <div>
                <strong>Durability:</strong>
                <div class="rating">${stars}</div>
            </div>
            <div>
                <strong>Typical Turnaround:</strong> ${method.turnaround}
            </div>
        </div>

        <button class="cta-button">
            ${method.cta}
            <span>→</span>
        </button>
    `;
}
