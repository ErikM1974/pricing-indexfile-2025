/* screenprint-fast-quote-page.js — the page script for quote-builders/screenprint-fast-quote.html, extracted
 * 2026-09-06 from its inline <script> (Rule 3). Global scope kept: the page's data-call attributes resolve
 * window.nextStep / prevStep / submitQuote through data-call-delegator.js. */
// Initialize EmailJS
emailjs.init('4qSbDO-SQs19TbP80');

let currentStep = 1;
const formData = {
    quantity: '',
    locations: '',
    colors: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    companyName: '',
    deadline: '',
    notes: ''
};

// Option card selection
document.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', function() {
        const group = this.parentElement;
        group.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');

        // Update hidden input
        const input = group.nextElementSibling;
        if (input && input.tagName === 'INPUT') {
            input.value = this.dataset.value;
        }
    });
});

function updateProgress(step) {
    document.querySelectorAll('.progress-step').forEach((elem, index) => {
        if (index + 1 < step) {
            elem.classList.add('completed');
            elem.classList.remove('active');
        } else if (index + 1 === step) {
            elem.classList.add('active');
            elem.classList.remove('completed');
        } else {
            elem.classList.remove('active', 'completed');
        }
    });
}

function showStep(step) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
    updateProgress(step);
    window.scrollTo(0, 0);
}

function validateStep1() {
    const quantity = document.getElementById('quantity').value;
    const locations = document.getElementById('locations').value;
    const colors = document.getElementById('colors').value;

    if (!quantity || !locations || !colors) {
        alert('Please complete all fields before continuing');
        return false;
    }

    formData.quantity = quantity;
    formData.locations = locations;
    formData.colors = colors;

    // Update estimate
    updateEstimate();

    return true;
}

function updateEstimate() {
    // Simple estimation logic
    const quantity = formData.quantity;
    const locations = parseInt(formData.locations);
    const colors = formData.colors;

    let baseLow = 8;
    let baseHigh = 12;

    // Adjust for quantity
    if (quantity === '144+') {
        baseLow -= 2;
        baseHigh -= 2;
    } else if (quantity === '24-47') {
        baseLow += 2;
        baseHigh += 2;
    }

    // Adjust for locations
    if (locations > 1) {
        baseLow += (locations - 1) * 2;
        baseHigh += (locations - 1) * 3;
    }

    // Adjust for colors
    if (colors === '5-6') {
        baseLow += 2;
        baseHigh += 3;
    } else if (colors === '3-4') {
        baseLow += 1;
        baseHigh += 1;
    }

    document.getElementById('estimateRange').textContent =
        `$${baseLow} - $${baseHigh} per piece`;
}

function nextStep() {
    if (currentStep === 1) {
        if (!validateStep1()) return;
    }

    currentStep++;
    showStep(currentStep);
}

function prevStep() {
    currentStep--;
    showStep(currentStep);
}

async function submitQuote() {
    // Validate contact info
    const name = document.getElementById('customerName').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();

    if (!name || !email || !phone) {
        alert('Please fill in all required fields (Name, Email, Phone)');
        return;
    }

    // Collect all form data
    formData.customerName = name;
    formData.customerEmail = email;
    formData.customerPhone = phone;
    formData.companyName = document.getElementById('companyName').value.trim();
    formData.deadline = document.getElementById('deadline').value;
    formData.notes = document.getElementById('notes').value.trim();

    // Disable submit button
    const submitBtn = event.target;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Submitting...';

    try {
        // Use the service to submit
        const service = new ScreenPrintFastQuoteService();
        const result = await service.submitQuote(formData);

        if (result.success) {
            // Update success screen
            document.getElementById('displayQuoteId').textContent = result.quoteId;
            document.getElementById('confirmEmail').textContent = email;

            // Show success step
            currentStep = 3;
            showStep(currentStep);
        } else {
            throw new Error(result.error || 'Failed to submit quote');
        }
    } catch (error) {
        console.error('Submit error:', error);
        alert('There was an error submitting your quote. Please try again or call us at (253) 922-5793.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Get My Quote <i class="fas fa-check" aria-hidden="true"></i>';
    }
}
