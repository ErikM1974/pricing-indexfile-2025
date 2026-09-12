/**
 * Safety Stripe Creator JavaScript
 * Handles safety stripe design selection and email functionality
 */

// Image mapping with all Box.com URLs
const STRIPE_IMAGES = {
    Standard: {
        front: {
            JustStripes: 'https://northwestcustomapparel.box.com/shared/static/l5pnj4hhvrfgtzs0lae32c4zefz8feib',
            LeftChestLogo: 'https://northwestcustomapparel.box.com/shared/static/lvqvm0ucwz8zm2yvi4d4qbr3wayozmi0',
            FrontCenterLogo: 'https://northwestcustomapparel.box.com/shared/static/sl7bn6qpiqhotdpuoetcgbtg8256upq7',
            BuiltInImage: 'https://northwestcustomapparel.box.com/shared/static/hvwtwqsvh7yivu0kih95y1jxqo7ntgyz'
        },
        back: {
            JustStripes: 'https://northwestcustomapparel.box.com/shared/static/iv55adzxyl135c8qyw513v25sogquqzm',
            BackCenterLogo: 'https://northwestcustomapparel.box.com/shared/static/g5j4tv6o583m0c8dr5w39kp8b8ixbcqj',
            BackBetweenLinesText: 'https://northwestcustomapparel.box.com/shared/static/27llevl5yg0wksit2kvm4l0wyd9o74uo',
            BackBuiltInImage: 'https://northwestcustomapparel.box.com/shared/static/z48kfyvvhsmy5yz9pu2pmewzo13kwrct'
        }
    },
    ConstructionZone: {
        front: {
            JustStripes: 'https://northwestcustomapparel.box.com/shared/static/6r1rp6x7q6nifuw6whtwdhqbl2g8je27',
            LeftChestLogo: 'https://northwestcustomapparel.box.com/shared/static/aw40v2m8adw1l03anqqut9vlz5u6auo5',
            FrontCenterLogo: 'https://northwestcustomapparel.box.com/shared/static/rulbnpjt19jewoh482c33wosw9aciuc9',
            BuiltInImage: 'https://northwestcustomapparel.box.com/shared/static/4q39xizfwnl9cuwv93i5fnl1nqeh624d'
        },
        back: {
            JustStripes: 'https://northwestcustomapparel.box.com/shared/static/sfwsfi8h4k4o0mxx7mx5s873w912scff',
            BackCenterLogo: 'https://northwestcustomapparel.box.com/shared/static/27llevl5yg0wksit2kvm4l0wyd9o74uo',
            BackBetweenLinesText: 'https://northwestcustomapparel.box.com/shared/static/gariv0oxdxu7oren2xd3kk2hl3g2jl31',
            BackBuiltInImage: 'https://northwestcustomapparel.box.com/shared/static/vuh2p7hb6n16yz8xqs8vyg8u9rhihr05'
        }
    },
    DiamondPlate: {
        front: {
            JustStripes: 'https://northwestcustomapparel.box.com/shared/static/6oa86o7o4lou6v0ablxrr32hxn1gxplw',
            LeftChestLogo: 'https://northwestcustomapparel.box.com/shared/static/kkxqv0vdv02tw4sxvj8jtq6igj2yov5f',
            FrontCenterLogo: 'https://northwestcustomapparel.box.com/shared/static/0npwfnjwyuew5wpv02gwrmshgqsf7v6k',
            BuiltInImage: 'https://northwestcustomapparel.box.com/shared/static/7atgrmzrcrbythr3sdw59tsju3lyutt1'
        },
        back: {
            JustStripes: 'https://northwestcustomapparel.box.com/shared/static/nqbu6jh0p79ms7x6nun8h7pn1nxbejj1',
            BackCenterLogo: 'https://northwestcustomapparel.box.com/shared/static/eabctv2qani98vrthvu6jnhsbw5lu0zc',
            BackBetweenLinesText: 'https://northwestcustomapparel.box.com/shared/static/m4cpxfaflguu20a51dvxgzfqxooh0qyr',
            BackBuiltInImage: 'https://northwestcustomapparel.box.com/shared/static/nqbu6jh0p79ms7x6nun8h7pn1nxbejj1'
        }
    },
    Warning: {
        front: {
            JustStripes: 'https://northwestcustomapparel.box.com/shared/static/tcmcme9ihfx15cu70rhycxdqgbceervl',
            LeftChestLogo: 'https://northwestcustomapparel.box.com/shared/static/5yvwfnq6xlazpmivqymzatzaapokywpx',
            FrontCenterLogo: 'https://northwestcustomapparel.box.com/shared/static/lpgbp3ymgkykrl2zdydfoie4rda8o0ti',
            BuiltInImage: 'https://northwestcustomapparel.box.com/shared/static/ako9y6ae6rr66eaedklwaf5wplqnqb7o'
        },
        back: {
            JustStripes: 'https://northwestcustomapparel.box.com/shared/static/ewqxx67q137t94touo856itlh7m2idlc',
            BackCenterLogo: 'https://northwestcustomapparel.box.com/shared/static/u8nsbnrkq614tanwbn8conmtdadw90eq',
            BackBetweenLinesText: 'https://northwestcustomapparel.box.com/shared/static/zqhsu8x1jj5iza03t8ltj0xhp0pgvbgu',
            BackBuiltInImage: 'https://northwestcustomapparel.box.com/shared/static/gdwmhv9bt3oe5izy4720bj5x8k0g2v02'
        }
    }
};

