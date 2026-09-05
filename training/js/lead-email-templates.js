/* lead-email-templates.js — page script (extracted from inline <script>, 2026.09.05.11) */

// ── moved from inline <script> in training/lead-email-templates.html (Rule 3, 2026.09.05.11) ──
// Template Management
        function copyTemplate(button) {
            const card = button.closest('.template-card');
            const content = card.querySelector('.template-content').textContent;
            
            navigator.clipboard.writeText(content).then(() => {
                // Show success message
                const successMsg = document.getElementById('successMessage');
                successMsg.classList.add('active');
                
                // Update button temporarily
                const originalHTML = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i> Copied!';
                button.style.background = 'var(--success)';
                
                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.style.background = '';
                    successMsg.classList.remove('active');
                }, 2000);
            });
        }

        function editTemplate(button) {
            const card = button.closest('.template-card');
            const title = card.querySelector('.template-title').textContent;
            const subject = card.querySelector('.template-subject').textContent.replace('Subject: ', '');
            const content = card.querySelector('.template-content').textContent;
            
            // Populate modal
            document.getElementById('templateName').value = title;
            document.getElementById('templateSubject').value = subject;
            document.getElementById('templateBody').value = content;
            
            // Open modal
            document.getElementById('templateModal').classList.add('active');
        }

        function filterTemplates(category) {
            // Update active button
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Filter cards
            const cards = document.querySelectorAll('.template-card');
            cards.forEach(card => {
                if (category === 'all' || card.dataset.category === category) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        function searchTemplates(query) {
            const cards = document.querySelectorAll('.template-card');
            const searchTerm = query.toLowerCase();
            
            cards.forEach(card => {
                const title = card.querySelector('.template-title').textContent.toLowerCase();
                const desc = card.querySelector('.template-desc').textContent.toLowerCase();
                const content = card.querySelector('.template-content').textContent.toLowerCase();
                
                if (title.includes(searchTerm) || desc.includes(searchTerm) || content.includes(searchTerm)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        function openCreateModal() {
            // Clear form
            document.getElementById('templateForm').reset();
            document.getElementById('templateModal').classList.add('active');
        }

        function closeModal() {
            document.getElementById('templateModal').classList.remove('active');
        }

        function insertVariable(variable) {
            const textarea = document.getElementById('templateBody');
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            
            textarea.value = text.substring(0, start) + variable + text.substring(end);
            textarea.focus();
            textarea.setSelectionRange(start + variable.length, start + variable.length);
        }

        // Form submission
        document.getElementById('templateForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Save template to localStorage
            const template = {
                name: document.getElementById('templateName').value,
                category: document.getElementById('templateCategory').value,
                subject: document.getElementById('templateSubject').value,
                body: document.getElementById('templateBody').value,
                created: new Date().toISOString()
            };
            
            // Get existing templates
            let templates = JSON.parse(localStorage.getItem('nwca_email_templates') || '[]');
            templates.push(template);
            localStorage.setItem('nwca_email_templates', JSON.stringify(templates));
            
            // Show success and close modal
            alert('Template saved successfully!');
            closeModal();
            
            // Optionally reload templates
            location.reload();
        });

        // Load custom templates on page load
        document.addEventListener('DOMContentLoaded', () => {
            const customTemplates = JSON.parse(localStorage.getItem('nwca_email_templates') || '[]');
            
            // Add custom templates to the grid
            customTemplates.forEach(template => {
                // This would add the custom templates to the grid
                // Implementation depends on your needs
            });
        });
