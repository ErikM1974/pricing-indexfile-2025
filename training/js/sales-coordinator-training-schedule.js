/* sales-coordinator-training-schedule.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in training/sales-coordinator-training-schedule.html (Rule 3, 2026.09.05.11) ──
document.addEventListener('DOMContentLoaded', function() {
            const links = document.querySelectorAll('.sidebar-link');
            const sections = document.querySelectorAll('.content-section');

            const updateActiveState = (hash) => {
                links.forEach(link => {
                    if (link.getAttribute('href') === hash) {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                });

                sections.forEach(section => {
                    if ('#' + section.id === hash) {
                        section.classList.add('active');
                    } else {
                        section.classList.remove('active');
                    }
                });
            };

            const initialHash = window.location.hash || '#day1';
            updateActiveState(initialHash);

            links.forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const targetHash = this.getAttribute('href');
                    // Simple scroll to top of content area on new section
                    document.querySelector('main').scrollTop = 0;
                    history.pushState(null, null, targetHash);
                    updateActiveState(targetHash);
                });
            });

            window.addEventListener('popstate', () => {
                const hash = window.location.hash || '#day1';
                updateActiveState(hash);
            });
        });

        // Practice scenarios with correct answers
        const scenarios = {
            1: {
                section: "Notes on Order",
                goodExamples: [
                    "Customer called - order ready Friday",
                    "Called customer about status - ready Friday",
                    "Customer inquiry - will be ready Friday"
                ],
                keywords: ["called", "customer", "Friday", "ready"]
            },
            2: {
                section: "Notes to Production",
                goodExamples: [
                    "White logo on navy shirts, 3\" wide, left chest centered",
                    "3 inch white logo centered on left chest",
                    "Logo: white, 3\" wide, left chest center"
                ],
                keywords: ["white", "navy", "3", "left chest", "centered"]
            },
            3: {
                section: "Notes to Shipping",
                goodExamples: [
                    "Ship on customer's FedEx #445566",
                    "Use customer FedEx account #445566",
                    "Customer's FedEx #445566"
                ],
                keywords: ["FedEx", "445566", "customer", "account"]
            }
        };

        function checkAnswer(scenarioNum) {
            const textarea = document.getElementById(`practice${scenarioNum}`);
            const feedback = document.getElementById(`feedback${scenarioNum}`);
            const answer = textarea.value.toLowerCase().trim();
            const scenario = scenarios[scenarioNum];
            
            if (answer.length === 0) {
                showFeedback(feedback, "Please write a note first!", false);
                return;
            }

            // Check if answer contains key elements
            const hasKeywords = scenario.keywords.filter(keyword => 
                answer.includes(keyword.toLowerCase())
            ).length;

            const keywordPercentage = hasKeywords / scenario.keywords.length;

            if (keywordPercentage >= 0.5) {
                showFeedback(feedback, 
                    `✅ Great job! This would go in "${scenario.section}". Your note is clear and includes the key information.`, 
                    true
                );
            } else if (keywordPercentage >= 0.25) {
                showFeedback(feedback, 
                    `⚠️ Good start! This would go in "${scenario.section}". Try to include more specific details like: ${scenario.keywords.join(', ')}`, 
                    false
                );
            } else {
                showFeedback(feedback, 
                    `❌ This needs more detail. Remember to include key information: ${scenario.keywords.join(', ')}. This should go in "${scenario.section}"`, 
                    false
                );
            }
        }

        function showExample(scenarioNum) {
            const textarea = document.getElementById(`practice${scenarioNum}`);
            const feedback = document.getElementById(`feedback${scenarioNum}`);
            const scenario = scenarios[scenarioNum];
            
            textarea.value = scenario.goodExamples[0];
            showFeedback(feedback, 
                `📝 Example note for "${scenario.section}": ${scenario.goodExamples.join(' OR ')}`, 
                true
            );
        }

        function showFeedback(element, message, isSuccess) {
            element.textContent = message;
            element.className = `feedback ${isSuccess ? 'success' : 'error'}`;
            element.style.display = 'block';
        }

        // Navigation function for switching between sections
        function showSection(sectionId, clickedElement) {
            // Hide all content sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.style.display = 'none';
                section.classList.remove('active');
            });
            
            // Show the selected section
            const selectedSection = document.getElementById(sectionId);
            if (selectedSection) {
                selectedSection.style.display = 'block';
                selectedSection.classList.add('active');
            }
            
            // Update navigation active state
            document.querySelectorAll('.sidebar nav a').forEach(link => {
                link.classList.remove('active');
            });
            if (clickedElement) {
                clickedElement.classList.add('active');
            }
        }

        // Initialize the page - show Day 1 by default
        document.addEventListener('DOMContentLoaded', function() {
            showSection('day1', document.querySelector('[href="#day1"]'));
        });

        // Add some interactivity to decision boxes
        document.querySelectorAll('.decision-box').forEach(box => {
            box.addEventListener('click', function() {
                // Reset all boxes
                document.querySelectorAll('.decision-box').forEach(b => {
                    b.style.background = '#f8f9fa';
                });
                // Highlight clicked box
                this.style.background = 'var(--success-bg)';
            });
        });
