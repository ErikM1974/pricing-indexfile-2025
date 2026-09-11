let bundleSubmitting = false,
    bundleZoomOpener = null,
    lastBundleOrder = null,
    lastLogoUpload = null;

// Initialize EmailJS
window.emailjs?.init(window.APP_CONFIG.EMAIL.PUBLIC_KEY);

// Form validation helpers
function showFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.classList.add('input-error');
    input.setAttribute('aria-invalid', 'true');
    let error = document.getElementById(inputId + '-error');
    if (!error) {
        error = document.createElement('div');
        error.id = inputId + '-error';
        error.className = 'error-message';
        input.insertAdjacentElement('afterend', error);
    }
    input.setAttribute('aria-describedby', error.id);
    error.textContent = message;
    error.classList.add('show');
}

function clearFieldError(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.classList.remove('input-error');
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    document.getElementById(inputId + '-error')?.classList.remove('show');
}

function clearAllErrors() {
    document.querySelectorAll('.input-error').forEach((input) => clearFieldError(input.id));
    showBundleError('');
}

// Calculate days until deadline
function updateDeadlineCountdown() {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Determine the deadline year
    // If we're past September 30 of current year, use next year
    const deadlineMonth = 8; // September (0-indexed)
    const deadlineDay = 30;
    let deadlineYear = currentYear;

    // Check if we've passed this year's deadline
    const thisYearDeadline = new Date(currentYear, deadlineMonth, deadlineDay, 23, 59, 59);
    if (now > thisYearDeadline) {
        deadlineYear = currentYear + 1;
    }

    // Set time to start of day for accurate day counting
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const deadlineStart = new Date(deadlineYear, deadlineMonth, deadlineDay);
    const timeDiff = deadlineStart - todayStart;
    const daysLeft = Math.round(timeDiff / (1000 * 60 * 60 * 24));

    const daysElement = document.getElementById('daysLeft');
    const banner = document.getElementById('deadlineBanner');

    if (daysElement && banner) {
        // Show banner only from August 1st to September 30th
        const showStartDate = new Date(deadlineYear, 7, 1); // August 1st

        if (now < showStartDate) {
            // Too early in the year, hide banner
            banner.hidden = true;
        } else if (daysLeft > 0) {
            daysElement.textContent = `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
            banner.hidden = false;
        } else if (daysLeft === 0) {
            daysElement.textContent = 'TODAY IS THE LAST DAY';
            daysElement.classList.add('bca-bold');
            banner.hidden = false;
        } else {
            // Past deadline, hide banner
            banner.hidden = true;
        }
    }
}

// Update countdown on page load
updateDeadlineCountdown();

// Phone number formatting
function formatPhoneNumber(value) {
    // Remove all non-digits
    const phoneNumber = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    if (phoneNumber.length === 0) {
        return '';
    } else if (phoneNumber.length <= 3) {
        return `(${phoneNumber}`;
    } else if (phoneNumber.length <= 6) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    } else {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    }
}

// Add phone formatting and validation clearing
document.addEventListener('DOMContentLoaded', function () {
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function (e) {
            const formatted = formatPhoneNumber(e.target.value);
            e.target.value = formatted;
            clearFieldError('phone'); // Clear error on input
        });

        // Handle paste events
        phoneInput.addEventListener('paste', function (e) {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            e.target.value = formatPhoneNumber(pastedText);
            clearFieldError('phone');
        });
    }

    // Clear errors on input for all required fields
    const requiredFields = [
        'customerName',
        'email',
        'shippingAddress',
        'shippingCity',
        'shippingState',
        'shippingZip',
    ];
    requiredFields.forEach((fieldId) => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener('input', function () {
                clearFieldError(fieldId);
            });
        }
    });
});

// Logo Upload Functions
function handleLogoUpload(event) {
    if (bundleSubmitting) return;
    const file = event.target.files[0];
    if (!file) return;
    removeLogo(false);
    event.target.value = '';
    const valid = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/svg+xml',
        'application/pdf',
    ];
    if (!valid.includes(file.type)) {
        showBundleError('Please upload an image (PNG, JPG, GIF, SVG) or PDF file');
        return;
    }
    if (file.size > 20 * 1024 * 1024) {
        showBundleError('File size must be less than 20MB');
        return;
    }
    window.selectedLogoFile = file;
    showBundleError('');
    document.getElementById('logoFileName').textContent = file.name;
    document.getElementById('logoPreview').hidden = false;
    const image = document.getElementById('previewImage');
    image.hidden = true;
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
            if (window.selectedLogoFile !== file) return;
            window.selectedLogoDataURL = reader.result;
            image.src = reader.result;
            image.hidden = false;
        };
        reader.onerror = () => {
            if (window.selectedLogoFile === file)
                showBundleError('The logo preview could not be read. Choose the file again.');
        };
        reader.readAsDataURL(file);
    }
}

function removeLogo(focus = true) {
    if (bundleSubmitting) return;
    document.getElementById('logoFile').value = '';
    document.getElementById('logoPreview').hidden = true;
    document.getElementById('previewImage').removeAttribute('src');
    window.selectedLogoFile = null;
    window.selectedLogoDataURL = null;
    if (focus) document.getElementById('logoFile').focus();
}

// Upload file to API
async function uploadFileToAPI(file) {
    try {
        // Add timestamp to filename to avoid conflicts
        const timestamp = Date.now();
        const nameParts = file.name.split('.');
        const extension = nameParts.pop();
        const baseName = nameParts.join('.');
        const uniqueFileName = `${baseName}_${timestamp}.${extension}`;

        // Create a new File object with the unique name
        const uniqueFile = new File([file], uniqueFileName, { type: file.type });

        const formData = new FormData();
        formData.append('file', uniqueFile);

        const response = await fetch(window.APP_CONFIG.API.BASE_URL + '/api/files/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.externalKey) throw new Error('Upload response did not identify the logo');
        return result.externalKey;
    } catch (error) {
        console.error('Failed to upload file:', error);
        throw error;
    }
}

// Product Modal Functions
function openProductModal(imageSrc, title, description) {
    const modal = document.getElementById('productModal');
    bundleZoomOpener = document.activeElement;
    document.getElementById('modalImage').src = imageSrc;
    document.getElementById('modalImage').alt = title;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalDescription').textContent = description;
    if (!modal.open) modal.showModal();
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal.open) modal.close();
}

// Close modal on ESC key
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        closeProductModal();
    }
});

let currentStep = 1;
const totalSteps = 4;
const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
const quoteService = window.BreastCancerBundleService
    ? new window.BreastCancerBundleService()
    : null;

// Adjust quantity with buttons
function adjustQuantity(change) {
    if (bundleSubmitting) return;
    const input = document.getElementById('bundleQuantity');
    let newValue = parseInt(input.value) + change;
    if (newValue < 8) newValue = 8;
    input.value = newValue;
    updateBundleDisplay();
}

// Update bundle display when quantity changes
function updateBundleDisplay() {
    if (bundleSubmitting) return;
    let quantity = parseInt(document.getElementById('bundleQuantity').value) || 8;

    // Enforce minimum
    if (quantity < 8) {
        document.getElementById('bundleQuantity').value = 8;
        quantity = 8;
    }

    // Update displays
    document.getElementById('bundleCount').textContent = quantity;
    document.getElementById('itemCount').textContent = quantity;
    document.getElementById('itemCount2').textContent = quantity;
    document.getElementById('requiredTotal').textContent = quantity;
    document.getElementById('requiredTotal2').textContent = quantity;

    // Update price
    const totalPrice = quantity * 45;
    document.getElementById('totalPrice').textContent = totalPrice.toFixed(0);

    // Reset size inputs when quantity changes to prevent confusion
    sizes.forEach((size) => {
        const input = document.getElementById(`size-${size}`);
        if (input) {
            input.value = 0;
        }
    });

    // Update size total display
    updateSizeTotal();
}

// Update size total and validation
function updateSizeTotal() {
    const required = parseInt(document.getElementById('bundleQuantity').value) || 8;
    const total = sizes.reduce(
        (sum, size) => sum + (parseInt(document.getElementById('size-' + size).value) || 0),
        0
    );
    document.getElementById('currentTotal').textContent = total;
    const status = document.getElementById('sizeValidation'),
        message = document.getElementById('validationMessage');
    status.className = 'bca-size-status';
    if (total === required) {
        status.classList.add('is-complete');
        message.textContent = 'Perfect! Size distribution is complete.';
    } else if (total > required) {
        status.classList.add('is-error');
        message.textContent = 'Too many! Remove ' + (total - required) + ' shirt(s).';
    } else if (total > 0) message.textContent = 'Add ' + (required - total) + ' more shirt(s).';
    else message.textContent = 'Enter the size distribution for your t-shirts.';
}

// Toggle between Ship and Pickup delivery methods
function toggleDeliveryFields() {
    if (bundleSubmitting) return;
    const shipping =
        document.querySelector('input[name="deliveryMethod"]:checked').value === 'Ship';
    document.getElementById('shippingFields').hidden = !shipping;
    document.getElementById('pickupInfo').hidden = shipping;
    for (const id of ['shippingAddress', 'shippingCity', 'shippingState', 'shippingZip'])
        document.getElementById(id).required = shipping;
}

// Validate current step
function validateStep(step) {
    if (step === 2) {
        for (const input of document.querySelectorAll('#bundleQuantity, .bca-size-grid input')) {
            if (!input.checkValidity() || !Number.isInteger(Number(input.value))) {
                showBundleError(
                    'Enter whole, non-negative quantities. The minimum order is eight bundles.'
                );
                return false;
            }
        }
    }
    clearAllErrors(); // Clear any existing errors

    if (step === 2) {
        // Check that size distribution matches bundle quantity
        const requiredQuantity = parseInt(document.getElementById('bundleQuantity').value) || 8;
        let total = 0;

        sizes.forEach((size) => {
            const input = document.getElementById(`size-${size}`);
            total += parseInt(input.value) || 0;
        });

        if (total !== requiredQuantity) {
            const validationDiv = document.getElementById('sizeValidation');
            validationDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

            if (total === 0) {
                showBundleError('Please enter the size distribution for your t-shirts.');
            } else if (total < requiredQuantity) {
                showBundleError(
                    `Please add ${requiredQuantity - total} more shirt(s) to complete your order.`
                );
            } else {
                showBundleError(
                    `Please remove ${total - requiredQuantity} shirt(s). Total must equal ${requiredQuantity}.`
                );
            }
            return false;
        }
    } else if (step === 3) {
        // Validate customer form
        const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked').value;
        let hasErrors = false;

        // Validate name
        const nameInput = document.getElementById('customerName');
        if (!nameInput.value.trim()) {
            showFieldError('customerName', 'Full name is required');
            hasErrors = true;
        }

        // Validate email
        const emailInput = document.getElementById('email');
        if (!emailInput.value.trim()) {
            showFieldError('email', 'Email address is required');
            hasErrors = true;
        } else if (!emailInput.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            showFieldError('email', 'Please enter a valid email address');
            hasErrors = true;
        }

        // Validate phone
        const phoneInput = document.getElementById('phone');
        const phoneDigits = phoneInput.value.replace(/\D/g, '');
        if (!phoneInput.value.trim()) {
            showFieldError('phone', 'Phone number is required');
            hasErrors = true;
        } else if (phoneDigits.length !== 10) {
            showFieldError('phone', 'Please enter a 10-digit phone number');
            hasErrors = true;
        }

        // Only validate shipping fields if Ship is selected
        if (deliveryMethod === 'Ship') {
            if (!document.getElementById('shippingAddress').value.trim()) {
                showFieldError('shippingAddress', 'Delivery address is required');
                hasErrors = true;
            }
            if (!document.getElementById('shippingCity').value.trim()) {
                showFieldError('shippingCity', 'City is required');
                hasErrors = true;
            }
            if (!document.getElementById('shippingState').value.trim()) {
                showFieldError('shippingState', 'State is required');
                hasErrors = true;
            }
            if (!document.getElementById('shippingZip').value.trim()) {
                showFieldError('shippingZip', 'ZIP code is required');
                hasErrors = true;
            }
        }

        if (hasErrors) {
            // Scroll to first error
            const firstError = document.querySelector('.input-error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstError.focus();
            }
            return false;
        }
    }
    return true;
}

// Show review step
function showReview() {
    const quantity =
        parseInt(escapeBundleText(document.getElementById('bundleQuantity').value)) || 8;
    const totalPrice = quantity * 45;

    // Update order summary
    document.getElementById('reviewBundleCount').textContent = quantity;
    document.getElementById('reviewShirtCount').textContent = quantity;
    document.getElementById('reviewCapCount').textContent = quantity;
    document.getElementById('reviewTotalPrice').textContent = totalPrice.toFixed(2);

    // Customer info
    const customerInfo = document.getElementById('reviewCustomerInfo');
    const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked').value;
    let deliveryInfo = '';

    if (deliveryMethod === 'Ship') {
        deliveryInfo = `
                    <div><strong>Delivery Method:</strong> Ship to Address</div>
                    <div><strong>Shipping Address:</strong> ${escapeBundleText(document.getElementById('shippingAddress').value)},
                         ${escapeBundleText(document.getElementById('shippingCity').value)},
                         ${escapeBundleText(document.getElementById('shippingState').value)}
                         ${escapeBundleText(document.getElementById('shippingZip').value)}</div>`;
    } else {
        deliveryInfo = `
                    <div><strong>Delivery Method:</strong> Factory Pickup</div>
                    <div><strong>Pickup Location:</strong> 2025 Freeman Road East, Milton, WA 98354</div>`;
    }

    // Check if logo was uploaded
    let logoHTML = '';
    if (window.selectedLogoFile) {
        if (window.selectedLogoDataURL) {
            logoHTML = `
                        <div class="">
                            <strong>Company Logo:</strong>
                            <img src="${window.selectedLogoDataURL}" alt="Company Logo" class="">
                            <p class="bca-muted bca-small">${escapeBundleText(window.selectedLogoFile.name)}</p>
                        </div>
                    `;
        } else {
            logoHTML = `
                        <div class="">
                            <strong>Company Logo:</strong>
                            <div class="bca-row">
                                <i class="fas fa-file-pdf"></i>
                                <p class="bca-muted bca-small">${escapeBundleText(window.selectedLogoFile.name)}</p>
                            </div>
                        </div>
                    `;
        }
    }

    customerInfo.innerHTML = `
                <div><strong>Name:</strong> ${escapeBundleText(document.getElementById('customerName').value)}</div>
                <div><strong>Company:</strong> ${escapeBundleText(document.getElementById('companyName').value) || 'N/A'}</div>
                <div><strong>Email:</strong> ${escapeBundleText(document.getElementById('email').value)}</div>
                <div><strong>Phone:</strong> ${escapeBundleText(document.getElementById('phone').value)}</div>
                ${deliveryInfo}
                <div><strong>Event Date:</strong> ${escapeBundleText(document.getElementById('eventDate').value) || 'Not specified'}</div>
                ${logoHTML}
            `;

    // Size distribution
    const sizeDistribution = document.getElementById('reviewSizeDistribution');
    let sizeHTML = '';

    sizes.forEach((size) => {
        const quantity = parseInt(document.getElementById(`size-${size}`).value) || 0;
        if (quantity > 0) {
            sizeHTML += `
                        <div class="">
                            <div class="bca-muted bca-small">${size}</div>
                            <div class="bca-bold">${quantity}</div>
                        </div>
                    `;
        }
    });
    sizeDistribution.innerHTML = sizeHTML;

    // Design choice
    const designChoice = document.querySelector('input[name="designChoice"]:checked').value;
    const designChoiceDiv = document.getElementById('reviewDesignChoice');
    const designImage =
        designChoice === 'Flag'
            ? 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9131677'
            : 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9131676';
    const designName = designChoice === 'Flag' ? 'Patriotic Flag' : 'Classic Ribbon';
    const designDescription =
        designChoice === 'Flag'
            ? 'American flag with pink ribbon and company logo'
            : 'Pink ribbon with company logo';

    designChoiceDiv.innerHTML = `
                <img src="${designImage}" alt="${designName}" class="">
                <div>
                    <div class="bca-bold">${designName}</div>
                    <div class="bca-muted bca-small">${designDescription}</div>
                    <div class="bca-bold bca-small">
                        <i class="fas fa-check-circle"></i> Selected Design
                    </div>
                </div>
            `;
}

// Change step
function changeStep(direction) {
    if (bundleSubmitting || ![-1, 1].includes(direction)) return;
    const target = currentStep + direction;
    if (target < 1 || target > totalSteps) return;
    if (direction === 1 && !validateStep(currentStep)) return;
    document.getElementById('step-' + currentStep).classList.remove('active');
    currentStep = target;
    const panel = document.getElementById('step-' + currentStep);
    panel.classList.add('active');
    updateStepIndicators();
    updateNavigation();
    if (currentStep === 4) showReview();
    const heading = panel.querySelector('h2');
    heading.tabIndex = -1;
    heading.focus();
    heading.scrollIntoView({ block: 'start' });
}

// Update step indicators
function updateStepIndicators() {
    for (let i = 1; i <= totalSteps; i++) {
        const step = document.getElementById('step-indicator-' + i);
        step.className = 'bca-step' + (i < currentStep ? ' is-complete' : '');
        step.removeAttribute('aria-current');
        if (i === currentStep) step.setAttribute('aria-current', 'step');
        step.innerHTML =
            '<span class="bca-step-number">' +
            (i < currentStep ? '✓' : i) +
            '</span><span>' +
            getStepName(i) +
            '</span>';
    }
}

function getStepName(step) {
    const names = ['', 'Products', 'Sizes', 'Contact', 'Review'];
    return names[step];
}

// Update navigation buttons
function updateNavigation() {
    document.getElementById('prevBtn').hidden = currentStep === 1;
    document.getElementById('nextBtn').hidden = currentStep === totalSteps;
    document.getElementById('submitBtn').hidden = currentStep !== totalSteps;
}

// Submit order
async function submitOrder(retrySaved = false) {
    if (bundleSubmitting) return;
    if (!quoteService) {
        showBundleError(
            'Ordering is unavailable. Please refresh or contact sales@nwcustomapparel.com.'
        );
        return;
    }
    if (!retrySaved && (!validateStep(2) || !validateStep(3))) return;
    const data = retrySaved ? lastBundleOrder : collectBundleOrder();
    if (!data) return;
    const file = retrySaved ? null : window.selectedLogoFile;
    bundleSubmitting = true;
    showBundleError('');
    const controls = [...document.querySelectorAll('button,input,select,textarea')].map((node) => [
        node,
        node.disabled,
    ]);
    controls.forEach(([node]) => {
        node.disabled = true;
    });
    const main = document.querySelector('main'),
        priorInert = main.inert;
    main.inert = true;
    document.getElementById('loadingSpinner').hidden = false;
    let focusTarget;
    try {
        if (file) {
            if (lastLogoUpload?.file === file) data.imageUpload = lastLogoUpload.key;
            else {
                data.imageUpload = await uploadFileToAPI(file);
                lastLogoUpload = { file, key: data.imageUpload };
            }
        }
        lastBundleOrder = JSON.parse(JSON.stringify(data));
        const result = await quoteService.processOrder(lastBundleOrder);
        if (!result.success)
            throw new Error(result.message || 'Your order could not be saved. Please try again.');
        document.getElementById('displayQuoteId').textContent = result.quoteId;
        document.getElementById('step-4').classList.remove('active');
        const success = document.getElementById('step-success');
        success.classList.add('active');
        document.querySelector('.bca-step-nav').hidden = true;
        const complete = result.customerEmailSent && result.salesEmailSent;
        document.getElementById('confirmationStatus').textContent = complete
            ? 'Your confirmation email has been sent with your order details.'
            : 'Your order is saved. Email delivery is incomplete. Retry email delivery below; your order will not be saved again.';
        document.getElementById('retryBundleEmail').hidden = complete;
        focusTarget = success.querySelector('h2');
    } catch (error) {
        showBundleError(
            file && !data.imageUpload
                ? 'Logo upload failed. Your order has not been submitted. Try again or remove the logo.'
                : error.message
        );
        focusTarget = document.getElementById('bundleError');
    } finally {
        document.getElementById('loadingSpinner').hidden = true;
        main.inert = priorInert;
        controls.forEach(([node, disabled]) => {
            node.disabled = disabled;
        });
        bundleSubmitting = false;
        if (focusTarget) {
            focusTarget.tabIndex = -1;
            focusTarget.focus();
            focusTarget.scrollIntoView({ block: 'nearest' });
        }
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', function () {
    updateNavigation();
    updateBundleDisplay();
    updateStepIndicators();
});

function showBundleError(message) {
    const error = document.getElementById('bundleError');
    error.textContent = message;
    error.hidden = !message;
    if (message) {
        error.focus();
        error.scrollIntoView({ block: 'nearest' });
    }
}

function escapeBundleText(value) {
    const node = document.createElement('span');
    node.textContent = String(value ?? '');
    return node.innerHTML;
}

function dismissDeadline() {
    document.getElementById('deadlineBanner').hidden = true;
}

function openLogoPicker() {
    if (!bundleSubmitting) document.getElementById('logoFile').click();
}

function restartBundle() {
    if (!bundleSubmitting) location.reload();
}

function collectBundleOrder() {
    const value = (id) => document.getElementById(id).value;
    const quantity = parseInt(value('bundleQuantity')) || 8;
    const shipping = document.querySelector('input[name="deliveryMethod"]:checked').value;
    const design = document.querySelector('input[name="designChoice"]:checked').value;
    return {
        customerName: value('customerName'),
        companyName: value('companyName'),
        email: value('email'),
        phone: value('phone').replace(/\D/g, ''),
        deliveryMethod: shipping,
        address: shipping === 'Ship' ? value('shippingAddress') : '',
        city: shipping === 'Ship' ? value('shippingCity') : '',
        state: shipping === 'Ship' ? value('shippingState') : '',
        zip: shipping === 'Ship' ? value('shippingZip') : '',
        eventDate: value('eventDate'),
        notes: value('notes'),
        imageUpload: null,
        designChoice: design,
        designImageURL:
            design === 'Flag'
                ? 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9131677'
                : 'https://c3eku948.caspio.com/dp/a0e150004df4984fb1ef4d30b01a/files/9131676',
        bundleCount: quantity,
        sizeDistribution: Object.fromEntries(
            sizes.map((size) => [size, parseInt(value('size-' + size)) || 0])
        ),
        totalShirts: quantity,
        totalCaps: quantity,
        totalAmount: quantity * 45,
    };
}

function retryBundleEmail() {
    return submitOrder(true);
}
document.getElementById('productModal').addEventListener('close', () => bundleZoomOpener?.focus());
document
    .querySelectorAll('.bca-size-grid input')
    .forEach((input) => input.addEventListener('input', updateSizeTotal));
document.addEventListener('DOMContentLoaded', () => {
    if (!quoteService)
        showBundleError(
            'Ordering is unavailable. Please refresh or contact sales@nwcustomapparel.com.'
        );
});
