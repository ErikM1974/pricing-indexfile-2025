/* Page-owned simulation controls; original sample lessons retained. */
(function () {
    'use strict';
    /* shopworks-customer-setup-enhanced.js — page script (extracted from inline <script>, 2026.09.05.11) */

    // ── moved from inline <script> in training/shopworks-customer-setup-enhanced.html (Rule 3, 2026.09.05.11) ──
    // Training Data
    const fieldInfo = {
        companyName: {
            label: 'Company Name',
            description: 'Legal business name of the customer',
            required: true,
            validation: 'Cannot be empty, should match business license',
        },
        customerId: {
            label: 'Customer ID',
            description: 'Unique identifier assigned by Shopworks',
            required: true,
            validation: 'Auto-generated, 5-6 digits',
        },
        website: {
            label: 'Website',
            description: 'Company website URL',
            required: false,
            validation: 'Should be valid URL format',
        },
        mainEmail: {
            label: 'Main Email',
            description: 'Primary contact email for the company',
            required: true,
            validation: 'Must be valid email format',
        },
        extCustId: {
            label: 'External Customer ID',
            description: 'External reference code (e.g., "big" for large accounts)',
            required: false,
            validation: 'Short identifier for internal use',
        },
        salesperson: {
            label: 'Salesperson',
            description: 'Assigned sales representative',
            required: true,
            validation: 'Must select from dropdown',
        },
        salesGroup: {
            label: 'Sales Group',
            description: 'Sales team or territory assignment',
            required: false,
            validation: 'Optional grouping for reporting',
        },
        customerType: {
            label: 'Customer Type',
            description: 'Classification of business entity',
            required: true,
            validation: 'Corporate, Individual, Government, or Non-Profit',
        },
        source: {
            label: 'Source',
            description: 'How the customer was acquired',
            required: true,
            validation: 'Google Search, Referral, Web, etc.',
        },
        reference: {
            label: 'Reference',
            description: 'Additional reference information or referral source',
            required: false,
            validation: 'Optional field for tracking referrals',
        },
        sicCode: {
            label: 'SIC Code',
            description: 'Standard Industrial Classification code',
            required: false,
            validation: '4-digit industry code',
        },
        sicDesc: {
            label: 'SIC Description',
            description: 'Industry description based on SIC code',
            required: false,
            validation: 'Auto-populated based on SIC code',
        },
        numEmployees: {
            label: 'Number of Employees',
            description: 'Company size for classification',
            required: false,
            validation: 'Numeric value',
        },
        taxCode1: {
            label: 'Tax Code',
            description: 'Primary tax classification',
            required: true,
            validation: '2200 for WA Sales Tax, 2202 for Out of State, 2203 for Wholesale',
        },
    };

    const setupScenarios = [
        {
            id: 1,
            title: 'New Customer Setup: BlackStone Construction',
            company: 'BlackStone Construction',
            location: 'Seattle, WA',
            industry: 'Construction',
            type: 'Corporate',
            hasResaleCert: false,
            needsShipping: false,
            expectedTax: '2200',
            email: 'purchasing@blackstoneconstruction.com',
            website: 'www.blackstoneconstruction.com',
        },
        {
            id: 2,
            title: 'New Customer Setup: TechGear Solutions',
            company: 'TechGear Solutions',
            location: 'Portland, OR',
            industry: 'Retail',
            type: 'Corporate',
            hasResaleCert: true,
            needsShipping: true,
            expectedTax: '2203',
            email: 'orders@techgear.com',
            website: 'www.techgearsolutions.com',
        },
        {
            id: 3,
            title: 'New Customer Setup: Youth Sports Foundation',
            company: 'Youth Sports Foundation',
            location: 'Los Angeles, CA',
            industry: 'Non-Profit',
            type: 'Non-Profit',
            hasResaleCert: false,
            needsShipping: true,
            expectedTax: '2202',
            email: 'info@youthsportsfoundation.org',
            website: 'www.youthsportsfoundation.org',
        },
        {
            id: 4,
            title: 'New Customer Setup: City of Tacoma',
            company: 'City of Tacoma Parks Dept',
            location: 'Tacoma, WA',
            industry: 'Government',
            type: 'Government',
            hasResaleCert: true,
            needsShipping: false,
            expectedTax: '2203',
            email: 'parks@cityoftacoma.org',
            website: 'www.cityoftacoma.org/parks',
        },
        {
            id: 5,
            title: 'New Customer Setup: Personal Order',
            company: 'Sarah Johnson',
            location: 'Tacoma, WA',
            industry: 'Individual',
            type: 'Individual',
            hasResaleCert: false,
            needsShipping: false,
            expectedTax: '2200',
            email: 'sarahjohnson@gmail.com',
            website: '',
        },
        {
            id: 6,
            title: 'New Customer Setup: Puyallup School District',
            company: 'Puyallup School District',
            location: 'Puyallup, WA',
            industry: 'Education',
            type: 'School',
            hasResaleCert: true,
            needsShipping: false,
            expectedTax: '2203',
            email: 'purchasing@puyallupsd.org',
            website: 'www.puyallupsd.org',
        },
        {
            id: 7,
            title: 'New Customer Setup: First Baptist Church',
            company: 'First Baptist Church',
            location: 'Federal Way, WA',
            industry: 'Religious',
            type: 'Church',
            hasResaleCert: true,
            needsShipping: false,
            expectedTax: '2203',
            email: 'office@fbcfederalway.org',
            website: 'www.fbcfederalway.org',
        },
    ];

    const detectiveScenarios = [
        {
            id: 1,
            title: 'Restaurant Setup Review',
            company: "Mike's Diner",
            customerId: '12845',
            website: 'www.mikesdiner.com',
            email: 'contact@mikesdiner.com',
            taxCode: '2203', // Wrong - should be 2200 for local
            salesperson: 'Nika Lao',
            type: 'Corporate',
            errors: ['Tax code should be 2200 for Washington state business without resale certificate'],
        },
        {
            id: 2,
            title: 'Non-Profit Verification',
            company: 'Community Help Center',
            customerId: '12946',
            website: 'communityhelpenter.org', // Missing www
            email: 'info@chc.org',
            taxCode: '2200', // Wrong - should be 2203 for non-profit
            salesperson: '', // Missing salesperson
            type: 'Non-Profit',
            errors: ['Website format incorrect', 'Tax code should be 2203 for non-profit', 'No salesperson assigned'],
        },
        {
            id: 3,
            title: 'Out of State Customer',
            company: 'Nevada Sports Shop',
            customerId: '13047',
            website: 'www.nevadasports.com',
            email: 'orders@nevadasports', // Invalid email
            taxCode: '2200', // Wrong - should be 2202
            salesperson: 'Taneisha Clark',
            type: 'Corporate',
            errors: ['Email format invalid', 'Tax code should be 2202 for out of state'],
        },
    ];

    // Global variables
    let currentMode = null;
    let currentScenario = null;
    let score = 0;
    let timer = null;
    let pending = null;
    let answered = false;
    let storageUsable = true;
    function stopRound() {
        window.clearInterval(timer);
        timer = null;
        window.clearTimeout(pending);
        pending = null;
    }
    window.addEventListener('pagehide', stopRound);
    function enterMode(mode) {
        stopRound();
        currentMode = mode;
        answered = false;
        document.getElementById('scoreDisplay').hidden = true;
    }
    function storageWarning() {
        const el = document.getElementById('storage-status');
        el.hidden = false;
        el.textContent =
            'Saved training progress is unavailable. You can practice in this tab; scores will not be saved.';
    }

    // Progress tracking
    const progress = {
        completedScenarios: [],
        highScores: {
            fieldExplorer: 0,
            setupSimulator: 0,
            fieldDetective: 0,
            speedChallenge: 0,
        },
        achievements: [],
    };

    // Load progress from localStorage
    function loadProgress() {
        try {
            const raw = window.localStorage.getItem('shopworksTrainingProgress');
            if (raw === null) return;
            const saved = JSON.parse(raw);
            if (
                !saved ||
                typeof saved !== 'object' ||
                Array.isArray(saved) ||
                !Array.isArray(saved.completedScenarios) ||
                !Array.isArray(saved.achievements) ||
                !saved.highScores ||
                typeof saved.highScores !== 'object' ||
                Array.isArray(saved.highScores)
            )
                throw new Error('Invalid saved progress');
            if (
                !saved.completedScenarios.every((v) => typeof v === 'string' || Number.isSafeInteger(v)) ||
                !saved.achievements.every((v) => typeof v === 'string')
            )
                throw new Error('Invalid progress entries');
            for (const key of Object.keys(progress.highScores)) {
                if (!Number.isFinite(saved.highScores[key]) || saved.highScores[key] < 0)
                    throw new Error('Invalid high score');
            }
            progress.completedScenarios = saved.completedScenarios;
            progress.achievements = saved.achievements;
            for (const key of Object.keys(progress.highScores)) progress.highScores[key] = saved.highScores[key];
        } catch {
            storageUsable = false;
            storageWarning();
        }
    }

    // Save progress to localStorage
    function saveProgress() {
        if (!storageUsable) return;
        try {
            window.localStorage.setItem('shopworksTrainingProgress', JSON.stringify(progress));
        } catch {
            storageUsable = false;
            storageWarning();
        }
    }

    // Initialize on load
    window.addEventListener('DOMContentLoaded', () => {
        loadProgress();
        initializeInterface();
        showWelcome();
    });

    // Tax code search function
    function searchTaxCode(accountNum) {
        const dialog = document.getElementById('tax-code-dialog');
        dialog.dataset.account = accountNum;
        document.getElementById('tax-dialog-title').textContent = 'Choose tax code for account ' + accountNum;
        dialog.showModal();
    }

    function toggleTaxExempt() {
        setExemption(document.getElementById('taxExemptToggle').getAttribute('aria-pressed') !== 'true', false);
    }
    function setExemption(active, prefill) {
        const toggle = document.getElementById('taxExemptToggle');
        toggle.className = 'btn tax-exempt-toggle ' + (active ? 'active' : 'inactive');
        toggle.setAttribute('aria-pressed', String(active));
        for (const id of ['taxExempt', 'expirationDate']) document.getElementById(id).disabled = !active;
        if (!active) {
            document.getElementById('taxExempt').value = '';
            document.getElementById('expirationDate').value = '';
        } else if (prefill) {
            document.getElementById('taxExempt').value = 'A353-456-3456';
            document.getElementById('expirationDate').value = '8/1/28';
        }
    }
    function describeIndicators() {
        for (let i = 1; i <= 4; i++) {
            for (const [prefix, label] of [
                ['payTax', 'Pay sales tax'],
                ['shipTax', 'Shipping taxable'],
            ]) {
                const el = document.getElementById(prefix + i);
                el.textContent = label + ': ' + (el.classList.contains('active') ? 'Yes' : 'No');
            }
        }
    }

    function initializeInterface() {
        // Add tax code auto-fill with indicators
        const taxCodes = {
                '2200': { 
                    desc: 'Washington State Sales Tax',
                    paySales: true,
                    shipTaxable: true,
                    exempt: false
                },
                '2202': { 
                    desc: 'Out of State Sales',
                    paySales: true,
                    shipTaxable: true,
                    exempt: false
                },
                '2203': { 
                    desc: 'Wholesale Sales',
                    paySales: false,
                    shipTaxable: false,
                    exempt: true
                }
            };

        for (let i = 1; i <= 4; i++) {
            const code = document.getElementById('taxCode' + i);
            code.addEventListener('input', () => {
                const info = taxCodes[code.value];
                document.getElementById('taxDesc' + i).value = info ? info.desc : '';
                document.getElementById('payTax' + i).className =
                    'tax-indicator ' + (info && info.paySales ? 'active' : 'inactive');
                document.getElementById('shipTax' + i).className =
                    'tax-indicator ' + (info && info.shipTaxable ? 'active' : 'inactive');
                if (i === 1) setExemption(Boolean(info && info.exempt), Boolean(info && info.exempt));
                describeIndicators();
            });
            code.dispatchEvent(new window.Event('input'));
        }
        addFieldExplorerHandlers();
        // Add tooltips to fields
        addTooltips();
    }

    function addTooltips() {
        const tips = [
            ['companyName', 'Enter the legal business name'],
            ['taxCode1', '2200: WA Tax | 2202: Out of State | 2203: Wholesale'],
            ['salesperson', 'Assign the appropriate sales representative'],
            ['customerType', 'Select the business entity type'],
        ];
        for (const [id, text] of tips) {
            const input = document.getElementById(id),
                hint = document.createElement('span');
            hint.id = id + '-help';
            hint.className = 'simulator-detail';
            hint.textContent = text;
            input.setAttribute('aria-describedby', hint.id);
            input.after(hint);
        }
    }

    function showWelcome() {
        const content = document.getElementById('modeContent');
        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.

        content.innerHTML = `
                <h4>Welcome to Shopworks Training!</h4>
                <p>
                    This realistic interface will help you master customer setup in Shopworks.
                </p>
                <ul>
                    <li><strong>Field Explorer:</strong> Learn what each field does</li>
                    <li><strong>Setup Simulator:</strong> Practice real scenarios</li>
                    <li><strong>Field Detective:</strong> Find and fix errors</li>
                    <li><strong>Speed Challenge:</strong> Test your skills</li>
                </ul>
                <p>
                    Select a mode above to begin!
                </p>
            `;
    }

    // Field Explorer Mode
    function startFieldExplorer() {
        enterMode('fieldExplorer');
        clearAllHighlights();
        updateModeButtons();

        const content = document.getElementById('modeContent');
        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.

        content.innerHTML = `
                <h4>Field Explorer</h4>
                <p>Click on any field to learn about it!</p>
                <div id="fieldDescription">
                    <em>Select a field to see details...</em>
                </div>
            `;

        // Add click handlers to all input fields
    }

    function addFieldExplorerHandlers() {
        for (const field of document.querySelectorAll('.simulator-workspace input,.simulator-workspace select')) {
            const explain = () => {
                if (currentMode === 'fieldExplorer') showFieldInfo(field);
            };
            field.addEventListener('focus', explain);
            field.addEventListener('click', explain);
        }
    }

    function showFieldInfo(field) {
        const fieldId = field.id;
        const info = fieldInfo[fieldId];

        if (info) {
            const descDiv = document.getElementById('fieldDescription');
            // Fixed local lesson markup / numeric scores only; learner input is never interpolated.
            // eslint-disable-next-line no-unsanitized/property
            descDiv.innerHTML = `
                    <strong>${info.label}</strong><br>
                    <span>${info.description}</span><br>
                    <span>
                        ${info.required ? '⚠️ Required' : '📝 Optional'} | 
                        Validation: ${info.validation}
                    </span>
                `;

            // Highlight the field
            clearAllHighlights();
            field.classList.add('highlight-field');
        }
    }

    // Setup Simulator Mode
    function startSetupSimulator() {
        enterMode('setupSimulator');
        clearAllHighlights();
        clearAllFields();
        updateModeButtons();

        // Select random scenario
        currentScenario = setupScenarios[Math.floor(Math.random() * setupScenarios.length)];

        const content = document.getElementById('modeContent');
        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.
        // eslint-disable-next-line no-unsanitized/property
        content.innerHTML = `
                <h4>Setup Simulator</h4>
                <div>
                    <strong>${currentScenario.title}</strong><br>
                    <span>
                        <strong>Company:</strong> ${currentScenario.company}<br>
                        <strong>Location:</strong> ${currentScenario.location}<br>
                        <strong>Industry:</strong> ${currentScenario.industry}<br>
                    </span>
                </div>
                <div>
                    <div>
                        <label for="simExtCustId"><strong>Ext. Cust ID:</strong></label><br>
                        <input class="field-input" type="text" id="simExtCustId" placeholder="e.g., big">
                    </div>
                    <div>
                        <label for="simSalesperson"><strong>Salesperson *</strong></label><br>
                        <select class="field-select" id="simSalesperson" class="field-select form-control">
                            <option value="">Select...</option>
                            <option value="Nika Lao">Nika Lao</option>
                            <option value="Adriyella Trujillo">Adriyella Trujillo</option>
                            <option value="Taneisha Clark">Taneisha Clark</option>
                            <option value="Ruthie Nhong">Ruthie Nhong</option>
                            <option value="Erik Mickelson">Erik Mickelson</option>
                            <option value="Jim Mickelson">Jim Mickelson</option>
                            <option value="House">House</option>
                        </select>
                    </div>
                    <div>
                        <label for="simCustomerType"><strong>Customer Type *</strong></label><br>
                        <select class="field-select" id="simCustomerType" class="field-select form-control">
                            <option value="">Select...</option>
                            <option value="Corporate">Corporate</option>
                            <option value="Individual">Individual</option>
                            <option value="Government">Government</option>
                            <option value="Non-Profit">Non-Profit</option>
                            <option value="School">School</option>
                            <option value="Church">Church</option>
                        </select>
                    </div>
                    <div>
                        <label for="simSource"><strong>Source *</strong></label><br>
                        <select class="field-select" id="simSource" class="field-select form-control">
                            <option value="">Select...</option>
                            <option value="Google Search">Google Search</option>
                            <option value="Referral">Referral</option>
                            <option value="Web">Web</option>
                            <option value="Drive By">Drive By</option>
                            <option value="Trade Show">Trade Show</option>
                            <option value="Cold Call">Cold Call</option>
                        </select>
                    </div>
                    <div>
                        <label for="simTaxCode"><strong>Tax Code *</strong></label><br>
                        <select class="field-select" id="simTaxCode" class="field-select form-control">
                            <option value="">Select...</option>
                            <option value="2200">2200 - Washington State Sales Tax</option>
                            <option value="2202">2202 - Out of State Sales</option>
                            <option value="2203">2203 - Wholesale Sales</option>
                        </select>
                    </div>
                </div>
                <button class="btn btn-primary action-btn primary" data-sim-call="checkSetupAnswers">
                    <i class="fas fa-check" aria-hidden="true"></i> Submit Setup
                </button>
                <div role="status" id="setupFeedback"></div>
            `;

        // Generate random customer ID
        document.getElementById('customerId').value = Math.floor(10000 + Math.random() * 90000);

        // Clear the main form fields and populate with scenario data
        document.getElementById('companyName').value = currentScenario.company;
        document.getElementById('mainEmail').value = currentScenario.email;
        document.getElementById('website').value = currentScenario.website;

        // Show score
        document.getElementById('scoreDisplay').hidden = false;
        updateScore(0);
    }

    function checkSetupAnswers() {
        let correct = 0;
        let total = 0;
        let feedback = [];

        // Check Ext Cust ID (optional but good practice)
        const extCustId = document.getElementById('simExtCustId').value;
        if (extCustId && extCustId.trim() !== '') {
            feedback.push('✅ External Customer ID added (good practice!)');
        }

        // Check salesperson - ANY selection is valid as long as one is selected
        total++;
        const salesperson = document.getElementById('simSalesperson').value;
        if (salesperson && salesperson !== '') {
            correct++;
            feedback.push('✅ Salesperson assigned');
        } else {
            feedback.push(`❌ Please select a salesperson`);
        }

        // Check customer type
        total++;
        const customerType = document.getElementById('simCustomerType').value;
        if (customerType === currentScenario.type) {
            correct++;
            feedback.push('✅ Customer type correct');
        } else {
            feedback.push(`❌ Customer type should be "${currentScenario.type}"`);
        }

        // Check source - ANY selection is valid as long as one is selected
        total++;
        const source = document.getElementById('simSource').value;
        if (source && source !== '') {
            correct++;
            feedback.push('✅ Source identified');
        } else {
            feedback.push(`❌ Please select a source`);
        }

        // Check tax code
        total++;
        const taxCode = document.getElementById('simTaxCode').value;
        if (taxCode === currentScenario.expectedTax) {
            correct++;
            feedback.push('✅ Tax code correct');
        } else {
            const taxCodeName = {
                2200: 'Washington State Sales Tax',
                2202: 'Out of State Sales',
                2203: 'Wholesale Sales',
            };
            feedback.push(
                `❌ Tax code should be "${currentScenario.expectedTax} - ${taxCodeName[currentScenario.expectedTax]}"`,
            );
        }

        // Calculate score
        const percentCorrect = Math.round((correct / total) * 100);
        updateScore(percentCorrect);

        // Show feedback
        const feedbackDiv = document.getElementById('setupFeedback');
        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.
        // eslint-disable-next-line no-unsanitized/property
        feedbackDiv.innerHTML = `
                <div class="feedback ${percentCorrect === 100 ? 'correct' : 'incorrect'}">
                    <strong>Score: ${percentCorrect}%</strong><br>
                    ${feedback.join('<br>')}
                </div>
                ${
                    percentCorrect === 100
                        ? '<button class="btn btn-primary action-btn primary" data-sim-call="startSetupSimulator">Try Another Scenario</button>'
                        : '<button class="btn action-btn" data-sim-call="showSetupHints">Show Hints</button>'
                }
            `;

        // Save high score
        if (percentCorrect > progress.highScores.setupSimulator) {
            progress.highScores.setupSimulator = percentCorrect;
            saveProgress();
        }
    }

    function showSetupHints() {
        const hints = [];

        // Determine correct tax code based on scenario
        if (currentScenario.location.includes('WA') && !currentScenario.hasResaleCert) {
            hints.push('💡 Washington state businesses without resale certificates use tax code 2200');
        }

        if (currentScenario.hasResaleCert) {
            hints.push('💡 Businesses with resale certificates use tax code 2203 (Wholesale Sales)');
        }

        if (!currentScenario.location.includes('WA') && !currentScenario.hasResaleCert) {
            hints.push('💡 Out-of-state businesses without resale certificates use tax code 2202');
        }

        hints.push('💡 Any salesperson selection is valid - just make sure to assign one!');
        hints.push(`💡 Customer type should match the industry: ${currentScenario.industry} → ${currentScenario.type}`);

        const feedbackDiv = document.getElementById('setupFeedback');
        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.
        // eslint-disable-next-line no-unsanitized/property
        feedbackDiv.innerHTML += `
                <div>
                    <strong>Hints:</strong><br>
                    ${hints.join('<br>')}
                </div>
            `;
    }

    // Field Detective Mode
    function startFieldDetective() {
        enterMode('fieldDetective');
        clearAllHighlights();
        clearAllFields();
        updateModeButtons();

        // Select random detective scenario
        currentScenario = detectiveScenarios[Math.floor(Math.random() * detectiveScenarios.length)];

        // Populate fields with scenario data (including errors)
        document.getElementById('companyName').value = currentScenario.company;
        document.getElementById('customerId').value = currentScenario.customerId;
        document.getElementById('website').value = currentScenario.website;
        document.getElementById('mainEmail').value = currentScenario.email;
        document.getElementById('taxCode1').value = currentScenario.taxCode;
        document.getElementById('salesperson').value = currentScenario.salesperson;
        document.getElementById('customerType').value = currentScenario.type;

        // Trigger tax description update
        const taxEvent = new window.Event('input');
        document.getElementById('taxCode1').dispatchEvent(taxEvent);

        const content = document.getElementById('modeContent');
        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.
        // eslint-disable-next-line no-unsanitized/property
        content.innerHTML = `
                <h4>Field Detective</h4>
                <div>
                    <strong>Review: ${currentScenario.title}</strong><br>
                    <span>
                        Find and fix all errors in this customer setup.
                        There are ${currentScenario.errors.length} error(s) to find.
                    </span>
                </div>
                <button class="btn btn-primary action-btn primary" data-sim-call="checkDetectiveAnswers">
                    <i class="fas fa-search" aria-hidden="true"></i> Check for Errors
                </button>
                <div role="status" id="detectiveFeedback"></div>
            `;

        document.getElementById('scoreDisplay').hidden = false;
        updateScore(0);
    }

    function checkDetectiveAnswers() {
        const errors = currentScenario.errors;
        let foundErrors = [];
        let missedErrors = [];

        // Check each error type
        errors.forEach((error) => {
            if (error.includes('Tax code')) {
                // Check if tax code was corrected
                const currentTaxCode = document.getElementById('taxCode1').value;
                let expectedCode = '';

                if (error.includes('2200')) expectedCode = '2200';
                else if (error.includes('2202')) expectedCode = '2202';
                else if (error.includes('2203')) expectedCode = '2203';

                if (currentTaxCode === expectedCode) {
                    foundErrors.push('✅ Tax code corrected');
                } else {
                    missedErrors.push(`❌ ${error}`);
                }
            }

            if (error.includes('Website format')) {
                const website = document.getElementById('website').value;
                if (website.startsWith('www.')) {
                    foundErrors.push('✅ Website format corrected');
                } else {
                    missedErrors.push(`❌ ${error}`);
                }
            }

            if (error.includes('Email format')) {
                const email = document.getElementById('mainEmail').value;
                if (email.includes('@') && email.includes('.')) {
                    foundErrors.push('✅ Email format corrected');
                } else {
                    missedErrors.push(`❌ ${error}`);
                }
            }

            if (error.includes('salesperson')) {
                const salesperson = document.getElementById('salesperson').value;
                if (salesperson !== '') {
                    foundErrors.push('✅ Salesperson assigned');
                } else {
                    missedErrors.push(`❌ ${error}`);
                }
            }
        });

        const score = Math.round((foundErrors.length / errors.length) * 100);
        updateScore(score);

        const feedbackDiv = document.getElementById('detectiveFeedback');
        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.
        // eslint-disable-next-line no-unsanitized/property
        feedbackDiv.innerHTML = `
                <div class="feedback ${score === 100 ? 'correct' : 'incorrect'}">
                    <strong>Score: ${score}%</strong><br>
                    <strong>Found (${foundErrors.length}/${errors.length}):</strong><br>
                    ${foundErrors.join('<br>') || 'None'}<br>
                    ${missedErrors.length > 0 ? `<br><strong>Missed:</strong><br>${missedErrors.join('<br>')}` : ''}
                </div>
                ${
                    score === 100
                        ? '<button class="btn btn-primary action-btn primary" data-sim-call="startFieldDetective">Try Another Case</button>'
                        : ''
                }
            `;

        // Save high score
        if (score > progress.highScores.fieldDetective) {
            progress.highScores.fieldDetective = score;
            saveProgress();
        }
    }

    // Speed Challenge Mode
    function startSpeedChallenge() {
        enterMode('speedChallenge');
        clearAllHighlights();
        clearAllFields();
        updateModeButtons();

        score = 0;

        const content = document.getElementById('modeContent');
        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.

        content.innerHTML = `
                <h4>Speed Challenge</h4>
                <div>
                    <strong>Quick Setup!</strong><br>
                    <span>
                        Set up as many customers correctly as you can in 60 seconds!
                    </span>
                </div>
                <div id="speedTimer">60</div>
                <div id="speedScenario"></div>
                <button class="btn btn-primary action-btn primary" data-sim-call="submitSpeedAnswer">
                    <i class="fas fa-bolt" aria-hidden="true"></i> Submit
                </button>
            `;

        document.getElementById('scoreDisplay').hidden = false;
        updateScore(0);

        // Start timer
        startSpeedTimer();
        showNextSpeedScenario();
    }

    function startSpeedTimer() {
        let timeLeft = 60;
        const deadline = Date.now() + 60000;
        timer = window.setInterval(() => {
            timeLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            document.getElementById('speedTimer').textContent = timeLeft;

            if (timeLeft <= 0) {
                endSpeedChallenge();
            }
        }, 1000);
    }

    function showNextSpeedScenario() {
        answered = false;
        document.getElementById('exercise-status').textContent = '';
        // Generate quick scenario
        const quickScenario = {
            company: `Company ${Math.floor(Math.random() * 1000)}`,
            isLocal: Math.random() > 0.5,
            hasResale: Math.random() > 0.5,
        };

        const expectedTax =
            quickScenario.isLocal && !quickScenario.hasResale ? '2200' : quickScenario.hasResale ? '2203' : '2202';

        currentScenario = { expectedTax };

        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.
        // eslint-disable-next-line no-unsanitized/property
        document.getElementById('speedScenario').innerHTML = `
                <div>
                    <strong>${quickScenario.company}</strong><br>
                    Location: ${quickScenario.isLocal ? 'Washington' : 'Out of State'}<br>
                    Resale Certificate: ${quickScenario.hasResale ? 'Yes' : 'No'}<br>
                    <br>
                    <label for="speedTaxCode"><strong>Enter Tax Code:</strong></label>
                    <input class="field-input" type="text" id="speedTaxCode">
                </div>
            `;

        document.getElementById('speedTaxCode').focus();
    }

    function submitSpeedAnswer() {
        if (answered || currentMode !== 'speedChallenge' || !timer) return;
        const answer = document.getElementById('speedTaxCode').value;

        if (answer === currentScenario.expectedTax) {
            answered = true;
            score += 10;
            updateScore(score);

            // Flash success
            document.getElementById('exercise-status').textContent = 'Correct! Next customer…';

            // Next scenario
            pending = window.setTimeout(() => {
                clearAllFields();
                showNextSpeedScenario();
            }, 300);
        } else {
            // Flash error
            document.getElementById('exercise-status').textContent =
                'That code does not match this customer. Check the location and resale certificate, then try again.';
        }
    }

    function endSpeedChallenge() {
        stopRound();
        answered = true;

        const content = document.getElementById('modeContent');
        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.
        // eslint-disable-next-line no-unsanitized/property
        content.innerHTML = `
                <h4>Speed Challenge Complete!</h4>
                <div>
                    <div>
                        ${score} points
                    </div>
                    <strong>Great job!</strong><br>
                    ${
                        score > progress.highScores.speedChallenge
                            ? '<span>🏆 NEW HIGH SCORE!</span>'
                            : `High Score: ${progress.highScores.speedChallenge}`
                    }
                </div>
                <button class="btn btn-primary action-btn primary" data-sim-call="startSpeedChallenge">
                    Play Again
                </button>
            `;

        // Save high score
        if (score > progress.highScores.speedChallenge) {
            progress.highScores.speedChallenge = score;
            saveProgress();
        }
    }

    // Utility Functions
    function updateModeButtons() {
        document.querySelectorAll('.mode-btn').forEach((btn) => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });

        if (currentMode) {
            const activeBtn = document.querySelector(`.mode-btn:has(.fa-${getModeIcon(currentMode)})`);
            if (activeBtn) {
                activeBtn.classList.add('active');
                activeBtn.setAttribute('aria-pressed', 'true');
            }
        }
    }

    function getModeIcon(mode) {
        const icons = {
            fieldExplorer: 'search',
            setupSimulator: 'user-plus',
            fieldDetective: 'user-secret',
            speedChallenge: 'tachometer-alt',
        };
        return icons[mode] || 'question';
    }

    function clearAllHighlights() {
        document.querySelectorAll('.highlight-field').forEach((el) => {
            el.classList.remove('highlight-field');
        });
    }

    function clearAllFields() {
        const fieldsToClear = [
            'companyName',
            'website',
            'mainEmail',
            'taxCode1',
            'taxCode2',
            'taxCode3',
            'taxCode4',
            'salesperson',
            'customerType',
            'source',
            'extCustId',
            'salesGroup',
            'reference',
            'sicCode',
            'sicDesc',
            'numEmployees',
            'accountTier',
        ];

        fieldsToClear.forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
                if (field.id.startsWith('taxCode')) {
                    const descField = document.getElementById(field.id.replace('Code', 'Desc'));
                    if (descField) descField.value = '';
                    field.dispatchEvent(new window.Event('input'));
                }
            }
        });
    }

    function updateScore(newScore) {
        score = newScore;
        document.getElementById('scoreValue').textContent = score;
    }

    // Initialize sample contacts
    function initializeContacts() {
        const contacts = [
            {
                first: 'Jeff',
                last: 'Pollock',
                title: '',
                dept: '',
                phone: '253-670-9242',
                fax: '',
                email: 'Jeff@skylineproperties.com',
            },
            {
                first: 'Tracy',
                last: 'Prest',
                title: 'AP',
                dept: '',
                phone: '',
                fax: '',
                email: 'tracy@skylineproperties.com',
            },
            { first: 'Andy', last: 'Tu', title: '', dept: '', phone: '', fax: '', email: 'andy.tu66@gmail.com' },
        ];

        const tbody = document.getElementById('contactsTableBody');
        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.
        // eslint-disable-next-line no-unsanitized/property
        tbody.innerHTML = contacts
            .map(
                (contact) => `
                <tr>
                    <td><input type="checkbox" class="grid-checkbox" aria-label="Select ${contact.first} ${contact.last}"></td>
                    <td>${contact.first}</td>
                    <td>${contact.last}</td>
                    <td>${contact.title}</td>
                    <td>${contact.dept}</td>
                    <td>${contact.phone} ${contact.phone ? '📞' : ''}</td>
                    <td>${contact.fax}</td>
                    <td>${contact.email} ${contact.email ? '✉️' : ''}</td>
                </tr>
            `,
            )
            .join('');
    }

    // Initialize contacts on load
    initializeContacts();

    const actions = {
        startFieldExplorer,
        startSetupSimulator,
        startFieldDetective,
        startSpeedChallenge,
        searchTaxCode,
        toggleTaxExempt,
        checkSetupAnswers,
        showSetupHints,
        checkDetectiveAnswers,
        submitSpeedAnswer,
    };
    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-sim-call]');
        if (!button) return;
        const action = actions[button.dataset.simCall];
        if (action) {
            action(...JSON.parse(button.dataset.simArgs || '[]'));
            if (/^start/.test(button.dataset.simCall)) {
                const h = document.querySelector('#modeContent h4');
                h.tabIndex = -1;
                h.focus();
            }
        }
    });
    document.getElementById('tax-code-dialog').addEventListener('click', (event) => {
        const button = event.target.closest('[data-tax-code]');
        if (!button) return;
        const dialog = event.currentTarget,
            input = document.getElementById('taxCode' + dialog.dataset.account);
        input.value = button.dataset.taxCode;
        input.dispatchEvent(new window.Event('input'));
        dialog.close();
        input.focus();
    });
    document
        .getElementById('tax-dialog-close')
        .addEventListener('click', () => document.getElementById('tax-code-dialog').close());
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.target.id === 'speedTaxCode') {
            event.preventDefault();
            submitSpeedAnswer();
        }
    });
})();
