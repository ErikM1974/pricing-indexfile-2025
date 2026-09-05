/* sales-tax-code-trainer.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in training/sales-tax-code-trainer.html (Rule 3, 2026.09.05.11) ──
// Sales Tax Code Training Game
        class SalesTaxTrainer {
            constructor() {
                this.currentQuestion = 0;
                this.score = 0;
                this.streak = 0;
                this.maxStreak = 0;
                this.correct = 0;
                this.incorrect = 0;
                this.selectedOption = null;
                this.questions = this.generateQuestions();
                this.isAnswered = false;
                
                this.initializeElements();
                this.bindEvents();
            }

            initializeElements() {
                // Stats elements
                this.scoreDisplay = document.getElementById('scoreDisplay');
                this.streakDisplay = document.getElementById('streakDisplay');
                this.accuracyDisplay = document.getElementById('accuracyDisplay');
                this.progressDisplay = document.getElementById('progressDisplay');
                
                // Question elements
                this.questionNumber = document.getElementById('questionNumber');
                this.questionText = document.getElementById('questionText');
                this.scenarioText = document.getElementById('scenarioText');
                this.optionsGrid = document.getElementById('optionsGrid');
                
                // Feedback elements
                this.feedbackSection = document.getElementById('feedbackSection');
                this.feedbackMessage = document.getElementById('feedbackMessage');
                this.feedbackIcon = document.getElementById('feedbackIcon');
                this.feedbackTitle = document.getElementById('feedbackTitle');
                this.feedbackText = document.getElementById('feedbackText');
                
                // Control buttons
                this.startBtn = document.getElementById('startBtn');
                this.nextBtn = document.getElementById('nextBtn');
                this.submitBtn = document.getElementById('submitBtn');
                this.skipBtn = document.getElementById('skipBtn');
                
                // Progress bar
                this.progressBar = document.getElementById('progressBar');
                
                // Modal elements
                this.resultsModal = document.getElementById('resultsModal');
            }

            bindEvents() {
                this.startBtn.addEventListener('click', () => this.startGame());
                this.nextBtn.addEventListener('click', () => this.nextQuestion());
                this.submitBtn.addEventListener('click', () => this.submitAnswer());
                this.skipBtn.addEventListener('click', () => this.skipQuestion());
            }

            generateQuestions() {
                const taxCodes = {
                    'WAC': {
                        description: 'Washington Construction',
                        explanation: 'Used for construction companies and contractors working on buildings or infrastructure'
                    },
                    'WAM': {
                        description: 'Washington Manufacturing',
                        explanation: 'Applied to manufacturing and production companies creating physical goods'
                    },
                    'WAR': {
                        description: 'Washington Retail',
                        explanation: 'Standard retail sales tax for regular business purchases'
                    },
                    'WAW': {
                        description: 'Washington Wholesale',
                        explanation: 'Wholesale/reseller rate for businesses buying for resale'
                    },
                    'WARE': {
                        description: 'Washington Reseller Exempt',
                        explanation: 'Tax-exempt status for registered resellers with valid permits'
                    },
                    'WANP': {
                        description: 'Washington Non-Profit',
                        explanation: 'Tax-exempt status for registered 501(c)(3) organizations'
                    },
                    'OUT': {
                        description: 'Out of State',
                        explanation: 'No Washington tax collected for out-of-state shipments'
                    }
                };

                const scenarios = [
                    {
                        question: "What tax code should be used for this customer?",
                        scenario: "BlackStone Construction is ordering 50 safety shirts for their crew working on the new Seattle high-rise project. They are a licensed general contractor.",
                        correctCode: 'WAC',
                        explanation: "Construction companies like BlackStone Construction should use WAC (Washington Construction) code for their business purchases."
                    },
                    {
                        question: "Select the appropriate tax code for this order:",
                        scenario: "Seattle Children's Hospital Foundation, a registered 501(c)(3) non-profit, is ordering 200 t-shirts for their annual charity run.",
                        correctCode: 'WANP',
                        explanation: "Registered non-profit organizations with 501(c)(3) status use WANP (Washington Non-Profit) for tax-exempt purchases."
                    },
                    {
                        question: "Which tax code applies to this customer?",
                        scenario: "ABC Manufacturing in Tacoma is ordering uniforms for their factory workers. They produce automotive parts.",
                        correctCode: 'WAM',
                        explanation: "Manufacturing companies use WAM (Washington Manufacturing) code for their business purchases."
                    },
                    {
                        question: "What's the correct tax code for this situation?",
                        scenario: "Joe's T-Shirt Shop is buying 100 blank shirts to print and resell in their store. They have a valid reseller permit on file.",
                        correctCode: 'WARE',
                        explanation: "Resellers with valid permits buying inventory for resale use WARE (Washington Reseller Exempt) to avoid double taxation."
                    },
                    {
                        question: "Identify the tax code for this order:",
                        scenario: "A Portland, Oregon company is ordering 25 polos to be shipped to their Portland headquarters.",
                        correctCode: 'OUT',
                        explanation: "Orders shipped out of Washington State use OUT code - no Washington sales tax is collected."
                    },
                    {
                        question: "Select the appropriate tax code:",
                        scenario: "Northwest Dental Clinic is ordering 30 embroidered scrubs for their staff. They are a regular retail business.",
                        correctCode: 'WAR',
                        explanation: "Regular retail businesses like dental clinics use WAR (Washington Retail) for standard taxable purchases."
                    },
                    {
                        question: "What tax code should be applied?",
                        scenario: "Turner Construction is purchasing 75 high-visibility vests for their road construction project on I-5.",
                        correctCode: 'WAC',
                        explanation: "Construction companies working on infrastructure projects use WAC (Washington Construction) code."
                    },
                    {
                        question: "Choose the correct tax code:",
                        scenario: "Habitat for Humanity of King County needs 40 volunteer shirts for their next build. They provided their 501(c)(3) certificate.",
                        correctCode: 'WANP',
                        explanation: "Verified non-profit organizations like Habitat for Humanity use WANP for tax-exempt status."
                    },
                    {
                        question: "What's the right tax code here?",
                        scenario: "Costco Wholesale is ordering 500 branded caps through their procurement department for employee uniforms.",
                        correctCode: 'WAW',
                        explanation: "Large wholesale businesses typically use WAW (Washington Wholesale) for their corporate purchases."
                    },
                    {
                        question: "Identify the correct tax code:",
                        scenario: "Boeing's Everett facility is ordering 200 safety shirts for their assembly line workers.",
                        correctCode: 'WAM',
                        explanation: "Manufacturing facilities like Boeing use WAM (Washington Manufacturing) for their business purchases."
                    }
                ];

                // Shuffle scenarios
                return scenarios.sort(() => Math.random() - 0.5);
            }

            startGame() {
                this.currentQuestion = 0;
                this.score = 0;
                this.streak = 0;
                this.correct = 0;
                this.incorrect = 0;
                this.startBtn.style.display = 'none';
                this.submitBtn.style.display = 'inline-flex';
                this.skipBtn.style.display = 'inline-flex';
                this.loadQuestion();
                this.updateStats();
            }

            loadQuestion() {
                this.isAnswered = false;
                this.selectedOption = null;
                this.feedbackSection.classList.remove('show');
                
                const question = this.questions[this.currentQuestion];
                this.questionNumber.textContent = `Question ${this.currentQuestion + 1} of ${this.questions.length}`;
                this.questionText.textContent = question.question;
                this.scenarioText.textContent = question.scenario;
                
                // Create options
                const taxOptions = [
                    { code: 'WAC', desc: 'Washington Construction' },
                    { code: 'WAM', desc: 'Washington Manufacturing' },
                    { code: 'WAR', desc: 'Washington Retail' },
                    { code: 'WAW', desc: 'Washington Wholesale' },
                    { code: 'WARE', desc: 'Washington Reseller Exempt' },
                    { code: 'WANP', desc: 'Washington Non-Profit' },
                    { code: 'OUT', desc: 'Out of State' }
                ];
                
                // Shuffle options
                taxOptions.sort(() => Math.random() - 0.5);
                
                // Display options
                this.optionsGrid.innerHTML = '';
                taxOptions.forEach(option => {
                    const btn = document.createElement('button');
                    btn.className = 'option-btn';
                    btn.dataset.code = option.code;
                    btn.innerHTML = `
                        <div class="option-code">${option.code}</div>
                        <div class="option-description">${option.desc}</div>
                        <i class="option-icon fas"></i>
                    `;
                    btn.addEventListener('click', () => this.selectOption(btn));
                    this.optionsGrid.appendChild(btn);
                });
                
                // Update progress
                this.updateProgress();
            }

            selectOption(button) {
                if (this.isAnswered) return;
                
                // Remove previous selection
                document.querySelectorAll('.option-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
                
                // Select new option
                button.classList.add('selected');
                this.selectedOption = button.dataset.code;
            }

            submitAnswer() {
                if (!this.selectedOption || this.isAnswered) return;
                
                this.isAnswered = true;
                const question = this.questions[this.currentQuestion];
                const isCorrect = this.selectedOption === question.correctCode;
                
                // Update stats
                if (isCorrect) {
                    this.correct++;
                    this.score += 10;
                    this.streak++;
                    if (this.streak > this.maxStreak) this.maxStreak = this.streak;
                } else {
                    this.incorrect++;
                    this.streak = 0;
                }
                
                // Show feedback
                this.showFeedback(isCorrect, question);
                
                // Update button states
                this.submitBtn.style.display = 'none';
                this.skipBtn.style.display = 'none';
                
                if (this.currentQuestion < this.questions.length - 1) {
                    this.nextBtn.style.display = 'inline-flex';
                } else {
                    setTimeout(() => this.showResults(), 2000);
                }
                
                this.updateStats();
            }

            skipQuestion() {
                if (this.isAnswered) return;
                
                this.incorrect++;
                this.streak = 0;
                this.currentQuestion++;
                
                if (this.currentQuestion < this.questions.length) {
                    this.loadQuestion();
                } else {
                    this.showResults();
                }
                
                this.updateStats();
            }

            nextQuestion() {
                this.currentQuestion++;
                
                if (this.currentQuestion < this.questions.length) {
                    this.nextBtn.style.display = 'none';
                    this.submitBtn.style.display = 'inline-flex';
                    this.skipBtn.style.display = 'inline-flex';
                    this.loadQuestion();
                } else {
                    this.showResults();
                }
            }

            showFeedback(isCorrect, question) {
                // Mark options
                document.querySelectorAll('.option-btn').forEach(btn => {
                    if (btn.dataset.code === question.correctCode) {
                        btn.classList.add('correct');
                        btn.querySelector('.option-icon').classList.add('fa-check-circle');
                    } else if (btn.dataset.code === this.selectedOption && !isCorrect) {
                        btn.classList.add('incorrect');
                        btn.querySelector('.option-icon').classList.add('fa-times-circle');
                    }
                });
                
                // Show feedback message
                this.feedbackSection.classList.add('show');
                this.feedbackMessage.className = `feedback-message ${isCorrect ? 'success' : 'error'}`;
                this.feedbackIcon.className = `feedback-icon fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'}`;
                this.feedbackTitle.textContent = isCorrect ? 'Correct!' : `Incorrect - The answer is ${question.correctCode}`;
                this.feedbackText.textContent = question.explanation;
            }

            updateStats() {
                this.scoreDisplay.textContent = this.score;
                this.streakDisplay.textContent = this.streak;
                
                const total = this.correct + this.incorrect;
                const accuracy = total > 0 ? Math.round((this.correct / total) * 100) : 0;
                this.accuracyDisplay.textContent = `${accuracy}%`;
                
                this.progressDisplay.textContent = `${this.currentQuestion + 1}/${this.questions.length}`;
            }

            updateProgress() {
                const progress = ((this.currentQuestion + 1) / this.questions.length) * 100;
                this.progressBar.style.width = `${progress}%`;
            }

            showResults() {
                const accuracy = Math.round((this.correct / this.questions.length) * 100);
                
                document.getElementById('finalScore').textContent = `${accuracy}%`;
                document.getElementById('correctCount').textContent = this.correct;
                document.getElementById('incorrectCount').textContent = this.incorrect;
                
                let message = '';
                if (accuracy >= 90) {
                    message = `<i class="fas fa-star" style="color: gold;"></i> Outstanding! You're a tax code expert!`;
                } else if (accuracy >= 70) {
                    message = `<i class="fas fa-thumbs-up" style="color: var(--primary-color);"></i> Good job! You're getting the hang of it!`;
                } else if (accuracy >= 50) {
                    message = `<i class="fas fa-chart-line" style="color: var(--warning-text);"></i> Keep practicing! You're improving!`;
                } else {
                    message = `<i class="fas fa-book" style="color: var(--text-secondary);"></i> Review the tax codes and try again!`;
                }
                
                document.getElementById('performanceMessage').innerHTML = message;
                this.resultsModal.classList.add('active');
            }
        }

        // Initialize game
        let game = new SalesTaxTrainer();

        // Modal functions
        function closeResults() {
            document.getElementById('resultsModal').classList.remove('active');
        }

        function restartGame() {
            closeResults();
            game = new SalesTaxTrainer();
            game.startGame();
        }
