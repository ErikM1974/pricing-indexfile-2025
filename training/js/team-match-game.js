/* team-match-game.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in training/team-match-game.html (Rule 3, 2026.09.05.11) ──
// Employee data - matches staff directory
const employees = [
    { firstName: "Jim", lastName: "Mickelson", startDate: "1977-10-31", birthday: "03-25", position: "CEO" },
    { firstName: "Erik", lastName: "Mickelson", startDate: "1996-12-16", birthday: "02-14", position: "Operations Manager" },
    { firstName: "Ruth", lastName: "Nhong", startDate: "1998-08-05", birthday: "01-19", position: "Production Manager" },
    { firstName: "Savy", lastName: "Som", startDate: "2008-04-21", birthday: "09-08", position: "Embroidery Machine Operator" },
    { firstName: "Sorphorn", lastName: "Sorm", startDate: "2011-04-11", birthday: "07-10", position: "Embroidery Machine Operator" },
    { firstName: "Nika", lastName: "Lao", startDate: "2012-07-31", birthday: "06-29", position: "Account Executive" },
    { firstName: "Taylar", lastName: "Hanson", startDate: "2015-04-20", birthday: "06-30", position: "Account Executive" },
    { firstName: "Bunsereytheavy", lastName: "Hoeu", startDate: "2015-05-19", birthday: "01-01", position: "Embroidery Machine Operator" },
    { firstName: "Bradley", lastName: "Wright", startDate: "2017-08-10", birthday: "01-09", position: "Accounting/Purchasing/Webstores" },
    { firstName: "Steve", lastName: "Deland", startDate: "2017-09-28", birthday: "06-30", position: "Graphic Artist" },
    { firstName: "Kanha", lastName: "Chhorn", startDate: "2018-02-21", birthday: "06-11", position: "Embroidery Supervisor & Machine Operator" },
    { firstName: "Brian", lastName: "Beardsley", startDate: "2018-08-13", birthday: "06-29", position: "DTG Supervisor" },
    { firstName: "Sreynai", lastName: "Meang", startDate: "2019-12-09", birthday: "09-02", position: "Embroidery Machine Operator" },
    { firstName: "Sothea", lastName: "Tann", startDate: "2022-09-22", birthday: "04-23", position: "Embroidery Machine Operator" },
    { firstName: "Joseph", lastName: "Hallowell", startDate: "2023-04-03", birthday: "08-14", position: "DTG Operator" },
    { firstName: "Sothida", lastName: "Khiev", startDate: "2024-03-01", birthday: "06-29", position: "Embroidery Machine Operator" },
    { firstName: "Mikalah", lastName: "Hede", startDate: "2024-10-03", birthday: "04-21", position: "Shipping/Receiving Clerk" },
    { firstName: "Adriyella", lastName: "Trujillo", startDate: "2025-02-17", birthday: "02-10", position: "Office Assistant" }
    // Taneisha Clark starts 2025-08-12 - not included until start date
];

let currentMode = 'tenure';
let gameData = {};
let score = 0;
let attempts = 0;
let timer = null;
let timeElapsed = 0;
let draggedElement = null;
let draggedName = null;

// Function to calculate years of service - matches dashboard implementation
function calculateYearsOfService(startDate) {
    const start = new Date(startDate);
    const now = new Date();
    
    let years = now.getFullYear() - start.getFullYear();
    const monthDiff = now.getMonth() - start.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < start.getDate())) {
        years--;
    }
    
    return Math.max(0, years);
}

// Function to calculate time of service - returns years or months as appropriate
function calculateTimeOfService(startDate) {
    const start = new Date(startDate);
    const now = new Date();
    
    // Calculate total months
    let totalMonths = (now.getFullYear() - start.getFullYear()) * 12;
    totalMonths += now.getMonth() - start.getMonth();
    
    // Adjust if the day hasn't been reached yet this month
    if (now.getDate() < start.getDate()) {
        totalMonths--;
    }
    
    totalMonths = Math.max(0, totalMonths);
    
    // If 12 or more months, return years
    if (totalMonths >= 12) {
        const years = Math.floor(totalMonths / 12);
        return years === 1 ? '1 Year' : `${years} Years`;
    } else {
        // Return months for less than a year
        return totalMonths === 1 ? '1 Month' : `${totalMonths} Months`;
    }
}

function formatBirthday(birthday) {
    if (!birthday) return null;
    const [month, day] = birthday.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(month) - 1]} ${parseInt(day)}`;
}

function updateDateNotice() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('en-US', options);
    document.getElementById('dateNotice').textContent = `Years of service calculated as of ${dateStr}`;
}

function shuffle(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function setGameMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    initGame();
}

function initGame() {
    clearInterval(timer);
    timeElapsed = 0;
    score = 0;
    attempts = 0;
    gameData = {};
    
    document.getElementById('timer').textContent = '0';
    document.getElementById('score').textContent = '0';
    document.getElementById('attempts').textContent = '0';
    
    const activeEmployees = employees.filter(e => new Date(e.startDate) <= new Date());
    const employeesList = document.getElementById('employeesList');
    const dropZonesList = document.getElementById('dropZonesList');
    const dropZoneTitle = document.getElementById('dropZoneTitle');
    
    employeesList.innerHTML = '';
    dropZonesList.innerHTML = '';
    
    let dropZoneData = [];
    
    switch(currentMode) {
        case 'tenure':
            dropZoneTitle.textContent = 'Time at NWCA';
            activeEmployees.forEach(emp => {
                const name = `${emp.firstName} ${emp.lastName}`;
                const timeText = calculateTimeOfService(emp.startDate);
                gameData[name] = timeText;
                dropZoneData.push({ label: timeText, value: timeText });
            });
            break;
            
        case 'position':
            dropZoneTitle.textContent = 'Job Positions';
            activeEmployees.forEach(emp => {
                const name = `${emp.firstName} ${emp.lastName}`;
                gameData[name] = emp.position;
                dropZoneData.push({ label: emp.position, value: emp.position });
            });
            break;
            
        case 'birthday':
            dropZoneTitle.textContent = 'Birthdays';
            const withBirthdays = activeEmployees.filter(e => e.birthday);
            withBirthdays.forEach(emp => {
                const name = `${emp.firstName} ${emp.lastName}`;
                const bday = formatBirthday(emp.birthday);
                gameData[name] = bday;
                dropZoneData.push({ label: bday, value: bday });
            });
            break;
            
        case 'mix':
            dropZoneTitle.textContent = 'Mixed Information';
            const mixEmployees = shuffle(activeEmployees).slice(0, 12);
            mixEmployees.forEach(emp => {
                const name = `${emp.firstName} ${emp.lastName}`;
                const random = Math.random();
                if (random < 0.33) {
                    const timeText = calculateTimeOfService(emp.startDate);
                    gameData[name] = timeText;
                    dropZoneData.push({ label: timeText, value: timeText });
                } else if (random < 0.66 && emp.birthday) {
                    const bday = formatBirthday(emp.birthday);
                    gameData[name] = bday;
                    dropZoneData.push({ label: bday, value: bday });
                } else {
                    gameData[name] = emp.position;
                    dropZoneData.push({ label: emp.position, value: emp.position });
                }
            });
            break;
    }
    
    // Create employee cards
    shuffle(Object.keys(gameData)).forEach(name => {
        const card = document.createElement('div');
        card.className = 'employee-card';
        card.textContent = name;
        card.draggable = true;
        card.dataset.name = name;
        
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        
        employeesList.appendChild(card);
    });
    
    // Create drop zones
    shuffle(dropZoneData).forEach(item => {
        const zone = document.createElement('div');
        zone.className = 'drop-zone';
        zone.dataset.value = item.value;
        zone.innerHTML = `<div class="drop-zone-label">${item.label}</div>`;
        
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('drop', handleDrop);
        zone.addEventListener('dragleave', handleDragLeave);
        
        dropZonesList.appendChild(zone);
    });
    
    document.getElementById('total').textContent = Object.keys(gameData).length;
    
    // Start timer
    timer = setInterval(() => {
        timeElapsed++;
        document.getElementById('timer').textContent = timeElapsed;
    }, 1000);
}

function handleDragStart(e) {
    draggedElement = e.target;
    draggedName = e.target.dataset.name;
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    const dropZone = e.currentTarget;
    dropZone.classList.remove('drag-over');
    
    // Check if zone already has an employee
    if (dropZone.querySelector('.dropped-employee')) {
        showFeedback(false);
        return;
    }
    
    const expectedValue = dropZone.dataset.value;
    const actualValue = gameData[draggedName];
    
    attempts++;
    document.getElementById('attempts').textContent = attempts;
    
    if (expectedValue === actualValue) {
        // Correct match
        dropZone.classList.add('correct');
        dropZone.innerHTML = `<div class="dropped-employee">${draggedName}</div>`;
        draggedElement.classList.add('matched');
        draggedElement.draggable = false;
        
        score++;
        document.getElementById('score').textContent = score;
        
        showFeedback(true);
        
        if (score === Object.keys(gameData).length) {
            clearInterval(timer);
            setTimeout(showCompletion, 1000);
        }
    } else {
        // Incorrect match
        dropZone.classList.add('incorrect');
        setTimeout(() => {
            dropZone.classList.remove('incorrect');
        }, 600);
        
        showFeedback(false);
    }
}

function showFeedback(isCorrect) {
    const existing = document.querySelector('.feedback');
    if (existing) existing.remove();
    
    const feedback = document.createElement('div');
    feedback.className = `feedback ${isCorrect ? 'correct' : 'incorrect'}`;
    feedback.textContent = isCorrect ? '✓ Correct!' : '✗ Try Again';
    document.body.appendChild(feedback);
    
    setTimeout(() => feedback.remove(), 600);
}

function showCompletion() {
    const accuracy = Math.round((score / attempts) * 100) || 100;
    const modeNames = {
        'tenure': 'Years of Service',
        'position': 'Job Positions',
        'birthday': 'Birthdays',
        'mix': 'Mix Challenge'
    };
    
    document.getElementById('completedMode').textContent = modeNames[currentMode];
    document.getElementById('finalTime').textContent = timeElapsed;
    document.getElementById('finalAttempts').textContent = attempts;
    document.getElementById('accuracy').textContent = accuracy;
    document.getElementById('completionOverlay').style.display = 'block';
}

function playAgain() {
    document.getElementById('completionOverlay').style.display = 'none';
    initGame();
}

function nextMode() {
    const modes = ['tenure', 'position', 'birthday', 'mix'];
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    currentMode = modes[nextIndex];
    
    document.querySelectorAll('.mode-btn').forEach((btn, index) => {
        btn.classList.toggle('active', index === nextIndex);
    });
    
    document.getElementById('completionOverlay').style.display = 'none';
    initGame();
}

// Initialize game on load
window.addEventListener('DOMContentLoaded', () => {
    updateDateNotice();
    initGame();
});
