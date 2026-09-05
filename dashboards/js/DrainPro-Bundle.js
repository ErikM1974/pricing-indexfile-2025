/* DrainPro-Bundle.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in dashboards/DrainPro-Bundle.html (Rule 3, 2026.09.05.11) ──
function switchTab(tabName) {
            // Get all tab buttons and tab contents
            const tabButtons = document.querySelectorAll('.tab-button');
            const tabContents = document.querySelectorAll('.tab-content');

            // Remove active class from all tabs and buttons
            tabButtons.forEach(button => button.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to selected tab and button
            const selectedButton = event.target.closest('.tab-button');
            const selectedContent = document.getElementById(`${tabName}-tab`);

            if (selectedButton && selectedContent) {
                selectedButton.classList.add('active');
                selectedContent.classList.add('active');
            }
        }