// Current design state
let currentDesign = {
    style: '',
    front: '',
    back: '',
    frontImage: '',
    backImage: ''
};

// The design save is the only delivery action on this page.

// Initialize quote service
const quoteService = new SafetyStripeQuoteService();

// Format option name for display
function formatOptionName(option) {
    return option.replace(/([A-Z])/g, ' $1').trim();
}

// Select stripe style
function selectStripeStyle(style) {
    if (savingDesign) return;
    // Update selection state
    document.querySelectorAll('.stripe-option').forEach(el => {
        el.classList.remove('selected');
        el.setAttribute('aria-pressed', 'false');
    });
    document.querySelector(`[data-style="${style}"]`).classList.add('selected');
    document.querySelector(`[data-style="${style}"]`).setAttribute('aria-pressed', 'true');
    
    // Update current design
    currentDesign.style = style;
    currentDesign.front = 'JustStripes';
    currentDesign.back = 'JustStripes';
    
    // Show design area
    document.getElementById('designArea').hidden = false;
    document.getElementById('actionSection').hidden = false;
    
    // Load options for this style
    loadOptions('front', style);
    loadOptions('back', style);
    
    // Scroll to design area
    document.getElementById('designArea').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

// Load placement options
function loadOptions(side, style) {
    const container = document.getElementById(`${side}Options`);
    const options = STRIPE_IMAGES[style][side];
    
    container.innerHTML = '';
    
    Object.entries(options).forEach(([option, imageUrl]) => {
        const optionEl = document.createElement('button');
        optionEl.type = 'button';
        optionEl.className = 'btn placement-option';
        optionEl.dataset.option = option;
        optionEl.onclick = () => selectOption(side, option);
        
        optionEl.innerHTML = `
            <img src="${imageUrl}" alt="${formatOptionName(option)}">
            <span>${formatOptionName(option)}</span>
        `;
        
        container.appendChild(optionEl);
    });
    
    // Select first option by default
    selectOption(side, 'JustStripes');
}

// Select placement option
function selectOption(side, option) {
    if (savingDesign) return;
    document.getElementById('stripePaperStatus').textContent = '';
    document.getElementById('stripeSaveStatus').textContent = '';
    document.getElementById('stripeSaveStatus').hidden = true;
    const container = document.getElementById(`${side}Options`);
    const preview = document.getElementById(`${side}Preview`);
    
    // Update selection state
    container.querySelectorAll('.placement-option').forEach(el => {
        el.classList.remove('selected');
        el.setAttribute('aria-pressed', 'false');
    });
    container.querySelector(`[data-option="${option}"]`).classList.add('selected');
    container.querySelector(`[data-option="${option}"]`).setAttribute('aria-pressed', 'true');
    
    // Update preview and state
    const imageUrl = STRIPE_IMAGES[currentDesign.style][side][option];
    preview.src = imageUrl;
    currentDesign[side] = option;
    currentDesign[`${side}Image`] = imageUrl;
}

let savingDesign = false;
let copyGeneration = 0;

// Dialogs retain drafts on cancel and own focus through the native browser lifecycle.
function openSendModal() {
    if (savingDesign || !currentDesign.style) return;
    document.getElementById('summaryStyle').textContent = currentDesign.style;
    document.getElementById('summaryFront').textContent = formatOptionName(currentDesign.front);
    document.getElementById('summaryBack').textContent = formatOptionName(currentDesign.back);
    const modal = document.getElementById('sendModal');
    if (!modal.open) modal.showModal();
}
function closeSendModal() {
    if (!savingDesign) document.getElementById('sendModal').close();
}
function showSaveFailure(message) {
    const status = document.getElementById('stripeSaveStatus');
    status.textContent = message;
    document.getElementById('stripePaperStatus').textContent = message;
    status.hidden = false;
}
function setSaving(saving) {
    savingDesign = saving;
    const form = document.getElementById('sendForm');
    form.setAttribute('aria-busy', String(saving));
    form.querySelectorAll('input, select, textarea, button').forEach(node => { node.disabled = saving; });
    document.getElementById('sendButton').textContent = saving ? 'Saving design…' : 'Save Design';
}
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('sendForm');
    const modal = document.getElementById('sendModal');
    modal.addEventListener('cancel', event => { if (savingDesign) event.preventDefault(); });
    for (const dialog of document.querySelectorAll('.stripe-dialog')) {
        dialog.addEventListener('keydown', event => {
            if (event.key !== 'Tab') return;
            const controls = [...dialog.querySelectorAll('button, input, select, textarea, a[href]')].filter(node => !node.disabled && node.getClientRects().length);
            const first = controls[0], last = controls.at(-1);
            if (controls.length && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            }
        });
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (savingDesign || !form.reportValidity()) return;
        const designData = {
            customerName: document.getElementById('customerName').value.trim(),
            customerEmail: document.getElementById('customerEmail').value.trim(),
            customerPhone: document.getElementById('customerPhone').value.trim(),
            companyName: document.getElementById('companyName').value.trim(),
            salesRepEmail: document.getElementById('salesRep').value,
            message: document.getElementById('customMessage').value.trim(),
            stripeStyle: currentDesign.style,
            frontOption: currentDesign.front,
            backOption: currentDesign.back,
            frontImage: currentDesign.frontImage,
            backImage: currentDesign.backImage
        };
        setSaving(true);
        document.getElementById('stripeSaveStatus').hidden = true;
        try {
            const result = await quoteService.saveDesign(designData);
            if (result.success) {
                form.reset();
                modal.close();
                showSuccess(result.quoteID);
            } else {
                const reference = result.sessionSaved ? ' Reference: ' + result.quoteID + '.' : '';
                showSaveFailure('Unable to save the complete design. Your information is still here. Try Save Design again or call (253) 922-5793.' + reference);
            }
        } catch (error) {
            console.error('Unable to save design:', error);
            showSaveFailure('Unable to save the design. Your information is still here. Please try again.');
        } finally {
            setSaving(false);
        }
    });
    function markUnavailable(img) {
        if (!(img instanceof HTMLImageElement) || !img.getAttribute('src')) return;
        img.hidden = true;
        img.dataset.previewUnavailable = 'true';
        if (!img.parentElement.querySelector('.stripe-image-placeholder')) {
            const placeholder = document.createElement('span');
            placeholder.className = 'stripe-image-placeholder';
            placeholder.textContent = img.closest('.shirt-preview') ? 'Preview unavailable' : 'Image unavailable';
            img.before(placeholder);
        }
        const warning = document.getElementById('stripeImageWarning');
        warning.textContent = 'A design preview could not load. Refresh the page to check the artwork before saving.';
        warning.hidden = false;
    }
    document.addEventListener('error', event => markUnavailable(event.target), true);
    document.addEventListener('load', event => {
        const img = event.target;
        if (!(img instanceof HTMLImageElement) || !img.dataset.previewUnavailable) return;
        img.hidden = false;
        delete img.dataset.previewUnavailable;
        img.parentElement.querySelector('.stripe-image-placeholder')?.remove();
        document.getElementById('stripeImageWarning').hidden = !document.querySelector('img[data-preview-unavailable]');
    }, true);
    document.querySelectorAll('img[src]').forEach(img => {
        if (img.getAttribute('src') && img.complete && !img.naturalWidth) markUnavailable(img);
    });
});
function showSuccess(quoteID) {
    copyGeneration++;
    document.getElementById('quoteIdDisplay').textContent = quoteID;
    document.getElementById('stripeCopyStatus').textContent = '';
    document.getElementById('stripePaperStatus').textContent = 'Design saved. Reference: ' + quoteID + '. No customer email has been sent.';
    document.getElementById('successModal').showModal();
}
function closeSuccessModal() {
    copyGeneration++;
    document.getElementById('successModal').close();
}
async function copyQuoteId() {
    const generation = ++copyGeneration;
    const quoteId = document.getElementById('quoteIdDisplay').textContent;
    const modal = document.getElementById('successModal');
    try {
        await navigator.clipboard.writeText(quoteId);
        if (generation === copyGeneration && modal.open) document.getElementById('stripeCopyStatus').textContent = 'Reference copied.';
    } catch (error) {
        if (generation === copyGeneration && modal.open) document.getElementById('stripeCopyStatus').textContent = 'Unable to copy. Select the reference number and copy it manually.';
    }
}
function startNewDesign() {
    if (savingDesign) return;
    currentDesign = {style: '', front: '', back: '', frontImage: '', backImage: ''};
    document.querySelectorAll('.stripe-option').forEach(node => {
        node.classList.remove('selected');
        node.setAttribute('aria-pressed', 'false');
    });
    document.getElementById('designArea').hidden = true;
    document.getElementById('actionSection').hidden = true;
    document.getElementById('sendForm').reset();
    document.getElementById('stripeSaveStatus').hidden = true;
    closeSuccessModal();
    document.getElementById('stripePaperStatus').textContent = '';
    document.querySelector('.stripe-option').focus();
    window.scrollTo({top: 0, behavior: 'instant'});
}
