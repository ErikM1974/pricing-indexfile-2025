/* Page-owned training controller. Sample lesson data is preserved. */
(function () {
    'use strict';
    /* shopworks-customer-setup.js — page script (extracted from inline <script>, 2026.09.05.11) */

    // ── moved from inline <script> in training/shopworks-customer-setup.html (Rule 3, 2026.09.05.11) ──
    // Game state
    let currentMode = null;
    let currentScore = 0;
    let currentStreak = 0;
    let bestScore = 0;
    let storageUsable = true;
    function storageWarning() {
        const el = document.getElementById('storage-status');
        el.hidden = false;
        el.textContent =
            'Saved training progress is unavailable. You can practice in this tab; scores will not be saved.';
    }
    try {
        const saved = window.localStorage.getItem('shopworksBestScore');
        if (saved !== null && (!/^\d+$/.test(saved) || !Number.isSafeInteger(Number(saved))))
            throw new Error('Invalid score');
        bestScore = Number(saved || 0);
    } catch {
        storageUsable = false;
        storageWarning();
    }
    let currentLevel = 1;
    let currentQuestion = 0;
    let timer = null;
    let answered = false;
    let speedCorrect = '2200';
    let pending = null;
    function stopRound() {
        window.clearInterval(timer);
        timer = null;
        window.clearTimeout(pending);
        pending = null;
    }
    window.addEventListener('pagehide', stopRound);

    // Update score display
    document.getElementById('bestScore').textContent = bestScore;

    // Explorer mode questions
    const explorerQuestions = [
        {
            question: 'What tax code should be used for a business located in Seattle, Washington?',
            correctAnswer: '2200',
            hint: 'Seattle is in Washington State, so use the Washington State Sales Tax code.',
        },
        {
            question: 'A wholesale distributor with a reseller permit needs to be set up. Which tax code?',
            correctAnswer: '2203',
            hint: 'Wholesale businesses with tax exemption use 2203 - Wholesale Sales.',
        },
        {
            question: 'What tax code applies to a business located in Portland, Oregon?',
            correctAnswer: '2202',
            hint: 'Oregon is outside Washington State, so use Out of State Sales.',
        },
        {
            question: 'A retail store in Tacoma, Washington needs setup. What tax code?',
            correctAnswer: '2200',
            hint: 'Tacoma is in Washington State, so use 2200.',
        },
        {
            question: 'What tax code for a tax-exempt nonprofit in California?',
            correctAnswer: '2203',
            hint: 'Tax-exempt organizations use 2203 - Wholesale Sales.',
        },
        {
            question: 'A business in Phoenix, Arizona needs to be configured. Which tax code?',
            correctAnswer: '2202',
            hint: 'Arizona is outside Washington State, so use 2202.',
        },
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
                salesperson: 'Taylar',
            },
        },
        {
            company: 'Portland Medical Center',
            location: 'Portland, OR',
            industry: 'Healthcare',
            correct: {
                taxCode: '2202',
                customerType: 'Medical',
                salesperson: 'Ruth',
            },
        },
        {
            company: 'Wholesale Apparel Distributors',
            location: 'Los Angeles, CA',
            industry: 'Wholesale',
            correct: {
                taxCode: '2203',
                customerType: 'Retail',
                salesperson: 'Nika',
            },
        },
    ];

    function startMode(mode) {
        stopRound();
        currentMode = mode;
        answered = false;
        currentScore = 0;
        currentStreak = 0;
        updateScores();
        document.querySelectorAll('.mode-card').forEach((button) => {
            const selected = JSON.parse(button.dataset.simArgs || '[]')[0] === mode;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        document.getElementById('gameArea').classList.add('active');
        ({
            explorer: startFieldExplorer,
            simulator: startSetupSimulator,
            detective: startFieldDetective,
            speed: startSpeedChallenge,
        })[mode]();
        focusGame();
    }
    function focusGame() {
        const heading = document.querySelector('#gameArea h2');
        if (heading) {
            heading.tabIndex = -1;
            heading.focus();
        }
    }
    function lockAnswer() {
        if (answered) return false;
        answered = true;
        document.querySelectorAll('#gameArea .option-btn').forEach((button) => (button.disabled = true));
        return true;
    }

    function startFieldExplorer() {
        answered = false;
        const gameArea = document.getElementById('gameArea');
        const question = explorerQuestions[currentExplorerQuestion % explorerQuestions.length];

        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.
        // eslint-disable-next-line no-unsanitized/property
        gameArea.innerHTML = `
                <h2>🔍 Field Explorer Mode</h2>
                <p>Learn about each field used in Shopworks customer setup. Question ${(currentExplorerQuestion % explorerQuestions.length) + 1} of ${explorerQuestions.length}</p>
                
                <div class="question-container">
                    <div class="question">
                        ${question.question}
                    </div>
                    
                    <div class="options-grid">
                        <button class="btn option-btn" data-sim-call="checkExplorerAnswer" data-sim-args='["2200","${question.correctAnswer}"]'>
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
                        <button class="btn option-btn" data-sim-call="checkExplorerAnswer" data-sim-args='["2202","${question.correctAnswer}"]'>
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
                        <button class="btn option-btn" data-sim-call="checkExplorerAnswer" data-sim-args='["2203","${question.correctAnswer}"]'>
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
                                <small>Exempt #: A353-456-3456 | Exp: 8/1/28</small>
                            </div>
                        </button>
                    </div>
                    
                    <div class="hint-box" id="hintBox">
                        <h4>💡 Hint</h4>
                        <p>${question.hint}</p>
                    </div>
                </div>
                
                <div class="feedback" id="feedback" role="status"></div>
                
                <div class="action-buttons">
                    <button class="btn btn-secondary" data-sim-call="showHint" data-sim-args='[]'>Show Hint</button>
                    <button class="btn btn-primary" data-sim-call="nextExplorerQuestion" data-sim-args='[]'>Next Question</button>
                </div>
            `;
    }

    function startSetupSimulator() {
        answered = false;
        const scenario = scenarios[currentQuestion % scenarios.length];
        const gameArea = document.getElementById('gameArea');

        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.
        // eslint-disable-next-line no-unsanitized/property
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
                            <label for="taxCode">Tax Code *</label>
                            <select class="field-select" id="taxCode" data-setup-field="taxCode">
                                <option value="">Select...</option>
                                <option value="2200">2200 - Washington State Sales Tax</option>
                                <option value="2202">2202 - Out of State Sales</option>
                                <option value="2203">2203 - Wholesale Sales</option>
                            </select>
                            <div id="taxCodeDisplay" class="tax-code-display" hidden>
                                <!-- Tax code details will be shown here -->
                            </div>
                        </div>
                        
                        <div class="form-field">
                            <label for="customerType">Customer Type *</label>
                            <select class="field-select" id="customerType" data-setup-field="customerType">
                                <option value="">Select...</option>
                                ${fieldDefinitions.customerType.options
                                    .map((opt) => `<option value="${opt}">${opt}</option>`)
                                    .join('')}
                            </select>
                        </div>
                        
                        <div class="form-field">
                            <label for="salesperson">Salesperson *</label>
                            <select class="field-select" id="salesperson" data-setup-field="salesperson">
                                <option value="">Select...</option>
                                ${fieldDefinitions.salesperson.options
                                    .map((opt) => `<option value="${opt}">${opt}</option>`)
                                    .join('')}
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="feedback" id="feedback" role="status"></div>
                
                <div class="action-buttons">
                    <button class="btn btn-primary" data-sim-call="submitSetup" data-sim-args='[]'>Submit Setup</button>
                </div>
            `;
    }

    function startFieldDetective() {
        answered = false;
        const gameArea = document.getElementById('gameArea');
        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.

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
                        • Tax Code: <span class="simulator-error">2200</span> (Washington State Sales Tax)<br>
                        • Customer Type: Corporate<br>
                        • Salesperson: Erik
                    </div>
                    
                    <div class="options-grid">
                        <button class="btn option-btn" data-sim-call="detectiveAnswer" data-sim-args='["taxCode"]'>Tax Code is wrong</button>
                        <button class="btn option-btn" data-sim-call="detectiveAnswer" data-sim-args='["customerType"]'>Customer Type is wrong</button>
                        <button class="btn option-btn" data-sim-call="detectiveAnswer" data-sim-args='["salesperson"]'>Salesperson is wrong</button>
                        <button class="btn option-btn" data-sim-call="detectiveAnswer" data-sim-args='["none"]'>Everything is correct</button>
                    </div>
                </div>
                
                <div class="feedback" id="feedback" role="status"></div>
                
                <div class="action-buttons">
                    <button class="btn btn-primary" data-sim-call="nextDetectiveCase" data-sim-args='[]'>Next Case</button>
                </div>
            `;
    }

    function startSpeedChallenge() {
        stopRound();
        answered = false;
        speedCorrect = '2200';
        currentScore = 0;
        currentStreak = 0;
        updateScores();
        const gameArea = document.getElementById('gameArea');
        let timeLeft = 60;
        const deadline = Date.now() + 60000;

        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.

        gameArea.innerHTML = `
                <h2>⚡ Speed Challenge</h2>
                <label for="timerFill">Time remaining</label><progress id="timerFill" max="60" value="60"></progress><span id="timeRemaining">60 seconds</span>
                
                <div class="question-container">
                    <div class="question">
                        Quick! A business in Tacoma, Washington needs setup. What tax code?
                    </div>
                    
                    <div class="options-grid">
                        <button class="btn option-btn" data-sim-call="speedAnswer" data-sim-args='["2200"]'>2200</button>
                        <button class="btn option-btn" data-sim-call="speedAnswer" data-sim-args='["2202"]'>2202</button>
                        <button class="btn option-btn" data-sim-call="speedAnswer" data-sim-args='["2203"]'>2203</button>
                    </div>
                </div>
                
                <div class="feedback" id="feedback" role="status"></div>
            `;

        // Start timer
        timer = window.setInterval(() => {
            timeLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            document.getElementById('timerFill').value = timeLeft;
            document.getElementById('timeRemaining').textContent = timeLeft + ' seconds';

            if (timeLeft <= 0) {
                window.clearInterval(timer);
                endSpeedChallenge();
            }
        }, 1000);
    }

    function checkAnswer(selected, correct, button) {
        checkExplorerAnswer(selected, correct, button);
    }

    function checkExplorerAnswer(selected, correct, button) {
        if (!lockAnswer()) return;
        const feedback = document.getElementById('feedback');

        if (selected === correct) {
            currentScore += 10;
            currentStreak++;
            feedback.className = 'feedback correct show';
            feedback.textContent = `✅ Correct! ${fieldDefinitions.taxCode.rules[correct]} is the right choice.`;
            button.classList.add('correct');
        } else {
            currentStreak = 0;
            feedback.className = 'feedback incorrect show';
            feedback.textContent = `❌ Not quite. The correct answer is ${correct} - ${fieldDefinitions.taxCode.rules[correct]}`;
            button.classList.add('incorrect');
        }

        updateScores();
    }

    function validateField(fieldId, correctValue) {
        const field = document.getElementById(fieldId);
        if (field.value === correctValue) {
            field.classList.add('correct');
            field.classList.remove('incorrect');
            field.setAttribute('aria-invalid', 'false');
        } else {
            field.classList.add('incorrect');
            field.setAttribute('aria-invalid', 'true');
            field.classList.remove('correct');
        }
    }

    function submitSetup() {
        if (answered) return;
        const scenario = scenarios[currentQuestion % scenarios.length];
        const taxCode = document.getElementById('taxCode').value;
        const customerType = document.getElementById('customerType').value;
        const salesperson = document.getElementById('salesperson').value;

        const feedback = document.getElementById('feedback');

        if (
            taxCode === scenario.correct.taxCode &&
            customerType === scenario.correct.customerType &&
            salesperson === scenario.correct.salesperson
        ) {
            answered = true;
            document.querySelector('#gameArea [data-sim-call="submitSetup"]').disabled = true;
            currentScore += 25;
            currentStreak++;
            feedback.className = 'feedback correct show';
            feedback.textContent = '✅ Perfect setup! All fields are correct!';

            pending = window.setTimeout(() => {
                currentQuestion++;
                startSetupSimulator();
                focusGame();
            }, 2000);
        } else {
            currentStreak = 0;
            feedback.className = 'feedback incorrect show';
            feedback.textContent = '❌ Some fields need correction. Check the highlighted fields.';
            Object.entries(scenario.correct).forEach(([id, value]) => validateField(id, value));
        }

        updateScores();
    }

    function detectiveAnswer(selected) {
        if (!lockAnswer()) return;
        const feedback = document.getElementById('feedback');

        if (selected === 'taxCode') {
            currentScore += 15;
            currentStreak++;
            feedback.className = 'feedback correct show';
            feedback.textContent =
                '✅ Correct! California businesses should use 2202 (Out of State Sales), not 2200 (Washington State).';
        } else {
            currentStreak = 0;
            feedback.className = 'feedback incorrect show';
            feedback.textContent = '❌ Look closer at the tax code. California is not in Washington State!';
        }

        updateScores();
    }

    function speedAnswer(selected) {
        if (currentMode !== 'speed' || !timer || !lockAnswer()) return;
        const correct = selected === speedCorrect,
            feedback = document.getElementById('feedback');
        if (correct) {
            currentScore += 5;
            currentStreak++;
        } else currentStreak = 0;
        feedback.className = 'feedback ' + (correct ? 'correct' : 'incorrect') + ' show';
        feedback.textContent = correct
            ? '✅ Quick and correct!'
            : '❌ The correct answer is ' + speedCorrect + ' — ' + fieldDefinitions.taxCode.rules[speedCorrect];
        updateScores();
        pending = window.setTimeout(generateSpeedQuestion, 1000);
    }

    function generateSpeedQuestion() {
        const questions = [
            { q: 'Business in Portland, Oregon?', a: '2202' },
            { q: 'Business in Seattle, Washington?', a: '2200' },
            { q: 'Wholesale distributor in California?', a: '2203' },
            { q: 'Business in Spokane, Washington?', a: '2200' },
            { q: 'Business in Phoenix, Arizona?', a: '2202' },
            { q: 'Tax-exempt reseller in Texas?', a: '2203' },
            { q: 'Business in Olympia, Washington?', a: '2200' },
            { q: 'Business in Denver, Colorado?', a: '2202' },
        ];

        const question = questions[Math.floor(Math.random() * questions.length)];

        document.querySelector('.question').textContent = question.q;
        answered = false;
        speedCorrect = question.a;
        document.getElementById('feedback').textContent = '';
        // Update the current round's choices
        document.querySelectorAll('.option-btn').forEach((btn, i) => {
            const codes = ['2200', '2202', '2203'];
            btn.disabled = false;
            btn.dataset.simCall = 'speedAnswer';
            btn.dataset.simArgs = JSON.stringify([codes[i]]);
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
        stopRound();
        answered = true;
        const gameArea = document.getElementById('gameArea');
        // Fixed local lesson markup / numeric scores only; learner input is never interpolated.
        // eslint-disable-next-line no-unsanitized/property
        gameArea.innerHTML = `
                <h2>⚡ Speed Challenge Complete!</h2>
                <div class="question">
                    <h3>Final Score: ${currentScore}</h3>
                    <p>Great job! You've completed the speed challenge.</p>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-primary" data-sim-call="startSpeedChallenge" data-sim-args='[]'>Try Again</button>
                    <button class="btn btn-secondary" data-sim-call="mainMenu">Main Menu</button>
                </div>
            `;
    }

    function updateScores() {
        document.getElementById('currentScore').textContent = currentScore;
        document.getElementById('streak').textContent = currentStreak;

        if (currentScore > bestScore) {
            bestScore = currentScore;
            if (storageUsable)
                try {
                    window.localStorage.setItem('shopworksBestScore', String(bestScore));
                } catch {
                    storageUsable = false;
                    storageWarning();
                }
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
            display.hidden = true;
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
                html += `<span><span class="indicator-icon search">🔍</span> Pay Sales Tax</span>`;
            }

            if (details.shippingTaxable) {
                html += `<span><span class="indicator-icon active">✓</span> Shipping Taxable</span>`;
            } else {
                html += `<span><span class="indicator-icon inactive">✗</span> No Shipping Tax</span>`;
            }

            if (details.taxExempt) {
                html += `<span><span class="indicator-icon active">✓</span> Tax Exempt</span>`;
            }

            html += `</div>`;

            if (details.exemptNumber) {
                html += `<div>Exempt #: ${details.exemptNumber} | Expires: ${details.expirationDate}</div>`;
            }

            // Fixed local lesson markup / numeric scores only; learner input is never interpolated.
            // eslint-disable-next-line no-unsanitized/property
            display.innerHTML = html;
            display.hidden = false;
        }
    }

    function mainMenu() {
        stopRound();
        window.location.reload();
    }
    const actions = {
        startMode,
        startFieldExplorer,
        startSetupSimulator,
        startFieldDetective,
        startSpeedChallenge,
        checkAnswer,
        checkExplorerAnswer,
        submitSetup,
        detectiveAnswer,
        speedAnswer,
        showHint,
        nextQuestion,
        nextExplorerQuestion,
        nextDetectiveCase,
        mainMenu,
    };
    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-sim-call]');
        if (!button) return;
        const action = actions[button.dataset.simCall];
        if (action) {
            action(...JSON.parse(button.dataset.simArgs || '[]'), button);
            if (/^next/.test(button.dataset.simCall)) focusGame();
        }
    });
    document.addEventListener('change', (event) => {
        const id = event.target.dataset.setupField;
        if (id) {
            validateField(id, scenarios[currentQuestion % scenarios.length].correct[id]);
            if (id === 'taxCode') updateTaxDisplay(event.target.value);
        }
    });
})();
