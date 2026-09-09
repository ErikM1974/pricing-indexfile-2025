/* training-games-hub.js — page script (extracted from inline <script>, 2026.09.05.7) */

// ── moved from inline <script> in training/training-games-hub.html (Rule 3, 2026.09.05.7) ──
// Filter functionality
var TRAIGAMEHUB_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var traigamehubLog = TRAIGAMEHUB_LOG_ON ? console.log.bind(console) : function () {}; // debug logging: localhost or ?debug=1 only (2026-09-06 console sweep)
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
                    traigamehubLog('Filtering by:', filterText);
                }
            });
        });

        // Card appearance and reduced-motion behavior belong to CSS.

        // Track game clicks for analytics
        document.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                if (!this.disabled) {
                    const gameTitle = this.closest('.game-card').querySelector('.game-title').textContent.trim();
                    traigamehubLog('Game launched:', gameTitle);
                    
                    // You could add analytics tracking here
                    // gtag('event', 'game_launch', { game_name: gameTitle });
                }
            });
        });
