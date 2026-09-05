/* shopworks-sales-tax-training.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in training/shopworks-sales-tax-training.html (Rule 3, 2026.09.05.11) ──
// Training scenarios focused specifically on tax code selection
        const taxScenarios = [
            {
                id: 1,
                company: "BlackStone Construction",
                location: "Seattle, WA",
                industry: "Construction",
                customerType: "Corporate",
                hasResaleCert: false,
                resaleCertNumber: "",
                expectedTaxCode: "2200",
                explanation: "Washington state business without a resale certificate uses 2200 for standard WA sales tax."
            },
            {
                id: 2,
                company: "TechGear Solutions",
                location: "Portland, OR",
                industry: "Technology Retail",
                customerType: "Corporate",
                hasResaleCert: true,
                resaleCertNumber: "OR-789-123456",
                expectedTaxCode: "2203",
                explanation: "Customer has a valid resale certificate, so they are tax exempt and use wholesale code 2203."
            },
            {
                id: 3,
                company: "Youth Sports Foundation",
                location: "Los Angeles, CA",
                industry: "Non-Profit",
                customerType: "Non-Profit",
                hasResaleCert: false,
                resaleCertNumber: "",
                expectedTaxCode: "2202",
                explanation: "Out-of-state customer without resale certificate uses 2202 for out-of-state sales."
            },
            {
                id: 4,
                company: "City of Tacoma Parks",
                location: "Tacoma, WA",
                industry: "Government",
                customerType: "Government",
                hasResaleCert: true,
                resaleCertNumber: "WA-GOV-456789",
                expectedTaxCode: "2203",
                explanation: "Government entity with tax exempt status uses 2203 for wholesale/exempt sales."
            },
            {
                id: 5,
                company: "Sarah Johnson",
                location: "Federal Way, WA",
                industry: "Individual",
                customerType: "Individual",
                hasResaleCert: false,
                resaleCertNumber: "",
                expectedTaxCode: "2200",
                explanation: "Individual customer in Washington state uses 2200 for standard WA sales tax."
            },
            {
                id: 6,
                company: "Nevada Sports Shop",
                location: "Las Vegas, NV",
                industry: "Retail",
                customerType: "Corporate",
                hasResaleCert: false,
                resaleCertNumber: "",
                expectedTaxCode: "2202",
                explanation: "Out-of-state retail business without resale certificate uses 2202."
            },
            {
                id: 7,
                company: "Puyallup School District",
                location: "Puyallup, WA",
                industry: "Education",
                customerType: "School",
                hasResaleCert: true,
                resaleCertNumber: "WA-EDU-123456",
                expectedTaxCode: "2203",
                explanation: "Educational institution with tax exempt status uses 2203."
            },
            {
                id: 8,
                company: "First Baptist Church",
                location: "Spokane, WA",
                industry: "Religious",
                customerType: "Church",
                hasResaleCert: true,
                resaleCertNumber: "WA-501C3-789",
                expectedTaxCode: "2203",
                explanation: "Non-profit religious organization with tax exempt status uses 2203."
            },
            {
                id: 9,
                company: "Mountain View Brewery",
                location: "Denver, CO",
                industry: "Manufacturing",
                customerType: "Corporate",
                hasResaleCert: true,
                resaleCertNumber: "CO-MFG-987654",
                expectedTaxCode: "2203",
                explanation: "Out-of-state manufacturer with resale certificate uses 2203 for wholesale sales."
            },
            {
                id: 10,
                company: "Pacific Northwest Printing",
                location: "Bellevue, WA",
                industry: "Printing Services",
                customerType: "Corporate",
                hasResaleCert: false,
                resaleCertNumber: "",
                expectedTaxCode: "2200",
                explanation: "Washington state business without resale certificate uses 2200 for standard WA sales tax."
            }
        ];

        let currentScenarioIndex = 0;
        let score = 0;
        let selectedTaxCode = null;

        function displayScenario() {
            const scenario = taxScenarios[currentScenarioIndex];
            const scenarioCard = document.getElementById('scenarioCard');
            
            scenarioCard.innerHTML = `
                <h3 style="color: #2B5797; margin-bottom: 15px; text-align: center;">
                    Customer Setup Scenario
                </h3>
                
                <div class="customer-info">
                    <div class="info-item">
                        <span class="info-label">Company:</span>
                        <span class="info-value">${scenario.company}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Location:</span>
                        <span class="info-value">${scenario.location}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Industry:</span>
                        <span class="info-value">${scenario.industry}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Customer Type:</span>
                        <span class="info-value">${scenario.customerType}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Has Resale Cert:</span>
                        <span class="info-value" style="color: ${scenario.hasResaleCert ? '#5cb85c' : '#d9534f'};">
                            ${scenario.hasResaleCert ? '✅ YES' : '❌ NO'}
                        </span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Resale Cert #:</span>
                        <span class="info-value">${scenario.resaleCertNumber || 'N/A'}</span>
                    </div>
                </div>

                <div class="tax-selection">
                    <h4 style="margin-bottom: 15px;">Which tax code should you use?</h4>
                    
                    <div class="tax-options">
                        <div class="tax-option" onclick="selectTaxCode('2200')" data-code="2200">
                            <div class="code-number">2200</div>
                            <div class="code-name">Washington State<br>Sales Tax</div>
                        </div>
                        <div class="tax-option" onclick="selectTaxCode('2202')" data-code="2202">
                            <div class="code-number">2202</div>
                            <div class="code-name">Out of State<br>Sales</div>
                        </div>
                        <div class="tax-option" onclick="selectTaxCode('2203')" data-code="2203">
                            <div class="code-number">2203</div>
                            <div class="code-name">Wholesale<br>Sales</div>
                        </div>
                    </div>
                    
                    <button class="submit-btn" onclick="submitAnswer()" disabled id="submitBtn">
                        <i class="fas fa-check"></i> Submit Answer
                    </button>
                </div>

                <div class="feedback" id="feedback"></div>

                <div class="hint-section" style="display: none;" id="hintSection">
                    <div class="hint-title">💡 Hint:</div>
                    <div id="hintText"></div>
                </div>
            `;

            updateProgress();
            updateScenarioCounter();
        }

        function selectTaxCode(code) {
            selectedTaxCode = code;
            
            // Clear previous selections
            document.querySelectorAll('.tax-option').forEach(option => {
                option.classList.remove('selected');
            });
            
            // Highlight selected option
            document.querySelector(`[data-code="${code}"]`).classList.add('selected');
            
            // Enable submit button
            document.getElementById('submitBtn').disabled = false;
        }

        function submitAnswer() {
            const scenario = taxScenarios[currentScenarioIndex];
            const feedback = document.getElementById('feedback');
            const isCorrect = selectedTaxCode === scenario.expectedTaxCode;

            // Update visual feedback on options
            document.querySelectorAll('.tax-option').forEach(option => {
                const optionCode = option.getAttribute('data-code');
                option.classList.remove('selected');
                
                if (optionCode === scenario.expectedTaxCode) {
                    option.classList.add('correct');
                } else if (optionCode === selectedTaxCode && !isCorrect) {
                    option.classList.add('incorrect');
                }
            });

            if (isCorrect) {
                score++;
                feedback.className = 'feedback success';
                feedback.style.display = 'block';
                feedback.innerHTML = `
                    <strong><i class="fas fa-check-circle"></i> Correct!</strong><br>
                    ${scenario.explanation}
                `;
            } else {
                feedback.className = 'feedback error';
                feedback.style.display = 'block';
                feedback.innerHTML = `
                    <strong><i class="fas fa-times-circle"></i> Incorrect.</strong><br>
                    The correct answer is <strong>${scenario.expectedTaxCode}</strong>.<br>
                    ${scenario.explanation}
                `;
                
                // Show hint section
                showHint();
            }

            updateScore();
            
            // Show next scenario button or completion
            setTimeout(() => {
                if (currentScenarioIndex < taxScenarios.length - 1) {
                    feedback.innerHTML += `
                        <button class="next-scenario-btn" onclick="nextScenario()">
                            <i class="fas fa-arrow-right"></i> Next Scenario
                        </button>
                    `;
                } else {
                    showCompletion();
                }
            }, 1500);

            // Disable submit button
            document.getElementById('submitBtn').disabled = true;
        }

        function showHint() {
            const scenario = taxScenarios[currentScenarioIndex];
            const hintSection = document.getElementById('hintSection');
            const hintText = document.getElementById('hintText');
            
            let hint = "";
            
            if (scenario.hasResaleCert) {
                hint = "When a customer has a valid resale certificate, they are buying for resale and are tax exempt. Use code 2203.";
            } else if (scenario.location.includes('WA')) {
                hint = "Washington state customers without resale certificates pay standard WA sales tax. Use code 2200.";
            } else {
                hint = "Out-of-state customers without resale certificates still pay sales tax. Use code 2202.";
            }
            
            hintText.textContent = hint;
            hintSection.style.display = 'block';
        }

        function nextScenario() {
            currentScenarioIndex++;
            selectedTaxCode = null;
            
            // Clear option states
            document.querySelectorAll('.tax-option').forEach(option => {
                option.className = 'tax-option';
            });
            
            displayScenario();
        }

        function updateProgress() {
            const progress = ((currentScenarioIndex) / taxScenarios.length) * 100;
            document.getElementById('progressFill').style.width = progress + '%';
        }

        function updateScore() {
            document.getElementById('scoreValue').textContent = score;
        }

        function updateScenarioCounter() {
            document.getElementById('currentScenario').textContent = currentScenarioIndex + 1;
        }

        function showCompletion() {
            document.getElementById('gameSection').style.display = 'none';
            document.getElementById('completionSection').style.display = 'block';
            document.getElementById('finalScore').textContent = score;
            document.getElementById('progressFill').style.width = '100%';
        }

        function restartTraining() {
            currentScenarioIndex = 0;
            score = 0;
            selectedTaxCode = null;
            
            document.getElementById('gameSection').style.display = 'block';
            document.getElementById('completionSection').style.display = 'none';
            
            updateScore();
            displayScenario();
        }

        // Initialize the training
        displayScenario();
