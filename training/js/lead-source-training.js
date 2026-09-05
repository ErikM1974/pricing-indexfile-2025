/* lead-source-training.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in training/lead-source-training.html (Rule 3, 2026.09.05.11) ──
// Game data
const scenarios = [
    {
        dialogue: "Hi, I'm Bob from Bob's Plumbing Service. Shawn over at Arrow Lumber said you guys do amazing work on their uniforms and suggested we give you a call.",
        source: "Referral",
        referrer: "Shawn at Arrow Lumber",
        newCustomer: "Bob's Plumbing Service",
        action: "Create WOW Order for Shawn - Laser tumbler with Arrow Lumber logo"
    },
    {
        dialogue: "We've been driving past your building for about 10 years on our way to our warehouse. Finally decided to stop in and see what you're all about!",
        source: "Drive By"
    },
    {
        dialogue: "I found your website when I searched for 'custom embroidery Milton Washington' on Google.",
        source: "Google Search"
    },
    {
        dialogue: "You did shirts for us back in 2018, but everyone from back then has left the company. We need to update everything - new logos, new contacts, the works.",
        source: "Old Customer"
    },
    {
        dialogue: "I was just in the neighborhood running errands and noticed your sign. Thought I'd pop in to see what services you offer.",
        source: "Walk In"
    },
    {
        dialogue: "I saw your post on Facebook about the custom hats you did for that construction company. Really impressed with the quality!",
        source: "Other"
    },
    {
        dialogue: "The team at Pacific Steel recommended you. They said you handle all their safety gear embroidery and you're really reliable.",
        source: "Referral",
        referrer: "Pacific Steel",
        newCustomer: "New Customer",
        action: "Create WOW Order for Pacific Steel - Thank you tumbler"
    },
    {
        dialogue: "I met one of your sales reps at the trade show last month. They gave me a card and said to reach out when we need uniforms.",
        source: "Other"
    },
    {
        dialogue: "We drive by your place every morning. My business partner and I have been talking about getting team shirts for months, so here we are!",
        source: "Drive By"
    },
    {
        dialogue: "Found you in our vendor files from 2017. We're restarting our uniform program and remembered you did good work.",
        source: "Old Customer"
    },
    {
        dialogue: "I typed 'screen printing near me' into Google and your company was the first result.",
        source: "Google Search"
    },
    {
        dialogue: "Sarah from Cascade Construction said you're the best in the area for embroidered polos. She's been using you for years.",
        source: "Referral",
        referrer: "Sarah from Cascade Construction",
        newCustomer: "New Customer",
        action: "Create WOW Order for Sarah - Tumbler with Cascade Construction logo"
    },
    {
        dialogue: "I received your email newsletter about the new services you're offering. Thought it was time to check you out.",
        source: "Other"
    },
    {
        dialogue: "Just walked in off the street. Saw your 'Custom Apparel' sign and need some shirts made.",
        source: "Walk In"
    },
    {
        dialogue: "My neighbor owns Thunder Mountain Electric and he's always wearing nice embroidered shirts. He said you guys do all their work.",
        source: "Referral",
        referrer: "Thunder Mountain Electric",
        newCustomer: "New Customer",
        action: "Create WOW Order for Thunder Mountain Electric - Thank you tumbler"
    }
];

// Referral-specific scenarios for training
const referralScenarios = [
    {
        dialogue: "Hi! Mike from Summit Roofing told me you do excellent embroidery work. We're a new plumbing company and need uniforms.",
        questions: [
            {
                question: "Who is the referrer?",
                answer: "Mike from Summit Roofing",
                options: ["Mike from Summit Roofing", "The plumbing company", "Summit Plumbing", "Mike's Roofing"]
            },
            {
                question: "What action should you take?",
                answer: "Create WOW Order for thank you tumbler",
                options: ["Just note it in the system", "Create WOW Order for thank you tumbler", "Send an email later", "Nothing special needed"]
            },
            {
                question: "What should the WOW Order note say?",
                answer: "New plumbing company referred by Mike - Send Summit Roofing tumbler ASAP",
                options: [
                    "New plumbing company referred by Mike - Send Summit Roofing tumbler ASAP",
                    "Send tumbler sometime",
                    "Mike gets a tumbler",
                    "Thank you gift needed"
                ]
            }
        ]
    },
    {
        dialogue: "Jennifer at Precision Manufacturing said you're her go-to for custom apparel. We need safety vests with our logo.",
        questions: [
            {
                question: "Who gets the thank you tumbler?",
                answer: "Jennifer at Precision Manufacturing",
                options: ["The new customer", "Jennifer at Precision Manufacturing", "Both companies", "No one"]
            },
            {
                question: "When should the tumbler be sent?",
                answer: "ASAP",
                options: ["Next month", "With the customer's order", "ASAP", "When convenient"]
            }
        ]
    },
    {
        dialogue: "We're Blue Mountain Landscaping. Tom from Green Valley Nursery uses you for all his gear and said we should too.",
        questions: [
            {
                question: "What is the Source classification?",
                answer: "Referral",
                options: ["Google Search", "Walk In", "Referral", "Other"]
            },
            {
                question: "Who is the referrer?",
                answer: "Tom from Green Valley Nursery",
                options: ["Blue Mountain Landscaping", "Tom from Green Valley Nursery", "Green Mountain", "Tom's Landscaping"]
            },
            {
                question: "What logo goes on the thank you tumbler?",
                answer: "Green Valley Nursery logo",
                options: ["Blue Mountain logo", "Green Valley Nursery logo", "NWCA logo", "No logo needed"]
            }
        ]
    }
];

// Game state
let currentMode = 'learn';
let currentScenarioIndex = 0;
let correctAnswers = 0;
let totalAnswers = 0;
let currentStreak = 0;
let selectedSource = null;
let speedTimer = null;
let speedTimeLeft = 60;
let speedScore = 0;
let currentReferralIndex = 0;
let currentReferralQuestion = 0;

function setGameMode(mode) {
    currentMode = mode;
    
    // Update button states
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Hide all containers
    document.getElementById('learnMode').classList.remove('active');
    document.getElementById('scenarioMode').classList.remove('active');
    document.getElementById('referralMode').classList.remove('active');
    document.getElementById('speedMode').classList.remove('active');
    
    // Show selected mode
    switch(mode) {
        case 'learn':
            document.getElementById('learnMode').classList.add('active');
            break;
        case 'scenario':
            document.getElementById('scenarioMode').classList.add('active');
            resetScenarioStats();
            loadScenario();
            break;
        case 'referral':
            document.getElementById('referralMode').classList.add('active');
            loadReferralScenario();
            break;
        case 'speed':
            document.getElementById('speedMode').classList.add('active');
            startSpeedChallenge();
            break;
    }
}

function resetScenarioStats() {
    correctAnswers = 0;
    totalAnswers = 0;
    currentStreak = 0;
    currentScenarioIndex = 0;
    updateScoreDisplay();
}

function loadScenario() {
    const scenario = scenarios[currentScenarioIndex];
    document.getElementById('customerDialogue').textContent = scenario.dialogue;
    
    // Reset options
    document.querySelectorAll('.source-option').forEach(option => {
        option.classList.remove('selected', 'correct', 'incorrect');
    });
    
    selectedSource = null;
    document.getElementById('feedbackArea').innerHTML = '';
}

function selectSource(source) {
    if (selectedSource) return; // Already selected
    
    selectedSource = source;
    const scenario = scenarios[currentScenarioIndex];
    const isCorrect = source === scenario.source;
    
    // Update stats
    totalAnswers++;
    if (isCorrect) {
        correctAnswers++;
        currentStreak++;
    } else {
        currentStreak = 0;
    }
    
    // Visual feedback
    document.querySelectorAll('.source-option').forEach(option => {
        if (option.textContent.includes(source)) {
            option.classList.add(isCorrect ? 'correct' : 'incorrect');
        }
        if (option.textContent.includes(scenario.source) && !isCorrect) {
            option.classList.add('correct');
        }
    });
    
    // Show feedback
    let feedbackHTML = `<div class="${isCorrect ? 'referral-action-box' : 'source-action'}" style="margin-top: 20px;">`;
    
    if (isCorrect) {
        feedbackHTML += `<h3>✅ Correct!</h3>`;
        
        if (scenario.source === 'Referral') {
            feedbackHTML += `
                <div class="wow-order">
                    <div class="wow-order-title">🎁 WOW ORDER REQUIRED!</div>
                    <strong>Referrer:</strong> ${scenario.referrer}<br>
                    <strong>New Customer:</strong> ${scenario.newCustomer}<br>
                    <strong>Action:</strong> ${scenario.action}<br>
                    <strong>Note:</strong> "${scenario.newCustomer} referred by ${scenario.referrer} - Send thank you tumbler ASAP"
                </div>
            `;
        }
    } else {
        feedbackHTML += `
            <h3>❌ Incorrect</h3>
            <p>The correct answer was: <strong>${scenario.source}</strong></p>
        `;
    }
    
    feedbackHTML += `</div>`;
    document.getElementById('feedbackArea').innerHTML = feedbackHTML;
    
    updateScoreDisplay();
}

function updateScoreDisplay() {
    document.getElementById('currentStreak').textContent = currentStreak;
    document.getElementById('correctCount').textContent = correctAnswers;
    document.getElementById('totalCount').textContent = totalAnswers;
    
    const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
    document.getElementById('accuracy').textContent = accuracy + '%';
}

function nextScenario() {
    currentScenarioIndex = (currentScenarioIndex + 1) % scenarios.length;
    loadScenario();
}

// Referral Training Functions
function loadReferralScenario() {
    currentReferralQuestion = 0;
    const scenario = referralScenarios[currentReferralIndex];
    
    document.getElementById('referralDialogue').textContent = scenario.dialogue;
    
    showReferralQuestion();
}

function showReferralQuestion() {
    const scenario = referralScenarios[currentReferralIndex];
    const question = scenario.questions[currentReferralQuestion];
    
    let html = `
        <div style="background: white; padding: 20px; border-radius: 10px; margin-top: 20px;">
            <h3>${question.question}</h3>
            <div class="source-options" style="margin-top: 15px;">
    `;
    
    question.options.forEach((option, index) => {
        html += `
            <div class="source-option" onclick="selectReferralAnswer('${option}')" data-option="${option}">
                ${option}
            </div>
        `;
    });
    
    html += `</div></div>`;
    
    document.getElementById('referralQuestions').innerHTML = html;
}

function selectReferralAnswer(answer) {
    const scenario = referralScenarios[currentReferralIndex];
    const question = scenario.questions[currentReferralQuestion];
    const isCorrect = answer === question.answer;
    
    // Visual feedback
    document.querySelectorAll('.source-option').forEach(option => {
        if (option.dataset.option === answer) {
            option.classList.add(isCorrect ? 'correct' : 'incorrect');
        }
        if (option.dataset.option === question.answer && !isCorrect) {
            option.classList.add('correct');
        }
    });
}

function checkReferralAnswer() {
    // Move to next question or scenario
    const scenario = referralScenarios[currentReferralIndex];
    
    if (currentReferralQuestion < scenario.questions.length - 1) {
        currentReferralQuestion++;
        showReferralQuestion();
    } else {
        // Show completion message
        document.getElementById('referralQuestions').innerHTML = `
            <div class="referral-action-box">
                <h3>✅ Scenario Complete!</h3>
                <p>Great job! You've correctly identified the referral process.</p>
                <p>Remember: Always create a WOW Order immediately for referrals!</p>
            </div>
        `;
    }
}

function nextReferralScenario() {
    currentReferralIndex = (currentReferralIndex + 1) % referralScenarios.length;
    loadReferralScenario();
}

// Speed Challenge Functions
function startSpeedChallenge() {
    speedScore = 0;
    speedTimeLeft = 60;
    loadSpeedScenario();
    
    // Start timer
    clearInterval(speedTimer);
    speedTimer = setInterval(() => {
        speedTimeLeft--;
        document.getElementById('timeLeft').textContent = speedTimeLeft + 's';
        document.getElementById('timerFill').style.width = (speedTimeLeft / 60 * 100) + '%';
        
        if (speedTimeLeft <= 0) {
            endSpeedChallenge();
        }
    }, 1000);
    
    // Setup quick buttons
    setupSpeedButtons();
}

function setupSpeedButtons() {
    const sources = ['Google Search', 'Walk In', 'Old Customer', 'Referral', 'Other', 'Drive By'];
    let html = '';
    
    sources.forEach(source => {
        html += `
            <div class="source-option" onclick="speedSelect('${source}')" data-source="${source}">
                ${source}
            </div>
        `;
    });
    
    document.getElementById('speedOptions').innerHTML = html;
}

function loadSpeedScenario() {
    // Reset all button colors
    document.querySelectorAll('#speedOptions .source-option').forEach(option => {
        option.style.background = '';
        option.classList.remove('correct', 'incorrect');
    });
    
    // Add fade animation for new question
    const dialogueEl = document.getElementById('speedDialogue');
    dialogueEl.style.opacity = '0';
    
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    
    setTimeout(() => {
        dialogueEl.textContent = scenario.dialogue;
        dialogueEl.dataset.correctSource = scenario.source;
        dialogueEl.style.transition = 'opacity 0.3s';
        dialogueEl.style.opacity = '1';
    }, 100);
}

function speedSelect(source) {
    // Prevent multiple clicks
    const allOptions = document.querySelectorAll('#speedOptions .source-option');
    if (event.target.classList.contains('disabled')) return;
    
    // Disable all buttons temporarily
    allOptions.forEach(opt => opt.classList.add('disabled'));
    
    const correctSource = document.getElementById('speedDialogue').dataset.correctSource;
    const isCorrect = source === correctSource;
    
    if (isCorrect) {
        speedScore += 10;
        document.getElementById('speedScore').textContent = speedScore;
        
        // Show correct answer with animation
        event.target.classList.add('correct');
        event.target.style.background = '#4CAF50';
        
        // Add floating +10 animation
        const floater = document.createElement('div');
        floater.textContent = '+10';
        floater.style.cssText = `
            position: absolute;
            color: #4CAF50;
            font-weight: bold;
            font-size: 1.5em;
            animation: floatUp 1s ease-out;
            pointer-events: none;
            z-index: 1000;
        `;
        event.target.style.position = 'relative';
        event.target.appendChild(floater);
        
        setTimeout(() => {
            floater.remove();
            allOptions.forEach(opt => opt.classList.remove('disabled'));
            loadSpeedScenario();
        }, 500);
    } else {
        // Show incorrect answer
        event.target.classList.add('incorrect');
        event.target.style.background = '#ff6b6b';
        
        // Also highlight the correct answer
        allOptions.forEach(opt => {
            if (opt.dataset.source === correctSource) {
                opt.classList.add('correct');
                opt.style.background = '#4CAF50';
            }
        });
        
        setTimeout(() => {
            allOptions.forEach(opt => opt.classList.remove('disabled'));
            loadSpeedScenario();
        }, 800);
    }
}

function endSpeedChallenge() {
    clearInterval(speedTimer);
    
    document.getElementById('speedDialogue').innerHTML = `
        <h2>⏱️ Time's Up!</h2>
        <p>Final Score: ${speedScore} points</p>
        <button class="nav-btn" onclick="startSpeedChallenge()">Try Again</button>
    `;
    
    document.getElementById('speedOptions').innerHTML = '';
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    // Start with learn mode active
    setGameMode('learn');
});
