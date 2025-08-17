/**
 * Utility Functions
 * Northwest Custom Apparel - Staff Dashboard
 * 
 * This module contains utility functions for:
 * - Date formatting and calculations
 * - Data loading and API calls
 * - Chart creation and updates
 * - Production schedule management
 * - Weather widget functionality
 */

(function(window) {
    'use strict';
    
    // =====================================================
    // API CONFIGURATION
    // =====================================================
    
    const API_CONFIG = {
        baseURL: 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api',
        timeout: 10000
    };
    
    // =====================================================
    // DATE & TIME UTILITIES
    // =====================================================
    
    /**
     * Calculate days until a specific date
     * @param {string} dateString - Date string to calculate to
     * @returns {number} Number of days until the date
     */
    function calculateDaysUntil(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    }
    
    /**
     * Calculate rush date (7 days before standard date)
     * @param {string} standardDate - Standard delivery date
     * @returns {string} Rush date as ISO string
     */
    function calculateRushDate(standardDate) {
        const date = new Date(standardDate);
        date.setDate(date.getDate() - 7);
        return date.toISOString();
    }
    
    /**
     * Format availability date for display
     * @param {string} dateString - Date to format
     * @returns {string} Formatted availability string
     */
    function formatAvailabilityDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const daysUntil = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= 0) {
            return 'Available Now';
        } else if (daysUntil === 1) {
            return 'Available Tomorrow';
        } else if (daysUntil <= 7) {
            return `Available in ${daysUntil} days`;
        } else {
            return `Available ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
    }
    
    /**
     * Get production status class based on days until availability
     * @param {number} daysUntil - Days until available
     * @returns {string} CSS class name for status
     */
    function getProductionStatusClass(daysUntil) {
        if (daysUntil <= 2) return 'available-now';
        if (daysUntil <= 5) return 'available-soon';
        return 'busy';
    }
    
    // =====================================================
    // DATA LOADING FUNCTIONS
    // =====================================================
    
    /**
     * Load revenue data from API
     * @param {number} days - Number of days to load
     * @returns {Promise<Object>} Revenue data
     */
    async function loadRevenueData(days = 30) {
        console.log(`[Total Revenue] Loading data for ${days} days`);
        
        try {
            const response = await fetch(
                `${API_CONFIG.baseURL}/order-dashboard?days=${days}`,
                { timeout: API_CONFIG.timeout }
            );
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error('[Total Revenue] Error loading data:', error);
            throw error;
        }
    }
    
    /**
     * Load production schedule from API
     * @returns {Promise<Object>} Production schedule data
     */
    async function loadProductionSchedule() {
        try {
            const response = await fetch(
                `${API_CONFIG.baseURL}/production-schedules?q.orderBy=Date%20DESC&q.limit=1`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch production schedule');
            }
            
            const schedules = await response.json();
            
            if (schedules && schedules.length > 0) {
                const schedule = schedules[0];
                console.log('[Production] Schedule loaded:', schedule);
                return schedule;
            }
            
            throw new Error('No production schedule found');
            
        } catch (error) {
            console.error('[Production] Error loading schedule:', error);
            throw error;
        }
    }
    
    /**
     * Load year-over-year comparison data
     * @returns {Promise<Object>} YoY comparison data
     */
    async function loadYearOverYear() {
        try {
            const response = await fetch(
                `${API_CONFIG.baseURL}/order-dashboard?compareYoY=true`
            );
            
            if (!response.ok) {
                throw new Error('API request failed');
            }
            
            const data = await response.json();
            return data.yoyComparison;
            
        } catch (error) {
            console.error('YoY API Error:', error);
            throw error;
        }
    }
    
    /**
     * Load sales team performance data
     * @param {number} days - Number of days to load
     * @returns {Promise<Object>} Sales team performance data
     */
    async function loadSalesTeamPerformance(days = 30) {
        console.log(`[Sales Team] Loading performance data for ${days} days...`);
        
        try {
            const apiUrl = `${API_CONFIG.baseURL}/order-dashboard?days=${days}`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error('[Sales Team] Error loading data:', error);
            throw error;
        }
    }
    
    /**
     * Load order types breakdown data
     * @param {number} days - Number of days to load
     * @returns {Promise<Object>} Order types data
     */
    async function loadOrderTypesBreakdown(days = 30) {
        console.log(`[Order Types] Loading breakdown data for ${days} days...`);
        
        try {
            const apiUrl = `${API_CONFIG.baseURL}/order-dashboard?days=${days}&includeDetails=true`;
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error('[Order Types] Error loading data:', error);
            throw error;
        }
    }
    
    // =====================================================
    // CHART UTILITIES
    // =====================================================
    
    /**
     * Chart instances storage
     */
    const chartInstances = {};
    
    /**
     * Create or update a chart
     * @param {string} canvasId - ID of the canvas element
     * @param {Object} config - Chart.js configuration
     * @returns {Object} Chart instance
     */
    function createOrUpdateChart(canvasId, config) {
        if (!window.Chart) {
            console.error('Chart.js not loaded');
            return null;
        }
        
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas element not found: ${canvasId}`);
            return null;
        }
        
        // Destroy existing chart if it exists
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }
        
        // Create new chart
        const ctx = canvas.getContext('2d');
        chartInstances[canvasId] = new Chart(ctx, config);
        
        return chartInstances[canvasId];
    }
    
    /**
     * Destroy a chart instance
     * @param {string} canvasId - ID of the canvas element
     */
    function destroyChart(canvasId) {
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
            delete chartInstances[canvasId];
        }
    }
    
    // =====================================================
    // DISPLAY UPDATE FUNCTIONS
    // =====================================================
    
    /**
     * Update production schedule display
     * @param {Object} schedule - Production schedule data
     */
    function updateProductionDisplay(schedule) {
        const heroContainer = document.querySelector('.production-schedule-hero .production-grid');
        const widgetContainer = document.querySelector('[data-widget="production-schedule"] .schedule-list');
        
        if (!schedule) {
            showProductionError();
            return;
        }
        
        const types = [
            { key: 'DTG_Standard', label: 'DTG', icon: '🖨️' },
            { key: 'Embroidery_Standard', label: 'Embroidery', icon: '🧵' },
            { key: 'Screen_Standard', label: 'Screen Print', icon: '🎨' }
        ];
        
        // Update hero display
        if (heroContainer) {
            let heroHTML = '';
            types.forEach(type => {
                const dateStr = schedule[type.key];
                if (dateStr) {
                    const daysUntil = calculateDaysUntil(dateStr);
                    const statusClass = getProductionStatusClass(daysUntil);
                    
                    heroHTML += `
                        <div class="production-type-card ${statusClass}">
                            <div class="production-type-header">
                                <span class="production-icon">${type.icon}</span>
                                <span class="production-label">${type.label}</span>
                            </div>
                            <div class="production-availability">
                                ${formatAvailabilityDate(dateStr)}
                            </div>
                        </div>
                    `;
                }
            });
            heroContainer.innerHTML = heroHTML;
        }
        
        // Update widget display
        if (widgetContainer) {
            let widgetHTML = '';
            types.forEach(type => {
                const dateStr = schedule[type.key];
                if (dateStr) {
                    const date = new Date(dateStr);
                    const formattedDate = date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                    });
                    
                    widgetHTML += `
                        <div class="schedule-item">
                            <div class="schedule-type">${type.label}</div>
                            <div class="schedule-date">${formattedDate}</div>
                        </div>
                    `;
                }
            });
            widgetContainer.innerHTML = widgetHTML;
        }
    }
    
    /**
     * Show production schedule error
     */
    function showProductionError() {
        const container = document.querySelector('[data-widget="production-schedule"] .schedule-list');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--danger);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    <p>Production schedule unavailable</p>
                </div>
            `;
        }
    }
    
    // =====================================================
    // WEATHER WIDGET
    // =====================================================
    
    /**
     * Load weather data for Milton, WA
     */
    async function loadWeatherData() {
        const widget = document.getElementById('weatherWidget');
        if (!widget) return;
        
        try {
            // Using Milton, WA coordinates
            const lat = 47.2489;
            const lon = -122.3128;
            const apiKey = 'bd5e378503939ddaee76f12ad7a97608'; // Free tier API key
            
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`
            );
            
            if (!response.ok) {
                throw new Error('Weather API request failed');
            }
            
            const data = await response.json();
            updateWeatherDisplay(data);
            
        } catch (error) {
            console.error('[Weather] Error loading data:', error);
            showWeatherError();
        }
    }
    
    /**
     * Update weather widget display
     * @param {Object} data - Weather API data
     */
    function updateWeatherDisplay(data) {
        const widget = document.getElementById('weatherWidget');
        if (!widget) return;
        
        const temp = Math.round(data.main.temp);
        const description = data.weather[0].description;
        const icon = getWeatherIcon(data.weather[0].main);
        const humidity = data.main.humidity;
        const windSpeed = Math.round(data.wind.speed);
        
        widget.innerHTML = `
            <div class="weather-main">
                <div class="weather-icon">${icon}</div>
                <div class="weather-info">
                    <div class="weather-temp">${temp}°F</div>
                    <div class="weather-desc">${description}</div>
                    <div class="weather-location">Milton, WA</div>
                </div>
            </div>
            <div class="weather-extra">
                <div class="weather-stat">
                    <div class="weather-stat-value">${humidity}%</div>
                    <div class="weather-stat-label">Humidity</div>
                </div>
                <div class="weather-stat">
                    <div class="weather-stat-value">${windSpeed} mph</div>
                    <div class="weather-stat-label">Wind</div>
                </div>
            </div>
        `;
    }
    
    /**
     * Get weather icon based on condition
     * @param {string} condition - Weather condition
     * @returns {string} Weather emoji
     */
    function getWeatherIcon(condition) {
        const icons = {
            'Clear': '☀️',
            'Clouds': '☁️',
            'Rain': '🌧️',
            'Drizzle': '🌦️',
            'Thunderstorm': '⛈️',
            'Snow': '❄️',
            'Mist': '🌫️',
            'Fog': '🌫️',
            'Haze': '🌫️'
        };
        return icons[condition] || '🌤️';
    }
    
    /**
     * Show weather error message
     */
    function showWeatherError() {
        const widget = document.getElementById('weatherWidget');
        if (widget) {
            widget.innerHTML = `
                <div class="weather-error">
                    <i class="fas fa-exclamation-circle"></i>
                    Weather data unavailable
                </div>
            `;
        }
    }
    
    // =====================================================
    // SECTION PREFERENCES
    // =====================================================
    
    /**
     * Load section preferences from localStorage
     */
    function loadSectionPreferences() {
        // Check announcements preference
        const announcementsExpanded = localStorage.getItem('section_announcements_expanded');
        if (announcementsExpanded === 'false') {
            const announcementsContainer = document.getElementById('announcementsContainer');
            if (announcementsContainer) {
                announcementsContainer.classList.add('collapsed');
                announcementsContainer.classList.remove('expanded');
            }
        }
        
        // Check sales metrics preference
        const salesMetricsExpanded = localStorage.getItem('section_salesMetrics_expanded');
        if (salesMetricsExpanded === 'false') {
            const salesMetricsContainer = document.getElementById('salesMetricsContainer');
            if (salesMetricsContainer) {
                salesMetricsContainer.classList.add('collapsed');
                salesMetricsContainer.classList.remove('expanded');
            }
        }
    }
    
    // =====================================================
    // PUBLIC API
    // =====================================================
    
    // Export to global namespace
    window.DashboardUtilities = {
        // API Configuration
        API_CONFIG: API_CONFIG,
        
        // Date utilities
        calculateDaysUntil: calculateDaysUntil,
        calculateRushDate: calculateRushDate,
        formatAvailabilityDate: formatAvailabilityDate,
        getProductionStatusClass: getProductionStatusClass,
        
        // Data loading
        loadRevenueData: loadRevenueData,
        loadProductionSchedule: loadProductionSchedule,
        loadYearOverYear: loadYearOverYear,
        loadSalesTeamPerformance: loadSalesTeamPerformance,
        loadOrderTypesBreakdown: loadOrderTypesBreakdown,
        
        // Chart utilities
        createOrUpdateChart: createOrUpdateChart,
        destroyChart: destroyChart,
        
        // Display updates
        updateProductionDisplay: updateProductionDisplay,
        showProductionError: showProductionError,
        
        // Weather widget
        loadWeatherData: loadWeatherData,
        
        // Preferences
        loadSectionPreferences: loadSectionPreferences,
        
        // Initialize
        init: function() {
            console.log('[DashboardUtilities] Initializing utilities module');
            
            // Load section preferences
            loadSectionPreferences();
            
            // Load weather data
            loadWeatherData();
            
            console.log('[DashboardUtilities] Utilities module initialized');
        }
    };
    
})(window);