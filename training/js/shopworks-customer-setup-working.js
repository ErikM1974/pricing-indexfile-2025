/* shopworks-customer-setup-working.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in training/shopworks-customer-setup-working.html (Rule 3, 2026.09.05.11) ──
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

        // Field definitions with business rules
        const fieldDefinitions = {
            taxCode: {
                label: 'Tax Code',
                rules: {
                    '2200': 'Business in Vancouver (CAN)',
                    '2202': 'Business outside Vancouver (CAN)',
                    '2203': 'Business in USA'
                },
                hint: 'Based on business location, not ship-to address'
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
                    taxCode: '2203',
                    customerType: 'Construction',
                    salesperson: 'Taylar'
                }
            },
            {
                company: 'Vancouver General Hospital',
                location: 'Vancouver, BC',
                industry: 'Healthcare',
                correct: {
                    taxCode: '2200',
                    customerType: 'Medical',
                    salesperson: 'Ruth'
                }
            },
            {
                company: 'Surrey School District',
                location: 'Surrey, BC',
                industry: 'Education',
                correct: {
                    taxCode: '2202',
                    customerType: 'School',
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
            gameArea.innerHTML = `
                <h2>🔍 Field Explorer Mode</h2>
                <p>Learn about each field used in Shopworks customer setup.</p>
                
                <div class="question-container">
                    <div class="question">
                        What tax code should be used for a business located in Seattle, Washington?
                    </div>
                    
                    <div class="options-grid">
                        <button class="option-btn" onclick="checkAnswer('2200', '2203')">2200 - Vancouver</button>
                        <button class="option-btn" onclick="checkAnswer('2202', '2203')">2202 - Outside Vancouver</button>
                        <button class="option-btn" onclick="checkAnswer('2203', '2203')">2203 - USA</button>
                    </div>
                    
                    <div class="hint-box" id="hintBox">
                        <h4>💡 Hint</h4>
                        <p>Remember: Tax codes are based on the business location, not shipping address. USA businesses always use 2203.</p>
                    </div>
                </div>
                
                <div class="feedback" id="feedback"></div>
                
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="showHint()">Show Hint</button>
                    <button class="btn btn-primary" onclick="nextQuestion()">Next Question</button>
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
                            <select id="taxCode" onchange="validateField('taxCode', '${scenario.correct.taxCode}')">
                                <option value="">Select...</option>
                                <option value="2200">2200 - Vancouver</option>
                                <option value="2202">2202 - Outside Vancouver</option>
                                <option value="2203">2203 - USA</option>
                            </select>
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
                        <strong>Company:</strong> Toronto Tech Solutions<br>
                        <strong>Location:</strong> Toronto, ON, Canada<br>
                        <strong>Current Setup:</strong><br>
                        • Tax Code: <span style="color: red; font-weight: bold;">2200</span> (Vancouver)<br>
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
                        Quick! A business in Portland, Oregon needs setup. What tax code?
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
                feedback.innerHTML = '✅ Correct! Toronto is outside Vancouver, so it should be 2202, not 2200.';
            } else {
                currentStreak = 0;
                feedback.className = 'feedback incorrect show';
                feedback.innerHTML = '❌ Look closer at the tax code. Toronto is not in Vancouver!';
            }
            
            updateScores();
        }

        function speedAnswer(selected) {
            const feedback = document.getElementById('feedback');
            
            if (selected === '2203') {
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
                feedback.innerHTML = '❌ Portland is in the USA - use 2203';
            }
            
            updateScores();
        }

        function generateSpeedQuestion() {
            const questions = [
                { q: "Business in Calgary, Alberta?", a: "2202" },
                { q: "Business in Vancouver, BC?", a: "2200" },
                { q: "Business in Los Angeles, CA?", a: "2203" },
                { q: "Business in Burnaby, BC?", a: "2200" },
                { q: "Business in Edmonton, AB?", a: "2202" }
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
