/* staff-portal-final-page.js — extracted 2026-09-06 from an inline <script> in dashboards/staff-portal-final.html (Rule 3). Global scope kept: the page's data-call attributes resolve these functions on window. */
var STAFFP_LOG_ON = (typeof window !== 'undefined' && !!window.location && (window.location.hostname === 'localhost' || new URLSearchParams(window.location.search).has('debug')));
var staffpLog = STAFFP_LOG_ON ? console.log.bind(console) : function () {};
// Wait for page and Caspio to load
window.addEventListener('load', function() {
    // Give Caspio time to render
    setTimeout(function() {
        initializePortal();
    }, 1500);
});

function initializePortal() {
    // Try to get authenticated user data from hidden Caspio fields
    const firstName = document.getElementById('auth-firstname')?.textContent?.trim() || 
                    document.getElementById('user-firstname')?.textContent?.trim() || 
                    'Team Member';
    const lastName = document.getElementById('auth-lastname')?.textContent?.trim() || 
                   document.getElementById('user-lastname')?.textContent?.trim() || '';
    const email = document.getElementById('auth-email')?.textContent?.trim() || '';
    const role = document.getElementById('auth-role')?.textContent?.trim() || 'Staff';
    const lastLogin = document.getElementById('auth-lastlogin')?.textContent?.trim() || '';

    // Create full name
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;

    // Update header
    document.getElementById('headerWelcome').textContent = `Welcome, ${fullName}`;
    if (role) {
        document.getElementById('headerRole').textContent = role;
    }

    // Update personal welcome banner
    const hour = new Date().getHours();
    let greeting = 'Welcome back';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    else greeting = 'Good evening';

    document.getElementById('welcomeGreeting').textContent = `${greeting}, ${firstName}!`;

    // Personalized message based on time/day
    const messages = [
        "Let's make today productive!",
        "Ready to help customers create something amazing?",
        "Select a calculator below to get started",
        "Here to help you provide excellent service"
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    document.getElementById('welcomeMessage').textContent = randomMessage;

    // Show last login if available
    if (lastLogin) {
        const lastLoginEl = document.getElementById('lastLogin');
        lastLoginEl.textContent = `Last login: ${formatDate(lastLogin)}`;
        lastLoginEl.classList.add('show');
    }

    // Hide loading and show content with animation
    document.getElementById('loadingOverlay').classList.add('fade-out');
    document.getElementById('mainHeader').classList.add('show');
    document.getElementById('mainContent').classList.add('show');
    document.getElementById('personalWelcome').classList.add('show');

    // Store user info for use in calculators
    sessionStorage.setItem('nwca_user_name', fullName);
    sessionStorage.setItem('nwca_user_email', email);
    sessionStorage.setItem('nwca_user_role', role);

    // Log successful initialization
    staffpLog('Portal initialized for:', fullName);
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today at ' + date.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit' 
            });
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday at ' + date.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit' 
            });
        } else {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        }
    } catch (e) {
        return dateString;
    }
}

// Fallback if Caspio doesn't load
setTimeout(function() {
    if (!document.getElementById('mainContent').classList.contains('show')) {
        console.warn('Caspio data not loaded, showing default view');
        initializePortal();
    }
}, 3000);
