/* quick-reference-tips.js — page script (extracted from inline <script>, 2026.09.05.7) */

// ── moved from inline <script> in training/quick-reference-tips.html (Rule 3, 2026.09.05.7) ──
let allTips = [];

        async function loadTips() {
            try {
                const response = await fetch('quick-tips-data.json');
                const data = await response.json();
                allTips = data.tips;
                displayTips(allTips);
                updateStats();
            } catch (error) {
                console.error('Error loading tips:', error);
                document.getElementById('tipsContainer').innerHTML = `
                    <div class="no-tips">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Unable to load tips. Please refresh the page.</p>
                    </div>
                `;
            }
        }

        function displayTips(tips) {
            const container = document.getElementById('tipsContainer');
            
            if (tips.length === 0) {
                container.innerHTML = `
                    <div class="no-tips">
                        <i class="fas fa-inbox"></i>
                        <p>No tips found</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = tips.map(tip => {
                const isNew = isWithinDays(tip.addedDate, 7);
                const formattedDate = new Date(tip.addedDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });

                return `
                    <div class="tip-card">
                        <div class="tip-header">
                            <div class="tip-title">
                                ${tip.title}
                                ${isNew ? '<span class="new-badge">NEW</span>' : ''}
                            </div>
                            <div class="tip-date">Added: ${formattedDate}</div>
                        </div>
                        <div class="tip-body">
                            ${tip.content}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function isWithinDays(dateStr, days) {
            const date = new Date(dateStr);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= days;
        }

        function updateStats() {
            // Total tips
            document.getElementById('totalTips').textContent = allTips.length;
            
            // New tips (within 7 days)
            const newTipsCount = allTips.filter(tip => isWithinDays(tip.addedDate, 7)).length;
            document.getElementById('newTips').textContent = newTipsCount;
            
            // Categories
            const categories = [...new Set(allTips.map(tip => tip.category || 'general'))];
            document.getElementById('categoryCount').textContent = categories.length;
        }

        // Search functionality
        document.getElementById('searchInput').addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            
            if (!searchTerm) {
                displayTips(allTips);
                return;
            }

            const filteredTips = allTips.filter(tip => {
                const searchContent = (tip.title + ' ' + tip.content).toLowerCase();
                return searchContent.includes(searchTerm);
            });

            displayTips(filteredTips);
        });

        // Load tips on page load
        loadTips();
