/* lead-follow-up-guide.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in training/lead-follow-up-guide.html (Rule 3, 2026.09.05.11) ──
// Copy template function
        function copyTemplate(templateId) {
            const template = document.getElementById('template-' + templateId);
            const text = template.textContent;
            
            navigator.clipboard.writeText(text).then(() => {
                // Change button text temporarily
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                btn.style.background = 'var(--success)';
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                }, 2000);
            });
        }

        // Accordion toggle
        function toggleAccordion(header) {
            const content = header.nextElementSibling;
            const isActive = header.classList.contains('active');
            
            // Close all accordions
            document.querySelectorAll('.accordion-header').forEach(h => {
                h.classList.remove('active');
                h.nextElementSibling.classList.remove('active');
            });
            
            // Open clicked accordion if it wasn't active
            if (!isActive) {
                header.classList.add('active');
                content.classList.add('active');
            }
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            // Add smooth scrolling
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            });
        });
