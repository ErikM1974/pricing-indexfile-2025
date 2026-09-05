/* shopworks-customer-setup.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in training/shopworks-customer-setup.html (Rule 3, 2026.09.05.11) ──
// Game state
        let currentMode = null;
        let currentScore = 0;
        let currentStreak = 0;
        let bestScore = localStorage.getItem('shopworksBestScore') || 0;
        let currentLevel = 1;
        let currentQuestion = 0;
        let timer = null;

        // Update score display
        document.getElementById('bestScore').textContent = bestScore;
        
        // Explorer mode questions
        const explorerQuestions = [
            {
                question: "What tax code should be used for a business located in Seattle, Washington?",
                correctAnswer: '2200',
                hint: "Seattle is in Washington State, so use the Washington State Sales Tax code."
            },
            {
                question: "A wholesale distributor with a reseller permit needs to be set up. Which tax code?",
                correctAnswer: '2203',
                hint: "Wholesale businesses with tax exemption use 2203 - Wholesale Sales."
            },
            {
                question: "What tax code applies to a business located in Portland, Oregon?",
                correctAnswer: '2202',
                hint: "Oregon is outside Washington State, so use Out of State Sales."
            },
            {
                question: "A retail store in Tacoma, Washington needs setup. What tax code?",
                correctAnswer: '2200',
                hint: "Tacoma is in Washington State, so use 2200."
            },
            {
                question: "What tax code for a tax-exempt nonprofit in California?",
                correctAnswer: '2203',
                hint: "Tax-exempt organizations use 2203 - Wholesale Sales."
            },
            {
                question: "A business in Phoenix, Arizona needs to be configured. Which tax code?",
                correctAnswer: '2202',
                hint: "Arizona is outside Washington State, so use 2202."
            }
        ];
        
        let currentExplorerQuestion = 0;

        // Field definitions with business rules
        const fieldDefinitions = {
            taxCode: {
                label: 'Tax Code',
                rules: {
                    '2200': 'Washington State Sales Tax',
                    '2202': 'Out of State Sales',
                    '2203': 'Wholesale Sales'
                },
                details: {
                    '2200': {
                        name: 'Washington State Sales Tax',
                        paySalesTax: true,
                        shippingTaxable: true,
                        taxExempt: false,
                        description: 'For businesses located in Washington State'
                    },
                    '2202': {
                        name: 'Out of State Sales',
                        paySalesTax: true,
                        shippingTaxable: true,
                        taxExempt: false,
                        description: 'For businesses located outside Washington State'
                    },
                    '2203': {
                        name: 'Wholesale Sales',
                        paySalesTax: true,
                        shippingTaxable: false,
                        taxExempt: true,
                        exemptNumber: 'A353-456-3456',
                        expirationDate: '8/1/28',
                        description: 'For wholesale/reseller accounts with tax exemption'
                    }
                },
                hint: 'Based on business location and tax status'
            },
            salesperson: {
                label: 'Salesperson',
                options: ['Ruth', 'Taylar', 'Nika', 'Adriyella', 'Erik', 'Jim', 'Steve'],
                hint: 'Assign based on account ownership or territory'
            },
            customerType: {
                label: 'Customer Type',
                options: ['Construction', 'Medical', 'School', 'Corporate', 'Restaurant', 'Retail', 'Non-Profit'],
                hint: 'Primary industry or business sector'
            },
            creditTerms: {
                label: 'Credit Terms',
                options: ['Net 30', 'Net 15', 'Due on Receipt', 'Credit Card', '2/10 Net 30'],
                hint: 'Payment terms based on credit approval'
            }
        };

        // Sample scenarios for practice
        const scenarios = [
            {
                company: 'BlackStone Construction',
                location: 'Seattle, WA',
                industry: 'Construction',
                correct: {
                    taxCode: '2200',
                    customerType: 'Construction',
                    salesperson: 'Taylar'
                }
            },
            {
                company: 'Portland Medical Center',
                location: 'Portland, OR',
                industry: 'Healthcare',
                correct: {
                    taxCode: '2202',
                    customerType: 'Medical',
                    salesperson: 'Ruth'
                }
            },
            {
                company: 'Wholesale Apparel Distributors',
                location: 'Los Angeles, CA',
                industry: 'Wholesale',
                correct: {
                    taxCode: '2203',
                    customerType: 'Retail',
                    salesperson: 'Nika'
                }
            }
        ];

        function startMode(mode) {
            currentMode = mode;
            currentQuestion = 0;
            
            // Update UI
            document.querySelectorAll('.mode-card').forEach(card => {
                card.classList.remove('active');
            });
            event.target.closest('.mode-card').classList.add('active');
            
            const gameArea = document.getElementById('gameArea');
            gameArea.classList.add('active');
            
            // Start the selected mode
            switch(mode) {
                case 'explorer':
                    startFieldExplorer();
                    break;
                case 'simulator':
                    startSetupSimulator();
                    break;
                case 'detective':
                    startFieldDetective();
                    break;
                case 'speed':
                    startSpeedChallenge();
                    break;
            }
        }

        function startFieldExplorer() {
            const gameArea = document.getElementById('gameArea');
            const question = explorerQuestions[currentExplorerQuestion % explorerQuestions.length];
            
            gameArea.innerHTML = `
                <h2>🔍 Field Explorer Mode</h2>
                <p>Learn about each field used in Shopworks customer setup. Question ${(currentExplorerQuestion % explorerQuestions.length) + 1} of ${explorerQuestions.length}</p>
                
                <div class="question-container">
                    <div class="question">
                        ${question.question}
                    </div>
                    
                    <div class="options-grid">
                        <button class="option-btn" onclick="checkExplorerAnswer('2200', '${question.correctAnswer}')">
                            <div class="tax-code-option">
                                <div class="tax-code-header">
                                    <span class="tax-code-number">2200</span>
                                    <span>Washington State Sales Tax</span>
                                </div>
                                <div class="tax-indicators">
                                    <span class="tax-indicator">
                                        <span class="indicator-icon search">🔍</span>
                                        <span>Pay Sales Tax</span>
                                    </span>
                                    <span class="tax-indicator">
                                        <span class="indicator-icon active">✓</span>
                                        <span>Shipping Taxable</span>
                                    </span>
                                </div>
                            </div>
                        </button>
                        <button class="option-btn" onclick="checkExplorerAnswer('2202', '${question.correctAnswer}')">
                            <div class="tax-code-option">
                                <div class="tax-code-header">
                                    <span class="tax-code-number">2202</span>
                                    <span>Out of State Sales</span>
                                </div>
                                <div class="tax-indicators">
                                    <span class="tax-indicator">
                                        <span class="indicator-icon search">🔍</span>
                                        <span>Pay Sales Tax</span>
                                    </span>
                                    <span class="tax-indicator">
                                        <span class="indicator-icon active">✓</span>
                                        <span>Shipping Taxable</span>
                                    </span>
                                </div>
                            </div>
                        </button>
                        <button class="option-btn" onclick="checkExplorerAnswer('2203', '${question.correctAnswer}')">
                            <div class="tax-code-option">
                                <div class="tax-code-header">
                                    <span class="tax-code-number">2203</span>
                                    <span>Wholesale Sales</span>
                                </div>
                                <div class="tax-indicators">
                                    <span class="tax-indicator">
                                        <span class="indicator-icon active">✓</span>
                                        <span>Tax Exempt</span>
                                    </span>
                                    <span class="tax-indicator">
                                        <span class="indicator-icon inactive">✗</span>
                                        <span>Shipping Taxable</span>
                                    </span>
                                </div>
                                <small style="color: #666; margin-top: 4px;">Exempt #: A353-456-3456 | Exp: 8/1/28</small>
                            </div>
                        </button>
                    </div>
                    
                    <div class="hint-box" id="hintBox">
                        <h4>💡 Hint</h4>
                        <p>${question.hint}</p>
                    </div>
                </div>
                
                <div class="feedback" id="feedback"></div>
                
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="showHint()">Show Hint</button>
                    <button class="btn btn-primary" onclick="nextExplorerQuestion()">Next Question</button>
                </div>
            `;
        }

        function startSetupSimulator() {
            const scenario = scenarios[currentQuestion % scenarios.length];
            const gameArea = document.getElementById('gameArea');
            
            gameArea.innerHTML = `
                <h2>💼 Setup Simulator</h2>
                <div class="progress-indicator">
                    ${scenarios.map((_, i) => `<div class="progress-dot ${i === currentQuestion ? 'active' : ''} ${i < currentQuestion ? 'completed' : ''}"></div>`).join('')}
                </div>
                
                <div class="shopworks-form">
                    <div class="shopworks-header">
                        <h3>New Customer Setup: ${scenario.company}</h3>
                    </div>
                    
                    <div class="question">
                        <strong>Company:</strong> ${scenario.company}<br>
                        <strong>Location:</strong> ${scenario.location}<br>
                        <strong>Industry:</strong> ${scenario.industry}
                    </div>
                    
                    <div class="input-group">
                        <div class="form-field">
                            <label>Tax Code *</label>
                            <select id="taxCode" onchange="validateField('taxCode', '${scenario.correct.taxCode}'); updateTaxDisplay(this.value)">
                                <option value="">Select...</option>
                                <option value="2200">2200 - Washington State Sales Tax</option>
                                <option value="2202">2202 - Out of State Sales</option>
                                <option value="2203">2203 - Wholesale Sales</option>
                            </select>
                            <div id="taxCodeDisplay" class="tax-code-display" style="display: none;">
                                <!-- Tax code details will be shown here -->
                            </div>
                        </div>
                        
                        <div class="form-field">
                            <label>Customer Type *</label>
                            <select id="customerType" onchange="validateField('customerType', '${scenario.correct.customerType}')">
                                <option value="">Select...</option>
                                ${fieldDefinitions.customerType.options.map(opt => 
                                    `<option value="${opt}">${opt}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <div class="form-field">
                            <label>Salesperson *</label>
                            <select id="salesperson" onchange="validateField('salesperson', '${scenario.correct.salesperson}')">
                                <option value="">Select...</option>
                                ${fieldDefinitions.salesperson.options.map(opt => 
                                    `<option value="${opt}">${opt}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="feedback" id="feedback"></div>
                
                <div class="action-buttons">
                    <button class="btn btn-primary" onclick="submitSetup()">Submit Setup</button>
                </div>
            `;
        }

        function startFieldDetective() {
            const gameArea = document.getElementById('gameArea');
            gameArea.innerHTML = `
                <h2>🕵️ Field Detective</h2>
                <p>Find and fix the error in this customer record!</p>
                
                <div class="shopworks-form">
                    <div class="shopworks-header">
                        <h3>Customer Record Review</h3>
                    </div>
                    
                    <div class="question">
                        <strong>Company:</strong> California Tech Solutions<br>
                        <strong>Location:</strong> San Francisco, CA<br>
                        <strong>Current Setup:</strong><br>
                        • Tax Code: <span style="color: red; font-weight: bold;">2200</span> (Washington State Sales Tax)<br>
                        • Customer Type: Corporate<br>
                        • Salesperson: Erik
                    </div>
                    
                    <div class="options-grid">
                        <button class="option-btn" onclick="detectiveAnswer('taxCode')">Tax Code is wrong</button>
                        <button class="option-btn" onclick="detectiveAnswer('customerType')">Customer Type is wrong</button>
                        <button class="option-btn" onclick="detectiveAnswer('salesperson')">Salesperson is wrong</button>
                        <button class="option-btn" onclick="detectiveAnswer('none')">Everything is correct</button>
                    </div>
                </div>
                
                <div class="feedback" id="feedback"></div>
                
                <div class="action-buttons">
                    <button class="btn btn-primary" onclick="nextDetectiveCase()">Next Case</button>
                </div>
            `;
        }

        function startSpeedChallenge() {
            const gameArea = document.getElementById('gameArea');
            let timeLeft = 60;
            
            gameArea.innerHTML = `
                <h2>⚡ Speed Challenge</h2>
                <div class="timer-bar">
                    <div class="timer-fill" id="timerFill" style="width: 100%"></div>
                </div>
                
                <div class="question-container">
                    <div class="question">
                        Quick! A business in Tacoma, Washington needs setup. What tax code?
                    </div>
                    
                    <div class="options-grid">
                        <button class="option-btn" onclick="speedAnswer('2200')">2200</button>
                        <button class="option-btn" onclick="speedAnswer('2202')">2202</button>
                        <button class="option-btn" onclick="speedAnswer('2203')">2203</button>
                    </div>
                </div>
                
                <div class="feedback" id="feedback"></div>
            `;
            
            // Start timer
            timer = setInterval(() => {
                timeLeft--;
                document.getElementById('timerFill').style.width = `${(timeLeft/60)*100}%`;
                
                if (timeLeft <= 0) {
                    clearInterval(timer);
                    endSpeedChallenge();
                }
            }, 1000);
        }

        function checkAnswer(selected, correct) {
            const feedback = document.getElementById('feedback');
            
            if (selected === correct) {
                currentScore += 10;
                currentStreak++;
                feedback.className = 'feedback correct show';
                feedback.innerHTML = '✅ Correct! Great job!';
                event.target.classList.add('correct');
            } else {
                currentStreak = 0;
                feedback.className = 'feedback incorrect show';
                feedback.innerHTML = '❌ Not quite. The correct answer is ' + correct;
                event.target.classList.add('incorrect');
            }
            
            updateScores();
        }
        
        function checkExplorerAnswer(selected, correct) {
            const feedback = document.getElementById('feedback');
            
            if (selected === correct) {
                currentScore += 10;
                currentStreak++;
                feedback.className = 'feedback correct show';
                feedback.innerHTML = `✅ Correct! ${fieldDefinitions.taxCode.rules[correct]} is the right choice.`;
                event.target.classList.add('correct');
            } else {
                currentStreak = 0;
                feedback.className = 'feedback incorrect show';
                feedback.innerHTML = `❌ Not quite. The correct answer is ${correct} - ${fieldDefinitions.taxCode.rules[correct]}`;
                event.target.classList.add('incorrect');
            }
            
            updateScores();
        }

        function validateField(fieldId, correctValue) {
            const field = document.getElementById(fieldId);
            if (field.value === correctValue) {
                field.classList.add('correct');
                field.classList.remove('incorrect');
            } else if (field.value !== '') {
                field.classList.add('incorrect');
                field.classList.remove('correct');
            }
        }

        function submitSetup() {
            const scenario = scenarios[currentQuestion % scenarios.length];
            const taxCode = document.getElementById('taxCode').value;
            const customerType = document.getElementById('customerType').value;
            const salesperson = document.getElementById('salesperson').value;
            
            const feedback = document.getElementById('feedback');
            
            if (taxCode === scenario.correct.taxCode && 
                customerType === scenario.correct.customerType && 
                salesperson === scenario.correct.salesperson) {
                currentScore += 25;
                currentStreak++;
                feedback.className = 'feedback correct show';
                feedback.innerHTML = '✅ Perfect setup! All fields are correct!';
                
                setTimeout(() => {
                    currentQuestion++;
                    startSetupSimulator();
                }, 2000);
            } else {
                currentStreak = 0;
                feedback.className = 'feedback incorrect show';
                feedback.innerHTML = '❌ Some fields need correction. Check the highlighted fields.';
            }
            
            updateScores();
        }

        function detectiveAnswer(selected) {
            const feedback = document.getElementById('feedback');
            
            if (selected === 'taxCode') {
                currentScore += 15;
                currentStreak++;
                feedback.className = 'feedback correct show';
                feedback.innerHTML = '✅ Correct! California businesses should use 2202 (Out of State Sales), not 2200 (Washington State).';
            } else {
                currentStreak = 0;
                feedback.className = 'feedback incorrect show';
                feedback.innerHTML = '❌ Look closer at the tax code. California is not in Washington State!';
            }
            
            updateScores();
        }

        function speedAnswer(selected) {
            const feedback = document.getElementById('feedback');
            
            if (selected === '2200') {
                currentScore += 5;
                currentStreak++;
                feedback.className = 'feedback correct show';
                feedback.innerHTML = '✅ Quick and correct!';
                
                // Generate next speed question
                setTimeout(() => {
                    generateSpeedQuestion();
                }, 1000);
            } else {
                currentStreak = 0;
                feedback.className = 'feedback incorrect show';
                feedback.innerHTML = '❌ Tacoma is in Washington State - use 2200';
            }
            
            updateScores();
        }

        function generateSpeedQuestion() {
            const questions = [
                { q: "Business in Portland, Oregon?", a: "2202" },
                { q: "Business in Seattle, Washington?", a: "2200" },
                { q: "Wholesale distributor in California?", a: "2203" },
                { q: "Business in Spokane, Washington?", a: "2200" },
                { q: "Business in Phoenix, Arizona?", a: "2202" },
                { q: "Tax-exempt reseller in Texas?", a: "2203" },
                { q: "Business in Olympia, Washington?", a: "2200" },
                { q: "Business in Denver, Colorado?", a: "2202" }
            ];
            
            const question = questions[Math.floor(Math.random() * questions.length)];
            
            document.querySelector('.question').textContent = question.q;
            // Update onclick handlers with new correct answer
            document.querySelectorAll('.option-btn').forEach((btn, i) => {
                const codes = ['2200', '2202', '2203'];
                btn.onclick = () => speedAnswer(codes[i], question.a);
            });
        }

        function showHint() {
            document.getElementById('hintBox').classList.add('show');
        }

        function nextQuestion() {
            currentQuestion++;
            startFieldExplorer();
        }
        
        function nextExplorerQuestion() {
            currentExplorerQuestion++;
            startFieldExplorer();
        }

        function nextDetectiveCase() {
            currentQuestion++;
            startFieldDetective();
        }

        function endSpeedChallenge() {
            const gameArea = document.getElementById('gameArea');
            gameArea.innerHTML = `
                <h2>⚡ Speed Challenge Complete!</h2>
                <div class="question">
                    <h3>Final Score: ${currentScore}</h3>
                    <p>Great job! You've completed the speed challenge.</p>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-primary" onclick="startSpeedChallenge()">Try Again</button>
                    <button class="btn btn-secondary" onclick="location.reload()">Main Menu</button>
                </div>
            `;
        }

        function updateScores() {
            document.getElementById('currentScore').textContent = currentScore;
            document.getElementById('streak').textContent = currentStreak;
            
            if (currentScore > bestScore) {
                bestScore = currentScore;
                localStorage.setItem('shopworksBestScore', bestScore);
                document.getElementById('bestScore').textContent = bestScore;
            }
            
            // Update level based on score
            currentLevel = Math.floor(currentScore / 100) + 1;
            document.getElementById('level').textContent = currentLevel;
        }
        
        function updateTaxDisplay(taxCode) {
            const display = document.getElementById('taxCodeDisplay');
            if (!display) return;
            
            if (!taxCode) {
                display.style.display = 'none';
                return;
            }
            
            const details = fieldDefinitions.taxCode.details[taxCode];
            if (details) {
                let html = `
                    <div class="tax-code-display-header">
                        <span class="tax-code-number">${taxCode}</span>
                        <span>${details.name}</span>
                    </div>
                    <div class="tax-code-display-details">
                `;
                
                if (details.paySalesTax) {
                    html += `<span><span class="indicator-icon search" style="display: inline-block; width: 16px; height: 16px; text-align: center; font-size: 10px;">🔍</span> Pay Sales Tax</span>`;
                }
                
                if (details.shippingTaxable) {
                    html += `<span><span class="indicator-icon active" style="display: inline-block; width: 16px; height: 16px; text-align: center;">✓</span> Shipping Taxable</span>`;
                } else {
                    html += `<span><span class="indicator-icon inactive" style="display: inline-block; width: 16px; height: 16px; text-align: center;">✗</span> No Shipping Tax</span>`;
                }
                
                if (details.taxExempt) {
                    html += `<span><span class="indicator-icon active" style="display: inline-block; width: 16px; height: 16px; text-align: center;">✓</span> Tax Exempt</span>`;
                }
                
                html += `</div>`;
                
                if (details.exemptNumber) {
                    html += `<div style="margin-top: 8px; font-size: 0.85em; color: #666;">Exempt #: ${details.exemptNumber} | Expires: ${details.expirationDate}</div>`;
                }
                
                display.innerHTML = html;
                display.style.display = 'block';
            }
        }
