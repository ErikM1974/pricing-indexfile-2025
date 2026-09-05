/* customer-categorization-training.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in training/customer-categorization-training.html (Rule 3, 2026.09.05.11) ──
// Customer categories with examples and characteristics
const categories = {
    corporate: {
        name: "Corporate",
        icon: "🏢",
        description: "B2B companies, professional services, tech firms",
        characteristics: ["LLC/Inc in name", "Professional services", "Tech companies", "Marketing firms"],
        examples: ["AMOCAT FENCING", "Wheel Pros", "Pod Pack International, LLC", "Fenton Communication", "Custom Truck NW"],
        realCustomers: [
            "AMOCAT FENCING", "Skyline Properties Inc", "ISB Science", "Chukar Cherry Co.",
            "BUK Seattle", "InFormula Team", "Troutlodge", "VRC Metal Systems, LLC",
            "Curb Pros, LLC", "Pixel Pack Games", "BlackRock Industries", "Pod Pack International, LLC",
            "Wheel Pros", "Fenton Communication", "Simply Labs LLC", "Custom Truck NW",
            "Rainier Family Wealth", "Armstrong Services", "Rebar International Inc.",
            "Experience Marketing Group, LLC", "CIMCO Americas LLC", "ALICE Technologies"
        ]
    },
    construction: {
        name: "Construction",
        icon: "🏗️",
        description: "Builders, contractors, concrete, electric, trucking, property development",
        characteristics: ["Construction/Concrete in name", "Electric/Roofing", "Trucking/Transportation", "Properties/Development", "Architects"],
        examples: ["Indra Construction", "Delta Concrete", "Max Power Electric", "Elks Roofing", "INNOVA Architects"],
        realCustomers: [
            "Indra Construction", "City of Roy", "Wood and Stoane", "Looker Properties",
            "Lil Miss Truckin LLC", "Jeff Bartlett Trucking", "Konkrete Koncepts", "SV Shotcrete",
            "Big Mountain Enterprise", "Calco Customs", "Delta Concrete", "Acropolis Const. LLC",
            "Lawson Electric", "Allwest Transportation", "Osborn Concrete & Consulting LLC",
            "Max Power Electric", "Yard Works Inc.", "INNOVA Architects", 
            "England Industrial Garage Doors", "Coral Slater", "Elks Roofing"
        ]
    },
    foodService: {
        name: "Food Service",
        icon: "🍔",
        description: "Restaurants, cafes, breweries, bakeries, pubs, sushi, pizza",
        characteristics: ["Restaurant/Pub/Cafe", "Bakery/Deli", "Brewing/Brewery", "Pizza/Sushi", "Food/Dining keywords"],
        examples: ["Domino's Be Good Pizza", "Hess Bakery & Deli", "Acorn Brewing", "Nori Sushi", "Green Lantern Pub"],
        realCustomers: [
            "SaddleBrooke One", "Domino's Be Good Pizza LLC", "Hess Bakery & Deli",
            "Green Lantern Pub", "Acorn Brewing", "HOPSNDROPS - Lacamas", 
            "HOPSNDROPS - Milton", "Nori Sushi", "BAS QUE", "Blue Heron Bloom LLC"
        ]
    },
    medical: {
        name: "Medical",
        icon: "⚕️",
        description: "Healthcare, dental, chiropractic, wellness, therapy, emergency services",
        characteristics: ["Medical/Dental/Health in name", "Dr./MD", "Clinic/Surgery", "Therapy/Wellness", "Emergency/ER", "Hospice/Kidney care"],
        examples: ["Family Tree Chiropractic", "Smile Surfers Kids Dentistry", "UW Dept. Of Emergency Medicine", "Davita Kidney Care"],
        realCustomers: [
            "Family Tree Chiropractic", "Molen Oral & Implant Surgery", "Cedar Wellness Center",
            "Allie Grace Aesthetics, PLLC", "Smile Surfers Kids Dentistry", "UW Dept. Of Emergency Medicine",
            "Envision Healthcare At Home - Hospice", "Davita Kidney Care", "United Wound Healing",
            "One to One Physical Therapy", "Parkland ER"
        ]
    },
    retail: {
        name: "Retail",
        icon: "🛍️",
        description: "Tattoo shops, farms, specialty stores, individual entrepreneurs, online shops",
        characteristics: ["Tattoo/Ink shops", "Farm/Agricultural retail", "Individual names (personal businesses)", "Specialty retail", ".com businesses"],
        examples: ["Destiny City Tattoo", "Graysmarsh Farm", "Adventure Angling", "Skorched Ice LLC"],
        realCustomers: [
            "Graysmarsh Farm", "Destiny City Tattoo", "Richard White", "Adventure Angling",
            "Skorched Ice LLC", "Jayson Schafer", "Mark Retzlaff", "Pow Town",
            "Jake Faccone", "Mimi Alvarez", "IamLightWhereIshouldBe.com"
        ]
    },
    school: {
        name: "School",
        icon: "🎓",
        description: "Schools, universities, sports teams, academic programs, learning centers",
        characteristics: ["School/Academy/University", "Wrestling/Sports teams", "Band/Music programs", "Learning Center", "Educational programs"],
        examples: ["Hilltop Heritage Middle School", "Cedar Crest Academy", "WSU Institute", "Bonney Lake Wrestling"],
        realCustomers: [
            "Hilltop Heritage Middle School", "Fox Island Baseball (FICRA)", "Cedar Crest Academy",
            "BETHEL ALLSTARS JUNIOR WRESTLING CLUB", "Pilchuck Glass School", "Bonney Lake High School Band",
            "Bonney Lake Wrestling", "Bonney Lake HS Band", "Prime Time Learning Center",
            "Linda Wood", "Jenna Larson", "Charlie Seibel", "WSU Institute of Material Research",
            "Carol Carlos", "Holy Family School", "UPAC - University Place Aquatic Club",
            "Rizzlin' Raptors", "Clover Toys", "UW - School Of Medicine",
            "Tufts Doctor Of Physical Therapy Program - Seattle"
        ]
    },
    events: {
        name: "Events",
        icon: "🎪",
        description: "Clubs, reunions, sports clubs, community organizations, special events",
        characteristics: ["Club/Organization names", "Reunion events", "Sports/Hobby clubs", "Community groups", "Racing/Derby teams"],
        examples: ["Ocean Park Eagles Club", "Tacoma Rugby Club", "Rat City Roller Derby", "Waitsburg Class of 1974"],
        realCustomers: [
            "Monica Murry", "Paul Feuerpfeil", "Ocean Park Eagles Club 3602", "Owen Lawrence",
            "Cyndy Vilke", "Maria Heinze", "JTP MUSIC", "St. Joe Valley Resort",
            "Caitlyn Trout", "Waitsburg Class of 1974", "Holden Village - Volunteer",
            "Tacoma Rugby Club", "Kim Whitney", "Bio Decon Solutions", "NW Chapter ATHS",
            "Little Fish Island, LLC", "Terenn Houk", "Nathan Riley", "Chris Adams",
            "True Analytics Manufacturing Solutions", "Robert Maxcy", "PNW RC Crawlers",
            "Devinant Ollam, LLC", "Alexandra James", "Town And County Auto Repair",
            "Gordon Family YMCA", "Iron Horse Racing", "Rat City Roller Derby",
            "Team Alpha Barbell", "NorthWest Samoan Section AG", 
            "BMDCA - Bernese Mountain Dog Club of America, Inc", "Megan Sheridan for Milton Mayor",
            "Carolyn Salter", "Tatiana Van Campenhout- Glacier Gals", "Turtles Jeep Club",
            "Ohana Boxing Fitness", "North Corner Chamber Orchestra", "Planted Roots",
            "Davis Reunion", "Janet Zamzow", "Anthony Bluehorse"
        ]
    },
    landscaper: {
        name: "Landscaper",
        icon: "🌳",
        description: "Lawn care, landscaping, nurseries, garden centers, property maintenance",
        characteristics: ["Landscape/Landscaping", "Lawn care/maintenance", "Nursery/Garden", "Property services", "Tree care"],
        examples: ["Olympic Landscape", "Watson's Greenhouse", "Green Effects", "Windmill Gardens", "Father Nature Landscapes"],
        realCustomers: [
            "Olympic Landscape", "Superior Rockeries", "Takehara Landscape", 
            "New Dimension Lawn & Landscape, Inc.", "Watson's Greenhouse and Nursery",
            "Green Effects, Inc.", "NW Landscape Management", "Ground Effects Landscaping",
            "Windmill Gardens", "Furney's Nursery", "Mt. Fuji Gardening & Landscaping Inc",
            "Summit Landscape Service", "DeGoede Brothers", "Quality Landscape Maintenance",
            "Winterbourne Landscape", "Flores Landscape Services", "Anderson Landscape Service",
            "Simply Green Lawn and Landscape", "Family Tree Care", "Valley Landscape Supply",
            "Edgewood Nursery and Garden", "Father Nature Landscapes of Tacoma, Inc.",
            "Juan Landscape Maintenance", "Thrush Lawn Care", "Green Line Landscaping",
            "Greenleaf Landscaping", "Frost Landscape", "Valley Property Services",
            "Absolute Life Landscape", "All Tacked Up, LLC", "Parker Truck & Equipment Repair",
            "Aquasense", "Augusta Lawn Care"
        ]
    },
    firePolice: {
        name: "Fire/Police",
        icon: "🚔",
        description: "Law enforcement, fire departments, emergency services",
        characteristics: ["Police/Sheriff", "Fire Dept/Station", "State Patrol", "K9 units", "SWAT teams"],
        examples: ["Washington State Patrol", "Tacoma Fire Dept", "Pierce County Sheriff", "Metro K9"],
        realCustomers: [
            "Washington State Patrol", "Tacoma Fire Dept", "Pierce County Sheriff- MT Detachment",
            "Puyallup Tribal Police Department", "Lewis County Sheriff's Office", "Metro K9",
            "Shoreline Fire Station #61", "Metro Cities Swat"
        ]
    },
    contract: {
        name: "Contract",
        icon: "🤝",
        description: "Apparel decorators, promotional products, print shops, embroidery competitors",
        characteristics: ["Apparel/Promotions", "Embroidery/Printing", "Merchandise/Merch", "Custom/Customs", "ASI numbers", "Promotional products"],
        examples: ["Fully Promoted Tacoma", "4G Apparel & Promotions", "Ink Inc.", "Adrenaline Designs"],
        realCustomers: [
            "Cure Customs", "1338Tryon", "Adrenaline Designs", "Skyhawk Press",
            "4G Apparel & Promotions", "Unfinished", "Eastside Apparel LLC", 
            "Co. X Merchandise", "Basics.Co/Heart 2 Heart", "Seattle Native LLC",
            "Copler Creek Printing Co", "Regalo International", "Suave Studios",
            "Little Elm LLC, DBA: Community Sports", "Shell Mays", "Fully Promoted Tacoma",
            "Ink Inc.", "Designs by Michelle (DMS Embroidery)", "DVC Mechanical Contractor",
            "Brand Stratos", "Sound Apparel LLC", "The Group"
        ]
    },
    military: {
        name: "Military",
        icon: "🎖️",
        description: "Military bases, veterans organizations, ROTC, military units",
        characteristics: ["Military base (JBLM)", "Squadron/Troop", "Veterans", "ROTC", "USS ships", ".mil email", "Military ranks"],
        examples: ["Joint Base Lewis McChord", "UW Naval ROTC", "4th Airlift Squadron", "Pierce County Veterans"],
        realCustomers: [
            "4th Airlift Squadron", "UW Naval ROTC", "Pierce County Veterans Assistance",
            "Joint Base Lewis McChord", "Child Life Services (Sub Vets)", "Troop 222",
            "Kilo 3/1 USMC", "USS Observation Island EAG 154", "Diana Chudak",
            "Herman Koppisch", "JBLM-NAC-ODR-Mx", "Family Life Chaplain JBLM", "Roy- US ARMY"
        ]
    },
    alaska: {
        name: "Alaska Charter",
        icon: "✈️",
        description: "Alaska-based lodges, charters, marine services, aviation",
        characteristics: ["Alaska in name", "Lodge/Charter", "Marine/Air services", "Excursions/Tours", "Alaska addresses"],
        examples: ["Beluga Air LLC", "Alaska Trophy Adventures Lodge", "Gone Fishin Lodge", "Vitus Marine"],
        realCustomers: [
            "Togiak Native Limited", "Frontier Excursions, Inc.", "Vitus Marine",
            "Alaska's Lodge", "Beluga Air LLC", "Alaska Trophy Adventures Lodge",
            "Alaska King Charter", "Gone Fishin Lodge", "Alaska Wide Open Charters",
            "Lego Robotics Kids", "Ironside Marine", "Bald Mountain Air Service",
            "North Tongass Vol. Fire Dept."
        ]
    }
};

// Practice mode sample customers (mix of real and fictional for training)
const practiceCustomers = [
    // Corporate customers (real)
    { name: "AMOCAT FENCING", category: "corporate" },
    { name: "Wheel Pros", category: "corporate" },
    { name: "Pod Pack International, LLC", category: "corporate" },
    { name: "BlackRock Industries", category: "corporate" },
    { name: "Fenton Communication", category: "corporate" },
    { name: "Custom Truck NW", category: "corporate" },
    { name: "Simply Labs LLC", category: "corporate" },
    { name: "Experience Marketing Group, LLC", category: "corporate" },
    
    // Construction customers (real)
    { name: "Indra Construction", category: "construction" },
    { name: "Delta Concrete", category: "construction" },
    { name: "Max Power Electric", category: "construction" },
    { name: "Elks Roofing", category: "construction" },
    { name: "Konkrete Koncepts", category: "construction" },
    { name: "Jeff Bartlett Trucking", category: "construction" },
    { name: "Lawson Electric", category: "construction" },
    { name: "SV Shotcrete", category: "construction" },
    
    // Food Service customers (real)
    { name: "Domino's Be Good Pizza LLC", category: "foodService" },
    { name: "Hess Bakery & Deli", category: "foodService" },
    { name: "Green Lantern Pub", category: "foodService" },
    { name: "Acorn Brewing", category: "foodService" },
    { name: "Nori Sushi", category: "foodService" },
    { name: "HOPSNDROPS - Lacamas", category: "foodService" },
    { name: "BAS QUE", category: "foodService" },
    
    // Medical customers (real)
    { name: "Family Tree Chiropractic", category: "medical" },
    { name: "Smile Surfers Kids Dentistry", category: "medical" },
    { name: "Cedar Wellness Center", category: "medical" },
    { name: "Davita Kidney Care", category: "medical" },
    { name: "United Wound Healing", category: "medical" },
    { name: "One to One Physical Therapy", category: "medical" },
    { name: "Parkland ER", category: "medical" },
    { name: "Allie Grace Aesthetics, PLLC", category: "medical" },
    
    // Retail customers (real)
    { name: "Destiny City Tattoo", category: "retail" },
    { name: "Graysmarsh Farm", category: "retail" },
    { name: "Adventure Angling", category: "retail" },
    { name: "Skorched Ice LLC", category: "retail" },
    { name: "Pow Town", category: "retail" },
    { name: "IamLightWhereIshouldBe.com", category: "retail" },
    { name: "Jake Faccone", category: "retail" },
    { name: "Mimi Alvarez", category: "retail" },
    
    // School customers (real)
    { name: "Hilltop Heritage Middle School", category: "school" },
    { name: "Cedar Crest Academy", category: "school" },
    { name: "Bonney Lake Wrestling", category: "school" },
    { name: "WSU Institute of Material Research", category: "school" },
    { name: "UW - School Of Medicine", category: "school" },
    { name: "Prime Time Learning Center", category: "school" },
    { name: "UPAC - University Place Aquatic Club", category: "school" },
    { name: "Holy Family School", category: "school" },
    { name: "Fox Island Baseball (FICRA)", category: "school" },
    { name: "Rizzlin' Raptors", category: "school" },
    
    // Events customers (real - sample)
    { name: "Ocean Park Eagles Club 3602", category: "events" },
    { name: "Tacoma Rugby Club", category: "events" },
    { name: "Rat City Roller Derby", category: "events" },
    { name: "Waitsburg Class of 1974", category: "events" },
    { name: "PNW RC Crawlers", category: "events" },
    { name: "Gordon Family YMCA", category: "events" },
    { name: "Iron Horse Racing", category: "events" },
    { name: "Team Alpha Barbell", category: "events" },
    { name: "BMDCA - Bernese Mountain Dog Club of America, Inc", category: "events" },
    { name: "Turtles Jeep Club", category: "events" },
    
    // Landscaper customers (real)
    { name: "Olympic Landscape", category: "landscaper" },
    { name: "Watson's Greenhouse and Nursery", category: "landscaper" },
    { name: "Green Effects, Inc.", category: "landscaper" },
    { name: "Windmill Gardens", category: "landscaper" },
    { name: "Father Nature Landscapes of Tacoma, Inc.", category: "landscaper" },
    { name: "Simply Green Lawn and Landscape", category: "landscaper" },
    { name: "Greenleaf Landscaping", category: "landscaper" },
    { name: "Augusta Lawn Care", category: "landscaper" },
    { name: "Valley Property Services", category: "landscaper" },
    
    // Fire/Police customers (real)
    { name: "Washington State Patrol", category: "firePolice" },
    { name: "Tacoma Fire Dept", category: "firePolice" },
    { name: "Pierce County Sheriff- MT Detachment", category: "firePolice" },
    { name: "Puyallup Tribal Police Department", category: "firePolice" },
    { name: "Lewis County Sheriff's Office", category: "firePolice" },
    { name: "Metro K9", category: "firePolice" },
    { name: "Shoreline Fire Station #61", category: "firePolice" },
    { name: "Metro Cities Swat", category: "firePolice" },
    
    // Military customers (real)
    { name: "Joint Base Lewis McChord", category: "military" },
    { name: "UW Naval ROTC", category: "military" },
    { name: "4th Airlift Squadron", category: "military" },
    { name: "Pierce County Veterans Assistance", category: "military" },
    { name: "Kilo 3/1 USMC", category: "military" },
    { name: "USS Observation Island EAG 154", category: "military" },
    { name: "Family Life Chaplain JBLM", category: "military" },
    { name: "JBLM-NAC-ODR-Mx", category: "military" },
    
    // Contract customers (real)
    { name: "Fully Promoted Tacoma", category: "contract" },
    { name: "4G Apparel & Promotions", category: "contract" },
    { name: "Ink Inc.", category: "contract" },
    { name: "Adrenaline Designs", category: "contract" },
    { name: "Eastside Apparel LLC", category: "contract" },
    { name: "Sound Apparel LLC", category: "contract" },
    { name: "Brand Stratos", category: "contract" },
    { name: "Seattle Native LLC", category: "contract" },
    
    // Alaska customers (real)
    { name: "Togiak Native Limited", category: "alaska" },
    { name: "Frontier Excursions, Inc.", category: "alaska" },
    { name: "Vitus Marine", category: "alaska" },
    { name: "Alaska Trophy Adventures Lodge", category: "alaska" },
    { name: "Gone Fishin Lodge", category: "alaska" },
    { name: "Bald Mountain Air Service", category: "alaska" }
];

let currentMode = 'learn';
let score = 0;
let progress = 0;
let quizQuestions = [];
let currentQuizIndex = 0;
let practiceRound = 0;

function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.training-mode').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`${mode}Mode`).classList.add('active');
    event.target.classList.add('active');
    
    if (mode === 'learn') {
        initLearnMode();
    } else if (mode === 'practice') {
        initPracticeMode();
    } else if (mode === 'quiz') {
        initQuizMode();
    }
}

function initLearnMode() {
    const grid = document.getElementById('categoriesGrid');
    grid.innerHTML = '';
    
    Object.entries(categories).forEach(([key, category]) => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
            <div class="customer-count">${category.realCustomers.length}</div>
            <div class="category-icon">${category.icon}</div>
            <div class="category-name">${category.name}</div>
            <div class="category-description">${category.description}</div>
            <div class="example-customers">
                <strong>Key identifiers:</strong><br>
                ${category.characteristics.slice(0, 3).join(' • ')}
            </div>
        `;
        
        card.onclick = () => {
            document.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            showCategoryDetails(category);
        };
        
        grid.appendChild(card);
    });
}

function showCategoryDetails(category) {
    // Could expand to show modal with full customer list
    console.log('Selected category:', category);
}

function initPracticeMode() {
    const stack = document.getElementById('customerStack');
    const dropZones = document.getElementById('dropZones');
    
    stack.innerHTML = '';
    dropZones.innerHTML = '';
    
    // Get random customers for this round from ALL categories
    const roundCustomers = shuffle(practiceCustomers).slice(0, 12);
    
    roundCustomers.forEach(customer => {
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.draggable = true;
        card.dataset.name = customer.name;
        card.dataset.category = customer.category;
        card.innerHTML = `
            <div class="customer-name">${customer.name}</div>
            <div class="customer-details">Categorize this customer</div>
        `;
        
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        
        stack.appendChild(card);
    });
    
    // Create drop zones for ALL 12 categories
    Object.keys(categories).forEach(key => {
        const category = categories[key];
        const zone = document.createElement('div');
        zone.className = 'category-drop-zone';
        zone.dataset.category = key;
        zone.innerHTML = `
            <div class="zone-icon">${category.icon}</div>
            <div class="zone-title">${category.name}</div>
            <div class="dropped-customers"></div>
        `;
        
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('drop', handleDrop);
        zone.addEventListener('dragleave', handleDragLeave);
        
        dropZones.appendChild(zone);
    });
}

function initQuizMode() {
    quizQuestions = generateQuizQuestions();
    currentQuizIndex = 0;
    showQuizQuestion();
}

function generateQuizQuestions() {
    const questions = [];
    const allCustomers = [];
    
    // Include ALL 12 categories in quiz mode
    Object.entries(categories).forEach(([key, category]) => {
        category.realCustomers.forEach(customer => {
            allCustomers.push({ name: customer, category: key, categoryName: category.name });
        });
    });
    
    // Generate 10 random questions
    const shuffled = shuffle(allCustomers);
    for (let i = 0; i < Math.min(10, shuffled.length); i++) {
        questions.push(shuffled[i]);
    }
    
    return questions;
}

function showQuizQuestion() {
    const container = document.getElementById('quizContainer');
    
    if (currentQuizIndex >= quizQuestions.length) {
        showQuizResults();
        return;
    }
    
    const question = quizQuestions[currentQuizIndex];
    const options = generateOptions(question.category);
    
    container.innerHTML = `
        <div class="question">Question ${currentQuizIndex + 1} of ${quizQuestions.length}</div>
        <div class="quiz-customer">
            <strong style="font-size: 1.2em;">${question.name}</strong><br>
            <small>Select the correct category for this customer</small>
        </div>
        <div class="options">
            ${options.map(opt => `
                <button class="option-btn" onclick="checkAnswer('${opt.key}', '${question.category}')">
                    ${opt.icon} ${opt.name}
                </button>
            `).join('')}
        </div>
        <div id="feedback"></div>
    `;
}

function generateOptions(correctCategory) {
    const options = [];
    const categoryKeys = Object.keys(categories);
    
    // Add correct answer
    options.push({
        key: correctCategory,
        name: categories[correctCategory].name,
        icon: categories[correctCategory].icon
    });
    
    // Add 3 random wrong answers
    const wrongOptions = categoryKeys.filter(k => k !== correctCategory);
    shuffle(wrongOptions).slice(0, 3).forEach(key => {
        options.push({
            key: key,
            name: categories[key].name,
            icon: categories[key].icon
        });
    });
    
    return shuffle(options);
}

function checkAnswer(selected, correct) {
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent.includes(categories[correct].name)) {
            btn.classList.add('correct');
        } else if (btn.textContent.includes(categories[selected].name) && selected !== correct) {
            btn.classList.add('incorrect');
        }
    });
    
    const feedback = document.getElementById('feedback');
    if (selected === correct) {
        score += 10;
        feedback.className = 'feedback correct';
        feedback.innerHTML = '✅ Correct! Well done!';
    } else {
        feedback.className = 'feedback incorrect';
        feedback.innerHTML = `❌ Incorrect. The correct answer is ${categories[correct].name}`;
    }
    
    document.getElementById('score').textContent = score;
    updateProgress();
    
    feedback.innerHTML += `
        <button class="next-btn" onclick="nextQuestion()">Next Question →</button>
    `;
}

function nextQuestion() {
    currentQuizIndex++;
    showQuizQuestion();
}

function showQuizResults() {
    const container = document.getElementById('quizContainer');
    const percentage = Math.round((score / (quizQuestions.length * 10)) * 100);
    
    container.innerHTML = `
        <div class="results-screen">
            <h2>Quiz Complete! 🎉</h2>
            <div class="score-display">${percentage}%</div>
            <p>You scored ${score} out of ${quizQuestions.length * 10} points</p>
            ${percentage >= 80 ? 
                '<div class="achievement">🏆 Expert Level Achieved!</div>' :
                percentage >= 60 ?
                '<div class="achievement">⭐ Good Progress!</div>' :
                '<div class="achievement">📚 Keep Practicing!</div>'
            }
            <button class="next-btn" onclick="initQuizMode()">Try Again</button>
        </div>
    `;
}

// Drag and Drop handlers
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = e.target;
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
    const zone = e.currentTarget;
    zone.classList.remove('drag-over');
    
    const correctCategory = draggedElement.dataset.category;
    const dropCategory = zone.dataset.category;
    
    if (correctCategory === dropCategory) {
        zone.classList.add('correct');
        const droppedArea = zone.querySelector('.dropped-customers');
        const dropped = document.createElement('div');
        dropped.className = 'dropped-customer';
        dropped.textContent = draggedElement.dataset.name;
        droppedArea.appendChild(dropped);
        
        draggedElement.remove();
        score += 5;
        document.getElementById('score').textContent = score;
        updateProgress();
        
        setTimeout(() => zone.classList.remove('correct'), 1000);
        
        // Check if round complete
        if (document.getElementById('customerStack').children.length === 0) {
            setTimeout(() => {
                alert('Round complete! Great job! Starting next round...');
                initPracticeMode();
            }, 1000);
        }
    } else {
        zone.classList.add('incorrect');
        setTimeout(() => zone.classList.remove('incorrect'), 600);
    }
}

function updateProgress() {
    progress = Math.min(100, Math.round((score / 100) * 100));
    document.getElementById('progress').textContent = progress;
}

function shuffle(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    initLearnMode();
});
