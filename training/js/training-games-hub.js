/* training-games-hub.js — page script (extracted from inline <script>, 2026.09.05.7) */

// ── moved from inline <script> in training/training-games-hub.html (Rule 3, 2026.09.05.7) ──
// Filter functionality
        document.querySelectorAll('.filter-pill').forEach(pill => {
            pill.addEventListener('click', function() {
                // Remove active from all pills
                document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
                // Add active to clicked pill
                this.classList.add('active');
                
                // Filter logic would go here
                const filterText = this.textContent.toLowerCase();
                
                if (filterText === 'all games') {
                    document.querySelectorAll('.category-section').forEach(section => {
                        section.style.display = 'block';
                    });
                } else {
                    // Show/hide categories based on filter
                    console.log('Filtering by:', filterText);
                }
            });
        });

        // Add hover effects to game cards
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-5px) scale(1.02)';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0) scale(1)';
            });
        });

        // Track game clicks for analytics
        document.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                if (!this.disabled) {
                    const gameTitle = this.closest('.game-card').querySelector('.game-title').textContent.trim();
                    console.log('Game launched:', gameTitle);
                    
                    // You could add analytics tracking here
                    // gtag('event', 'game_launch', { game_name: gameTitle });
                }
            });
        });

        // Add smooth scroll behavior
        document.documentElement.style.scrollBehavior = 'smooth';
