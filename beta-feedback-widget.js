// Beta Feedback Widget
// Add this to the beta cap embroidery page to collect user feedback

(function() {
    'use strict';
    
    // Only run on the beta page
    if (!window.location.pathname.includes('cap-embroidery-pricing-integrated.html')) {
        return;
    }
    
    // Create feedback widget
    function createFeedbackWidget() {
        // Widget HTML
        const widgetHTML = `
            <div id="beta-feedback-widget" style="
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                font-family: Arial, sans-serif;
            ">
                <!-- Feedback Button -->
                <button id="feedback-toggle" style="
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 25px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <span>💬</span>
                    <span>Feedback</span>
                </button>
                
                <!-- Feedback Form -->
                <div id="feedback-form" style="
                    display: none;
                    position: absolute;
                    bottom: 60px;
                    right: 0;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    padding: 20px;
                    width: 320px;
                    max-width: 90vw;
                ">
                    <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">
                        How's the new system working?
                    </h3>
                    
                    <!-- Quick Rating -->
                    <div style="margin-bottom: 15px;">
                        <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">Rate your experience:</p>
                        <div id="rating-buttons" style="display: flex; gap: 10px;">
                            <button class="rating-btn" data-rating="1" style="
                                padding: 8px 16px;
                                border: 1px solid #ddd;
                                background: white;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 14px;
                                transition: all 0.2s;
                            ">😟 Poor</button>
                            <button class="rating-btn" data-rating="2" style="
                                padding: 8px 16px;
                                border: 1px solid #ddd;
                                background: white;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 14px;
                                transition: all 0.2s;
                            ">😐 OK</button>
                            <button class="rating-btn" data-rating="3" style="
                                padding: 8px 16px;
                                border: 1px solid #ddd;
                                background: white;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 14px;
                                transition: all 0.2s;
                            ">😊 Good</button>
                            <button class="rating-btn" data-rating="4" style="
                                padding: 8px 16px;
                                border: 1px solid #ddd;
                                background: white;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 14px;
                                transition: all 0.2s;
                            ">🤩 Great</button>
                        </div>
                    </div>
                    
                    <!-- Feedback Text -->
                    <div style="margin-bottom: 15px;">
                        <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">
                            Any comments? (optional)
                        </p>
                        <textarea id="feedback-text" style="
                            width: 100%;
                            min-height: 80px;
                            padding: 8px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-size: 14px;
                            resize: vertical;
                            box-sizing: border-box;
                        " placeholder="What did you like? What could be better?"></textarea>
                    </div>
                    
                    <!-- Quick Issues -->
                    <div style="margin-bottom: 15px;">
                        <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">
                            Did you experience any issues?
                        </p>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            <label style="display: flex; align-items: center; font-size: 14px;">
                                <input type="checkbox" value="pricing" style="margin-right: 4px;">
                                Pricing errors
                            </label>
                            <label style="display: flex; align-items: center; font-size: 14px;">
                                <input type="checkbox" value="slow" style="margin-right: 4px;">
                                Slow loading
                            </label>
                            <label style="display: flex; align-items: center; font-size: 14px;">
                                <input type="checkbox" value="confusing" style="margin-right: 4px;">
                                Confusing
                            </label>
                            <label style="display: flex; align-items: center; font-size: 14px;">
                                <input type="checkbox" value="other" style="margin-right: 4px;">
                                Other
                            </label>
                        </div>
                    </div>
                    
                    <!-- Submit -->
                    <div style="display: flex; gap: 10px;">
                        <button id="submit-feedback" style="
                            flex: 1;
                            background: #4CAF50;
                            color: white;
                            border: none;
                            padding: 10px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: bold;
                        ">Send Feedback</button>
                        <button id="close-feedback" style="
                            padding: 10px 20px;
                            background: #f5f5f5;
                            color: #666;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                        ">Close</button>
                    </div>
                    
                    <!-- Success Message -->
                    <div id="feedback-success" style="
                        display: none;
                        padding: 15px;
                        background: #d4edda;
                        color: #155724;
                        border-radius: 4px;
                        text-align: center;
                        font-size: 14px;
                    ">
                        ✅ Thank you for your feedback!
                    </div>
                </div>
            </div>
        `;
        
        // Add to page
        const widgetDiv = document.createElement('div');
        widgetDiv.innerHTML = widgetHTML;
        document.body.appendChild(widgetDiv.firstElementChild);
        
        // Add event listeners
        addEventListeners();
    }
    
    function addEventListeners() {
        const toggle = document.getElementById('feedback-toggle');
        const form = document.getElementById('feedback-form');
        const closeBtn = document.getElementById('close-feedback');
        const submitBtn = document.getElementById('submit-feedback');
        const ratingBtns = document.querySelectorAll('.rating-btn');
        
        let selectedRating = null;
        
        // Toggle form
        toggle.addEventListener('click', function() {
            form.style.display = form.style.display === 'none' ? 'block' : 'none';
        });
        
        // Close form
        closeBtn.addEventListener('click', function() {
            form.style.display = 'none';
        });
        
        // Rating buttons
        ratingBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                selectedRating = this.dataset.rating;
                ratingBtns.forEach(b => {
                    b.style.background = 'white';
                    b.style.color = '#333';
                });
                this.style.background = '#4CAF50';
                this.style.color = 'white';
            });
        });
        
        // Submit feedback
        submitBtn.addEventListener('click', function() {
            const feedbackText = document.getElementById('feedback-text').value;
            const issues = Array.from(document.querySelectorAll('#feedback-form input[type="checkbox"]:checked'))
                .map(cb => cb.value);
            
            const feedbackData = {
                page: 'cap-embroidery-beta',
                rating: selectedRating,
                comment: feedbackText,
                issues: issues,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent,
                product: new URLSearchParams(window.location.search).get('StyleNumber') || 'unknown'
            };
            
            // Send feedback
            submitFeedback(feedbackData);
            
            // Show success message
            document.getElementById('feedback-success').style.display = 'block';
            document.getElementById('submit-feedback').style.display = 'none';
            
            // Reset and close after 2 seconds
            setTimeout(function() {
                form.style.display = 'none';
                document.getElementById('feedback-success').style.display = 'none';
                document.getElementById('submit-feedback').style.display = 'block';
                document.getElementById('feedback-text').value = '';
                selectedRating = null;
                ratingBtns.forEach(b => {
                    b.style.background = 'white';
                    b.style.color = '#333';
                });
            }, 2000);
        });
    }
    
    function submitFeedback(data) {
        // Try to send to server
        try {
            fetch('/api/feedback/beta', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }).catch(err => console.log('Feedback submission failed:', err));
        } catch (err) {
            // Fail silently
        }
        
        // Also log to console for debugging
        console.log('Beta Feedback Submitted:', data);
        
        // Store locally as backup
        try {
            const existingFeedback = JSON.parse(localStorage.getItem('betaFeedback') || '[]');
            existingFeedback.push(data);
            localStorage.setItem('betaFeedback', JSON.stringify(existingFeedback));
        } catch (err) {
            // Fail silently
        }
        
        // Send to Google Analytics if available
        if (typeof gtag !== 'undefined') {
            gtag('event', 'feedback_submitted', {
                'event_category': 'Beta Feedback',
                'event_label': 'Cap Embroidery',
                'value': parseInt(data.rating) || 0
            });
        }
    }
    
    // Initialize widget when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createFeedbackWidget);
    } else {
        createFeedbackWidget();
    }
})();

// Function to retrieve stored feedback (for admin use)
window.getBetaFeedback = function() {
    try {
        const feedback = JSON.parse(localStorage.getItem('betaFeedback') || '[]');
        console.table(feedback);
        return feedback;
    } catch (err) {
        console.error('Error retrieving feedback:', err);
        return [];
    }
};