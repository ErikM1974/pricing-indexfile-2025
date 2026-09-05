/* shopworks-customer-setup-enhanced.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in training/shopworks-customer-setup-enhanced.html (Rule 3, 2026.09.05.11) ──
// Training Data
        const fieldInfo = {
            companyName: {
                label: 'Company Name',
                description: 'Legal business name of the customer',
                required: true,
                validation: 'Cannot be empty, should match business license'
            },
            customerId: {
                label: 'Customer ID',
                description: 'Unique identifier assigned by Shopworks',
                required: true,
                validation: 'Auto-generated, 5-6 digits'
            },
            website: {
                label: 'Website',
                description: 'Company website URL',
                required: false,
                validation: 'Should be valid URL format'
            },
            mainEmail: {
                label: 'Main Email',
                description: 'Primary contact email for the company',
                required: true,
                validation: 'Must be valid email format'
            },
            extCustId: {
                label: 'External Customer ID',
                description: 'External reference code (e.g., "big" for large accounts)',
                required: false,
                validation: 'Short identifier for internal use'
            },
            salesperson: {
                label: 'Salesperson',
                description: 'Assigned sales representative',
                required: true,
                validation: 'Must select from dropdown'
            },
            salesGroup: {
                label: 'Sales Group',
                description: 'Sales team or territory assignment',
                required: false,
                validation: 'Optional grouping for reporting'
            },
            customerType: {
                label: 'Customer Type',
                description: 'Classification of business entity',
                required: true,
                validation: 'Corporate, Individual, Government, or Non-Profit'
            },
            source: {
                label: 'Source',
                description: 'How the customer was acquired',
                required: true,
                validation: 'Google Search, Referral, Web, etc.'
            },
            reference: {
                label: 'Reference',
                description: 'Additional reference information or referral source',
                required: false,
                validation: 'Optional field for tracking referrals'
            },
            sicCode: {
                label: 'SIC Code',
                description: 'Standard Industrial Classification code',
                required: false,
                validation: '4-digit industry code'
            },
            sicDesc: {
                label: 'SIC Description',
                description: 'Industry description based on SIC code',
                required: false,
                validation: 'Auto-populated based on SIC code'
            },
            numEmployees: {
                label: 'Number of Employees',
                description: 'Company size for classification',
                required: false,
                validation: 'Numeric value'
            },
            taxCode1: {
                label: 'Tax Code',
                description: 'Primary tax classification',
                required: true,
                validation: '2200 for WA Sales Tax, 2202 for Out of State, 2203 for Wholesale'
            }
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
                website: 'www.blackstoneconstruction.com'
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
                website: 'www.techgearsolutions.com'
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
                website: 'www.youthsportsfoundation.org'
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
                website: 'www.cityoftacoma.org/parks'
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
                website: ''
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
                website: 'www.puyallupsd.org'
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
                website: 'www.fbcfederalway.org'
            }
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
                errors: ['Tax code should be 2200 for Washington state business without resale certificate']
            },
            {
                id: 2,
                title: 'Non-Profit Verification',
                company: 'Community Help Center',
                customerId: '12946',
                website: 'communityhelpenter.org', // Missing www
                email: 'info@chc.org',
                taxCode: '2200', // Wrong - should be 2203 for non-profit
                salesperson: '',  // Missing salesperson
                type: 'Non-Profit',
                errors: ['Website format incorrect', 'Tax code should be 2203 for non-profit', 'No salesperson assigned']
            },
            {
                id: 3,
                title: 'Out of State Customer',
                company: 'Nevada Sports Shop',
                customerId: '13047',
                website: 'www.nevadasports.com',
                email: 'orders@nevadasports',  // Invalid email
                taxCode: '2200', // Wrong - should be 2202
                salesperson: 'Taneisha Clark',
                type: 'Corporate',
                errors: ['Email format invalid', 'Tax code should be 2202 for out of state']
            }
        ];

        // Global variables
        let currentMode = null;
        let currentScenario = null;
        let score = 0;
        let timer = null;
        let startTime = null;

        // Progress tracking
        const progress = {
            completedScenarios: [],
            highScores: {
                fieldExplorer: 0,
                setupSimulator: 0,
                fieldDetective: 0,
                speedChallenge: 0
            },
            achievements: []
        };

        // Load progress from localStorage
        function loadProgress() {
            const saved = localStorage.getItem('shopworksTrainingProgress');
            if (saved) {
                Object.assign(progress, JSON.parse(saved));
            }
        }

        // Save progress to localStorage
        function saveProgress() {
            localStorage.setItem('shopworksTrainingProgress', JSON.stringify(progress));
        }

        // Initialize on load
        window.addEventListener('DOMContentLoaded', () => {
            loadProgress();
            initializeInterface();
            showWelcome();
        });

        // Tax code search function
        function searchTaxCode(accountNum) {
            // Simulate tax code search dialog
            const codes = [
                { code: '2200', desc: 'Washington State Sales Tax', paySales: true, shipTaxable: true },
                { code: '2202', desc: 'Out of State Sales', paySales: true, shipTaxable: true },
                { code: '2203', desc: 'Wholesale Sales', paySales: false, shipTaxable: false, exempt: true }
            ];
            
            const selectedCode = prompt('Select Tax Code:\n\n2200 - Washington State Sales Tax\n2202 - Out of State Sales\n2203 - Wholesale Sales\n\nEnter code:');
            
            const taxInfo = codes.find(c => c.code === selectedCode);
            if (taxInfo) {
                document.getElementById(`taxCode${accountNum}`).value = taxInfo.code;
                document.getElementById(`taxDesc${accountNum}`).value = taxInfo.desc;
                
                // Update indicators
                const payIndicator = document.getElementById(`payTax${accountNum}`);
                const shipIndicator = document.getElementById(`shipTax${accountNum}`);
                
                payIndicator.className = taxInfo.paySales ? 'tax-indicator active' : 'tax-indicator inactive';
                shipIndicator.className = taxInfo.shipTaxable ? 'tax-indicator active' : 'tax-indicator inactive';
                
                // Handle tax exempt
                if (taxInfo.exempt) {
                    document.getElementById('taxExemptToggle').className = 'tax-exempt-toggle active';
                    document.getElementById('taxExempt').disabled = false;
                    document.getElementById('taxExempt').value = 'A353-456-3456';
                    document.getElementById('expirationDate').disabled = false;
                    document.getElementById('expirationDate').value = '8/1/28';
                } else {
                    document.getElementById('taxExemptToggle').className = 'tax-exempt-toggle inactive';
                    document.getElementById('taxExempt').disabled = true;
                    document.getElementById('taxExempt').value = '';
                    document.getElementById('expirationDate').disabled = true;
                    document.getElementById('expirationDate').value = '';
                }
            }
        }

        function toggleTaxExempt() {
            const toggle = document.getElementById('taxExemptToggle');
            const exemptInput = document.getElementById('taxExempt');
            const dateInput = document.getElementById('expirationDate');
            
            if (toggle.className.includes('inactive')) {
                toggle.className = 'tax-exempt-toggle active';
                exemptInput.disabled = false;
                dateInput.disabled = false;
            } else {
                toggle.className = 'tax-exempt-toggle inactive';
                exemptInput.disabled = true;
                dateInput.disabled = true;
                exemptInput.value = '';
                dateInput.value = '';
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
                const codeField = document.getElementById(`taxCode${i}`);
                const descField = document.getElementById(`taxDesc${i}`);
                const payIndicator = document.getElementById(`payTax${i}`);
                const shipIndicator = document.getElementById(`shipTax${i}`);
                
                codeField.addEventListener('input', function() {
                    const taxInfo = taxCodes[this.value];
                    if (taxInfo) {
                        descField.value = taxInfo.desc;
                        payIndicator.className = taxInfo.paySales ? 'tax-indicator active' : 'tax-indicator inactive';
                        shipIndicator.className = taxInfo.shipTaxable ? 'tax-indicator active' : 'tax-indicator inactive';
                        
                        // Handle tax exempt for first account
                        if (i === 1 && taxInfo.exempt) {
                            document.getElementById('taxExemptToggle').className = 'tax-exempt-toggle active';
                            document.getElementById('taxExempt').disabled = false;
                            document.getElementById('taxExempt').value = 'A353-456-3456';
                            document.getElementById('expirationDate').disabled = false;
                            document.getElementById('expirationDate').value = '8/1/28';
                        } else if (i === 1 && !taxInfo.exempt) {
                            document.getElementById('taxExemptToggle').className = 'tax-exempt-toggle inactive';
                            document.getElementById('taxExempt').disabled = true;
                            document.getElementById('taxExempt').value = '';
                            document.getElementById('expirationDate').disabled = true;
                            document.getElementById('expirationDate').value = '';
                        }
                    } else {
                        descField.value = '';
                        payIndicator.className = 'tax-indicator inactive';
                        shipIndicator.className = 'tax-indicator inactive';
                    }
                });
            }

            // Add tooltips to fields
            addTooltips();
        }

        function addTooltips() {
            const tooltip = document.getElementById('tooltip');
            
            // Add tooltips to key fields
            const fieldsWithTooltips = [
                { id: 'companyName', text: 'Enter the legal business name' },
                { id: 'taxCode1', text: '2200: WA Tax | 2202: Out of State | 2203: Wholesale' },
                { id: 'salesperson', text: 'Assign the appropriate sales representative' },
                { id: 'customerType', text: 'Select the business entity type' }
            ];

            fieldsWithTooltips.forEach(field => {
                const element = document.getElementById(field.id);
                if (element) {
                    element.addEventListener('mouseenter', (e) => {
                        tooltip.textContent = field.text;
                        tooltip.style.left = e.pageX + 10 + 'px';
                        tooltip.style.top = e.pageY - 30 + 'px';
                        tooltip.classList.add('show');
                    });
                    
                    element.addEventListener('mouseleave', () => {
                        tooltip.classList.remove('show');
                    });
                }
            });
        }

        function showWelcome() {
            const content = document.getElementById('modeContent');
            content.innerHTML = `
                <h4>Welcome to Shopworks Training!</h4>
                <p style="font-size: 13px; line-height: 1.5;">
                    This realistic interface will help you master customer setup in Shopworks.
                </p>
                <ul style="font-size: 12px; margin-top: 10px;">
                    <li><strong>Field Explorer:</strong> Learn what each field does</li>
                    <li><strong>Setup Simulator:</strong> Practice real scenarios</li>
                    <li><strong>Field Detective:</strong> Find and fix errors</li>
                    <li><strong>Speed Challenge:</strong> Test your skills</li>
                </ul>
                <p style="font-size: 12px; margin-top: 10px; color: #666;">
                    Select a mode above to begin!
                </p>
            `;
        }

        // Field Explorer Mode
        function startFieldExplorer() {
            currentMode = 'fieldExplorer';
            clearAllHighlights();
            updateModeButtons();
            
            const content = document.getElementById('modeContent');
            content.innerHTML = `
                <h4>Field Explorer</h4>
                <p style="font-size: 12px;">Click on any field to learn about it!</p>
                <div id="fieldDescription" style="margin-top: 10px; padding: 10px; background: #f0f0f0; border-radius: 4px; min-height: 60px;">
                    <em style="color: #666;">Select a field to see details...</em>
                </div>
            `;

            // Add click handlers to all input fields
            addFieldExplorerHandlers();
        }

        function addFieldExplorerHandlers() {
            const fields = document.querySelectorAll('input, select');
            fields.forEach(field => {
                field.addEventListener('click', function(e) {
                    if (currentMode === 'fieldExplorer') {
                        e.preventDefault();
                        showFieldInfo(this);
                    }
                });
            });
        }

        function showFieldInfo(field) {
            const fieldId = field.id;
            const info = fieldInfo[fieldId];
            
            if (info) {
                const descDiv = document.getElementById('fieldDescription');
                descDiv.innerHTML = `
                    <strong>${info.label}</strong><br>
                    <span style="font-size: 12px;">${info.description}</span><br>
                    <span style="font-size: 11px; color: #666;">
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
            currentMode = 'setupSimulator';
            clearAllHighlights();
            clearAllFields();
            updateModeButtons();
            
            // Select random scenario
            currentScenario = setupScenarios[Math.floor(Math.random() * setupScenarios.length)];
            
            const content = document.getElementById('modeContent');
            content.innerHTML = `
                <h4>Setup Simulator</h4>
                <div style="background: #e8f4fd; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                    <strong>${currentScenario.title}</strong><br>
                    <span style="font-size: 12px;">
                        <strong>Company:</strong> ${currentScenario.company}<br>
                        <strong>Location:</strong> ${currentScenario.location}<br>
                        <strong>Industry:</strong> ${currentScenario.industry}<br>
                    </span>
                </div>
                <div style="margin-top: 10px; font-size: 12px;">
                    <div style="margin-bottom: 8px;">
                        <label style="display: inline-block; width: 120px;"><strong>Ext. Cust ID:</strong></label><br>
                        <input type="text" id="simExtCustId" style="width: 200px; padding: 2px; font-size: 11px; border: 1px solid #7f9db9;" placeholder="e.g., big">
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="display: inline-block; width: 120px;"><strong>Salesperson *</strong></label><br>
                        <select id="simSalesperson" class="form-control" style="width: 200px; padding: 2px; font-size: 11px;">
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
                    <div style="margin-bottom: 8px;">
                        <label style="display: inline-block; width: 120px;"><strong>Customer Type *</strong></label><br>
                        <select id="simCustomerType" class="form-control" style="width: 200px; padding: 2px; font-size: 11px;">
                            <option value="">Select...</option>
                            <option value="Corporate">Corporate</option>
                            <option value="Individual">Individual</option>
                            <option value="Government">Government</option>
                            <option value="Non-Profit">Non-Profit</option>
                            <option value="School">School</option>
                            <option value="Church">Church</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="display: inline-block; width: 120px;"><strong>Source *</strong></label><br>
                        <select id="simSource" class="form-control" style="width: 200px; padding: 2px; font-size: 11px;">
                            <option value="">Select...</option>
                            <option value="Google Search">Google Search</option>
                            <option value="Referral">Referral</option>
                            <option value="Web">Web</option>
                            <option value="Drive By">Drive By</option>
                            <option value="Trade Show">Trade Show</option>
                            <option value="Cold Call">Cold Call</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <label style="display: inline-block; width: 120px;"><strong>Tax Code *</strong></label><br>
                        <select id="simTaxCode" class="form-control" style="width: 200px; padding: 2px; font-size: 11px;">
                            <option value="">Select...</option>
                            <option value="2200">2200 - Washington State Sales Tax</option>
                            <option value="2202">2202 - Out of State Sales</option>
                            <option value="2203">2203 - Wholesale Sales</option>
                        </select>
                    </div>
                </div>
                <button class="action-btn primary" onclick="checkSetupAnswers()" style="width: 100%;">
                    <i class="fas fa-check"></i> Submit Setup
                </button>
                <div id="setupFeedback" style="margin-top: 10px;"></div>
            `;
            
            // Generate random customer ID
            document.getElementById('customerId').value = Math.floor(10000 + Math.random() * 90000);
            
            // Clear the main form fields and populate with scenario data
            document.getElementById('companyName').value = currentScenario.company;
            document.getElementById('mainEmail').value = currentScenario.email;
            document.getElementById('website').value = currentScenario.website;
            
            // Show score
            document.getElementById('scoreDisplay').style.display = 'block';
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
                    '2200': 'Washington State Sales Tax',
                    '2202': 'Out of State Sales',
                    '2203': 'Wholesale Sales'
                };
                feedback.push(`❌ Tax code should be "${currentScenario.expectedTax} - ${taxCodeName[currentScenario.expectedTax]}"`);
            }

            // Calculate score
            const percentCorrect = Math.round((correct / total) * 100);
            updateScore(percentCorrect);

            // Show feedback
            const feedbackDiv = document.getElementById('setupFeedback');
            feedbackDiv.innerHTML = `
                <div style="padding: 10px; background: ${percentCorrect === 100 ? '#d4edda' : '#f8d7da'}; border-radius: 4px;">
                    <strong>Score: ${percentCorrect}%</strong><br>
                    ${feedback.join('<br>')}
                </div>
                ${percentCorrect === 100 ? 
                    '<button class="action-btn primary" onclick="startSetupSimulator()" style="margin-top: 10px; width: 100%;">Try Another Scenario</button>' :
                    '<button class="action-btn" onclick="showSetupHints()" style="margin-top: 10px; width: 100%;">Show Hints</button>'
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
            feedbackDiv.innerHTML += `
                <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 4px;">
                    <strong>Hints:</strong><br>
                    ${hints.join('<br>')}
                </div>
            `;
        }

        // Field Detective Mode
        function startFieldDetective() {
            currentMode = 'fieldDetective';
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
            const taxEvent = new Event('input');
            document.getElementById('taxCode1').dispatchEvent(taxEvent);
            
            const content = document.getElementById('modeContent');
            content.innerHTML = `
                <h4>Field Detective</h4>
                <div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                    <strong>Review: ${currentScenario.title}</strong><br>
                    <span style="font-size: 12px;">
                        Find and fix all errors in this customer setup.
                        There are ${currentScenario.errors.length} error(s) to find.
                    </span>
                </div>
                <button class="action-btn primary" onclick="checkDetectiveAnswers()" style="width: 100%;">
                    <i class="fas fa-search"></i> Check for Errors
                </button>
                <div id="detectiveFeedback" style="margin-top: 10px;"></div>
            `;
            
            document.getElementById('scoreDisplay').style.display = 'block';
            updateScore(0);
        }

        function checkDetectiveAnswers() {
            const errors = currentScenario.errors;
            let foundErrors = [];
            let missedErrors = [];
            
            // Check each error type
            errors.forEach(error => {
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
            feedbackDiv.innerHTML = `
                <div style="padding: 10px; background: ${score === 100 ? '#d4edda' : '#f8d7da'}; border-radius: 4px;">
                    <strong>Score: ${score}%</strong><br>
                    <strong>Found (${foundErrors.length}/${errors.length}):</strong><br>
                    ${foundErrors.join('<br>') || 'None'}<br>
                    ${missedErrors.length > 0 ? `<br><strong>Missed:</strong><br>${missedErrors.join('<br>')}` : ''}
                </div>
                ${score === 100 ? 
                    '<button class="action-btn primary" onclick="startFieldDetective()" style="margin-top: 10px; width: 100%;">Try Another Case</button>' :
                    ''
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
            currentMode = 'speedChallenge';
            clearAllHighlights();
            clearAllFields();
            updateModeButtons();
            
            score = 0;
            startTime = Date.now();
            
            const content = document.getElementById('modeContent');
            content.innerHTML = `
                <h4>Speed Challenge</h4>
                <div style="background: #d4edda; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                    <strong>Quick Setup!</strong><br>
                    <span style="font-size: 12px;">
                        Set up as many customers correctly as you can in 60 seconds!
                    </span>
                </div>
                <div id="speedTimer" style="font-size: 24px; text-align: center; color: #dc3545;">60</div>
                <div id="speedScenario" style="margin-top: 10px;"></div>
                <button class="action-btn primary" onclick="submitSpeedAnswer()" style="width: 100%; margin-top: 10px;">
                    <i class="fas fa-bolt"></i> Submit
                </button>
            `;
            
            document.getElementById('scoreDisplay').style.display = 'block';
            updateScore(0);
            
            // Start timer
            startSpeedTimer();
            showNextSpeedScenario();
        }

        function startSpeedTimer() {
            let timeLeft = 60;
            timer = setInterval(() => {
                timeLeft--;
                document.getElementById('speedTimer').textContent = timeLeft;
                
                if (timeLeft <= 10) {
                    document.getElementById('speedTimer').style.color = '#dc3545';
                }
                
                if (timeLeft <= 0) {
                    endSpeedChallenge();
                }
            }, 1000);
        }

        function showNextSpeedScenario() {
            // Generate quick scenario
            const quickScenario = {
                company: `Company ${Math.floor(Math.random() * 1000)}`,
                isLocal: Math.random() > 0.5,
                hasResale: Math.random() > 0.5
            };
            
            const expectedTax = quickScenario.isLocal && !quickScenario.hasResale ? '2200' : 
                               quickScenario.hasResale ? '2203' : '2202';
            
            currentScenario = { expectedTax };
            
            document.getElementById('speedScenario').innerHTML = `
                <div style="padding: 10px; background: #f0f0f0; border-radius: 4px;">
                    <strong>${quickScenario.company}</strong><br>
                    Location: ${quickScenario.isLocal ? 'Washington' : 'Out of State'}<br>
                    Resale Certificate: ${quickScenario.hasResale ? 'Yes' : 'No'}<br>
                    <br>
                    <strong>Enter Tax Code:</strong>
                    <input type="text" id="speedTaxCode" style="width: 80px; padding: 5px;">
                </div>
            `;
            
            document.getElementById('speedTaxCode').focus();
        }

        function submitSpeedAnswer() {
            const answer = document.getElementById('speedTaxCode').value;
            
            if (answer === currentScenario.expectedTax) {
                score += 10;
                updateScore(score);
                
                // Flash success
                document.getElementById('speedScenario').classList.add('success-flash');
                
                // Next scenario
                setTimeout(() => {
                    clearAllFields();
                    showNextSpeedScenario();
                }, 300);
            } else {
                // Flash error
                document.getElementById('speedScenario').classList.add('error-flash');
                setTimeout(() => {
                    document.getElementById('speedScenario').classList.remove('error-flash');
                }, 300);
            }
        }

        function endSpeedChallenge() {
            clearInterval(timer);
            
            const content = document.getElementById('modeContent');
            content.innerHTML = `
                <h4>Speed Challenge Complete!</h4>
                <div style="padding: 15px; background: #d4edda; border-radius: 4px; text-align: center;">
                    <div style="font-size: 36px; color: #155724; margin-bottom: 10px;">
                        ${score} points
                    </div>
                    <strong>Great job!</strong><br>
                    ${score > progress.highScores.speedChallenge ? 
                        '<span style="color: #dc3545;">🏆 NEW HIGH SCORE!</span>' : 
                        `High Score: ${progress.highScores.speedChallenge}`
                    }
                </div>
                <button class="action-btn primary" onclick="startSpeedChallenge()" style="width: 100%; margin-top: 10px;">
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
            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            if (currentMode) {
                const activeBtn = document.querySelector(`.mode-btn:has(.fa-${getModeIcon(currentMode)})`);
                if (activeBtn) activeBtn.classList.add('active');
            }
        }

        function getModeIcon(mode) {
            const icons = {
                fieldExplorer: 'search',
                setupSimulator: 'user-plus',
                fieldDetective: 'user-secret',
                speedChallenge: 'tachometer-alt'
            };
            return icons[mode] || 'question';
        }

        function clearAllHighlights() {
            document.querySelectorAll('.highlight-field').forEach(el => {
                el.classList.remove('highlight-field');
            });
        }

        function clearAllFields() {
            const fieldsToClear = [
                'companyName', 'website', 'mainEmail',
                'taxCode1', 'taxCode2', 'taxCode3', 'taxCode4',
                'salesperson', 'customerType', 'source',
                'extCustId', 'salesGroup', 'reference',
                'sicCode', 'sicDesc', 'numEmployees', 'accountTier'
            ];
            
            fieldsToClear.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.value = '';
                    if (field.id.startsWith('taxCode')) {
                        const descField = document.getElementById(field.id.replace('Code', 'Desc'));
                        if (descField) descField.value = '';
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
                { first: 'Jeff', last: 'Pollock', title: '', dept: '', phone: '253-670-9242', fax: '', email: 'Jeff@skylineproperties.com' },
                { first: 'Tracy', last: 'Prest', title: 'AP', dept: '', phone: '', fax: '', email: 'tracy@skylineproperties.com' },
                { first: 'Andy', last: 'Tu', title: '', dept: '', phone: '', fax: '', email: 'andy.tu66@gmail.com' }
            ];
            
            const tbody = document.getElementById('contactsTableBody');
            tbody.innerHTML = contacts.map(contact => `
                <tr>
                    <td><input type="checkbox" class="grid-checkbox"></td>
                    <td>${contact.first}</td>
                    <td>${contact.last}</td>
                    <td>${contact.title}</td>
                    <td>${contact.dept}</td>
                    <td>${contact.phone} ${contact.phone ? '📞' : ''}</td>
                    <td>${contact.fax}</td>
                    <td>${contact.email} ${contact.email ? '✉️' : ''}</td>
                </tr>
            `).join('');
        }

        // Initialize contacts on load
        initializeContacts();
