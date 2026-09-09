(() => {
'use strict';
/* Training note practice; navigation and print live in training-manual.js. */
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
            
        }



document.querySelectorAll('[data-practice-action]').forEach(button => button.addEventListener('click', () => {
    const number = Number(button.dataset.practiceScenario);
    if (button.dataset.practiceAction === 'check') checkAnswer(number);
    else showExample(number);
}));
})();
