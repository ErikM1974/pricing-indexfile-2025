/* get-to-know-erik.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in training/get-to-know-erik.html (Rule 3, 2026.09.05.11) ──
function toggleSection(section) {
            section.classList.toggle('collapsed');
        }

        // Expand all sections for printing
        window.addEventListener('beforeprint', () => {
            document.querySelectorAll('.bio-section').forEach(section => {
                section.classList.remove('collapsed');
            });
        });
