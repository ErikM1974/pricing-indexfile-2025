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

// Initialize EmailJS
emailjs.init('4qSbDO-SQs19TbP80');

// Initialize quote service
const quoteService = new SafetyStripeQuoteService();

// Format option name for display
function formatOptionName(option) {
    return option.replace(/([A-Z])/g, ' $1').trim();
}

// Select stripe style
function selectStripeStyle(style) {
    // Update selection state
    document.querySelectorAll('.stripe-option').forEach(el => {
        el.classList.remove('selected');
    });
    document.querySelector(`[data-style="${style}"]`).classList.add('selected');
    
    // Update current design
    currentDesign.style = style;
    currentDesign.front = 'JustStripes';
    currentDesign.back = 'JustStripes';
    
    // Show design area
    document.getElementById('designArea').style.display = 'grid';
    document.getElementById('actionSection').style.display = 'block';
    
    // Load options for this style
    loadOptions('front', style);
    loadOptions('back', style);
    
    // Scroll to design area
    document.getElementById('designArea').scrollIntoView({ behavior: 'smooth' });
}

// Load placement options
function loadOptions(side, style) {
    const container = document.getElementById(`${side}Options`);
    const preview = document.getElementById(`${side}Preview`);
    const options = STRIPE_IMAGES[style][side];
    
    container.innerHTML = '';
    
    Object.entries(options).forEach(([option, imageUrl]) => {
        const optionEl = document.createElement('div');
        optionEl.className = 'placement-option';
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
    const container = document.getElementById(`${side}Options`);
    const preview = document.getElementById(`${side}Preview`);
    
    // Update selection state
    container.querySelectorAll('.placement-option').forEach(el => {
        el.classList.remove('selected');
    });
    container.querySelector(`[data-option="${option}"]`).classList.add('selected');
    
    // Update preview and state
    const imageUrl = STRIPE_IMAGES[currentDesign.style][side][option];
    preview.src = imageUrl;
    currentDesign[side] = option;
    currentDesign[`${side}Image`] = imageUrl;
}

// Open send modal
function openSendModal() {
    if (!currentDesign.style) {
        alert('Please select a stripe style first');
        return;
    }
    
    // Update summary
    document.getElementById('summaryStyle').textContent = currentDesign.style;
    document.getElementById('summaryFront').textContent = formatOptionName(currentDesign.front);
    document.getElementById('summaryBack').textContent = formatOptionName(currentDesign.back);
    
    // Show modal
    document.getElementById('sendModal').classList.add('show');
}

// Close send modal
function closeSendModal() {
    document.getElementById('sendModal').classList.remove('show');
    document.getElementById('sendForm').reset();
}

// Get sales rep name from email
function getSalesRepName(email) {
    const reps = {
        'ruth@nwcustomapparel.com': 'Ruth Nhong',
        'taylar@nwcustomapparel.com': 'Taylar',
        'nika@nwcustomapparel.com': 'Nika',
        'erik@nwcustomapparel.com': 'Erik',
        'adriyella@nwcustomapparel.com': 'Adriyella',
        'bradley@nwcustomapparel.com': 'Bradley',
        'jim@nwcustomapparel.com': 'Jim',
        'art@nwcustomapparel.com': 'Steve (Artist)'
    };
    return reps[email] || 'Sales Team';
}

// Handle form submission
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('sendForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const sendButton = document.getElementById('sendButton');
        const originalContent = sendButton.innerHTML;
        
        try {
            // Show loading state
            sendButton.disabled = true;
            sendButton.innerHTML = '<span class="loading"></span> Sending...';
            
            // Get form data
            const designData = {
                customerName: document.getElementById('customerName').value.trim(),
                customerEmail: document.getElementById('customerEmail').value.trim(),
                customerPhone: document.getElementById('customerPhone').value.trim(),
                companyName: document.getElementById('companyName').value.trim(),
                salesRepEmail: document.getElementById('salesRep').value,
                message: document.getElementById('customMessage').value.trim(),
                
                // Design details
                stripeStyle: currentDesign.style,
                frontOption: currentDesign.front,
                backOption: currentDesign.back,
                frontImage: currentDesign.frontImage,
                backImage: currentDesign.backImage
            };
            
            // Save to database
            const saveResult = await quoteService.saveDesign(designData);
            const quoteID = saveResult.quoteID;
            
            if (!saveResult.success) {
                console.error('Database save warning:', saveResult.error);
            }
            
            // Send email - ALL variables must have values (never empty)
            const emailData = {
                // Email routing
                to_email: designData.customerEmail,
                from_name: 'Northwest Custom Apparel',
                reply_to: designData.salesRepEmail,
                
                // Quote details
                quote_id: quoteID,
                quote_type: 'Safety Stripe Design',
                quote_date: new Date().toLocaleDateString(),
                
                // Customer info
                customer_name: designData.customerName,
                customer_email: designData.customerEmail,
                company_name: designData.companyName || 'Not Provided',
                customer_phone: designData.customerPhone || 'Not Provided',
                
                // Design details
                stripe_style: designData.stripeStyle,
                front_option: formatOptionName(designData.frontOption),
                back_option: formatOptionName(designData.backOption),
                
                // Image URLs
                front_image_url: designData.frontImage,
                back_image_url: designData.backImage,
                
                // Message - NEVER empty string to avoid EmailJS corruption
                custom_message: designData.message || 'Thank you for your interest in our safety stripe shirts! I look forward to helping you with your order.',
                
                // Sales rep
                sales_rep_email: designData.salesRepEmail,
                sales_rep_name: getSalesRepName(designData.salesRepEmail),
                sales_rep_phone: '253-922-5793',
                
                // Company
                company_year: '1977'
            };
            
            console.log('Sending email with data:', emailData);
            
            await emailjs.send(
                'service_1c4k67j',
                'template_stripe',  // TODO: Replace with actual template ID
                emailData
            );
            
            // Show success
            showSuccess(quoteID);
            closeSendModal();
            
        } catch (error) {
            console.error('Error sending design:', error);
            alert('Failed to send design. Please try again.');
        } finally {
            sendButton.disabled = false;
            sendButton.innerHTML = originalContent;
        }
    });
});

// Show success modal
function showSuccess(quoteID) {
    document.getElementById('quoteIdDisplay').textContent = quoteID;
    document.getElementById('successModal').classList.add('show');
}

// Close success modal
function closeSuccessModal() {
    document.getElementById('successModal').classList.remove('show');
}

// Copy quote ID
function copyQuoteId() {
    const quoteId = document.getElementById('quoteIdDisplay').textContent;
    navigator.clipboard.writeText(quoteId).then(() => {
        const btn = event.target.closest('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 2000);
    });
}

// Start new design
function startNewDesign() {
    // Reset everything
    currentDesign = {
        style: '',
        front: '',
        back: '',
        frontImage: '',
        backImage: ''
    };
    
    // Reset UI
    document.querySelectorAll('.stripe-option').forEach(el => {
        el.classList.remove('selected');
    });
    document.getElementById('designArea').style.display = 'none';
    document.getElementById('actionSection').style.display = 'none';
    
    // Close modal and scroll to top
    closeSuccessModal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}