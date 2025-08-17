/**
 * Navigation and UI Control Functions
 * Northwest Custom Apparel - Staff Dashboard
 * 
 * This module handles all navigation-related functions including:
 * - Sidebar section toggling and state management
 * - View switching and routing
 * - User dropdown menus
 * - Collapsible panels and sections
 * - Logout functionality
 */

(function(window) {
    'use strict';
    
    // =====================================================
    // SIDEBAR NAVIGATION
    // =====================================================
    
    /**
     * Toggle sidebar section expand/collapse state
     * @param {HTMLElement} section - The section element to toggle
     */
    function toggleSidebarSection(section) {
        section.classList.toggle('collapsed');
        
        // Update chevron rotation
        const chevron = section.querySelector('.chevron');
        if (chevron) {
            if (section.classList.contains('collapsed')) {
                chevron.style.transform = 'rotate(-90deg)';
            } else {
                chevron.style.transform = 'rotate(0deg)';
            }
        }
        
        // Save state to localStorage
        const sectionId = section.getAttribute('data-section');
        const isCollapsed = section.classList.contains('collapsed');
        localStorage.setItem(`sidebar-section-${sectionId}`, isCollapsed);
        
        // Debug logging
        console.log(`[Sidebar] Toggled ${sectionId}: ${isCollapsed ? 'collapsed' : 'expanded'}`);
    }
    
    /**
     * Restore sidebar section states from localStorage
     */
    function restoreSidebarStates() {
        const sections = document.querySelectorAll('.nav-section[data-section]');
        console.log(`[Sidebar] Restoring states for ${sections.length} sections`);
        
        sections.forEach(section => {
            const sectionId = section.getAttribute('data-section');
            const savedState = localStorage.getItem(`sidebar-section-${sectionId}`);
            const chevron = section.querySelector('.chevron');
            
            // Default states - ALL sections start collapsed
            let shouldBeCollapsed = true;
            
            if (savedState !== null) {
                // Only override default if user has explicitly expanded
                shouldBeCollapsed = (savedState === 'true');
            }
            
            if (shouldBeCollapsed) {
                section.classList.add('collapsed');
                if (chevron) {
                    chevron.style.transform = 'rotate(-90deg)';
                }
            } else {
                section.classList.remove('collapsed');
                if (chevron) {
                    chevron.style.transform = 'rotate(0deg)';
                }
            }
            
            console.log(`[Sidebar] ${sectionId}: ${shouldBeCollapsed ? 'collapsed' : 'expanded'} (saved: ${savedState})`);
        });
    }
    
    // =====================================================
    // USER AUTHENTICATION & DROPDOWN
    // =====================================================
    
    /**
     * Handle user logout
     */
    function handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            try {
                // Clear any stored authentication data
                sessionStorage.clear();
                localStorage.clear();
                
                // Clear any cookies (if applicable)
                document.cookie.split(";").forEach(function(c) { 
                    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
                });
                
                // Show logout message
                alert('You have been successfully logged out.');
                
                // Redirect to Caspio logout or homepage
                try {
                    window.location.href = 'https://c3eku948.caspio.com/folderlogout';
                } catch (error) {
                    window.location.href = 'https://www.teamnwca.com';
                }
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = 'https://www.teamnwca.com';
            }
        }
    }
    
    /**
     * Toggle user dropdown menu
     * @param {Event} event - Click event
     */
    function toggleUserDropdown(event) {
        event.stopPropagation();
        const userMenu = document.querySelector('.user-menu');
        const dropdown = document.getElementById('userDropdown');
        
        if (dropdown.classList.contains('show')) {
            dropdown.classList.remove('show');
            userMenu.classList.remove('active');
        } else {
            dropdown.classList.add('show');
            userMenu.classList.add('active');
        }
    }
    
    /**
     * Setup dropdown close on outside click
     */
    function setupDropdownHandlers() {
        document.addEventListener('click', function(event) {
            const dropdown = document.getElementById('userDropdown');
            const userMenu = document.querySelector('.user-menu');
            
            if (dropdown && userMenu && !userMenu.contains(event.target)) {
                dropdown.classList.remove('show');
                userMenu.classList.remove('active');
            }
        });
    }
    
    // =====================================================
    // VIEW SWITCHING
    // =====================================================
    
    /**
     * Switch between different dashboard views
     * @param {string} viewName - Name of the view to switch to
     */
    function switchView(viewName) {
        // Hide all views
        document.querySelectorAll('.view-content').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show selected view
        const selectedView = document.getElementById(viewName + 'View');
        if (selectedView) {
            selectedView.classList.add('active');
        }
        
        // Update nav active state
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
    }
    
    // =====================================================
    // COLLAPSIBLE SECTIONS
    // =====================================================
    
    /**
     * Toggle collapsible content sections
     * @param {string} sectionName - Name of the section to toggle
     */
    function toggleSection(sectionName) {
        let content, toggle, section;
        
        if (sectionName === 'announcements') {
            content = document.getElementById('announcementsContainer');
            toggle = document.getElementById('announcementsToggle');
            section = document.querySelector('.announcements-section');
        } else if (sectionName === 'salesMetrics') {
            content = document.getElementById('salesMetricsContainer');
            toggle = document.getElementById('salesMetricsToggle');
            section = document.querySelector('.sales-metrics-section');
        }
        
        if (content && toggle && section) {
            const isExpanded = content.classList.contains('expanded');
            
            if (isExpanded) {
                // Collapse
                content.classList.remove('expanded');
                content.classList.add('collapsed');
                content.style.maxHeight = '0';
                content.style.overflow = 'hidden';
                toggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
                section.classList.remove('expanded');
                section.classList.add('collapsed');
                const ariaElement = section.querySelector('[aria-expanded]');
                if (ariaElement) ariaElement.setAttribute('aria-expanded', 'false');
            } else {
                // Expand
                content.classList.remove('collapsed');
                content.classList.add('expanded');
                content.style.maxHeight = '400px';
                content.style.overflow = 'auto';
                toggle.innerHTML = '<i class="fas fa-chevron-up"></i>';
                section.classList.remove('collapsed');
                section.classList.add('expanded');
                const ariaElement = section.querySelector('[aria-expanded]');
                if (ariaElement) ariaElement.setAttribute('aria-expanded', 'true');
            }
            
            // Save preference to localStorage
            localStorage.setItem(`section_${sectionName}_expanded`, !isExpanded);
        }
    }
    
    /**
     * Toggle metrics panel (sticky bottom bar)
     */
    function toggleMetricsPanel() {
        const panel = document.getElementById('slideUpMetricsPanel');
        const icon = document.getElementById('metricsExpandIcon');
        const text = document.getElementById('metricsExpandText');
        const content = panel.querySelector('.metrics-panel-content');
        
        if (panel.classList.contains('expanded')) {
            // Collapse the panel
            panel.classList.remove('expanded');
            icon.className = 'fas fa-chevron-up';
            text.textContent = 'View Full Dashboard';
            localStorage.setItem('metricsPanel_expanded', 'false');
        } else {
            // Expand the panel
            panel.classList.add('expanded');
            icon.className = 'fas fa-chevron-down';
            text.textContent = 'Collapse';
            localStorage.setItem('metricsPanel_expanded', 'true');
            
            // Load metrics content if not already loaded or if it's empty
            if (!content.querySelector('#clonedSalesMetrics')) {
                loadMetricsPanelContent();
            }
        }
    }
    
    /**
     * Load metrics content into the slide-up panel
     */
    function loadMetricsPanelContent() {
        const content = document.querySelector('.metrics-panel-content');
        const salesMetricsContainer = document.getElementById('salesMetricsContainer');
        
        if (salesMetricsContainer) {
            // Clone the entire sales metrics content
            const clonedContent = salesMetricsContainer.cloneNode(true);
            clonedContent.id = 'clonedSalesMetrics'; // Change ID to avoid conflicts
            
            // Clear and add the cloned content
            content.innerHTML = '';
            content.appendChild(clonedContent);
            
            // Make sure it's visible
            clonedContent.style.display = 'block';
            clonedContent.classList.remove('collapsed');
            clonedContent.classList.add('expanded');
            
            // Re-attach event handlers for date range buttons
            setupMetricsPanelEventHandlers(content);
        }
    }
    
    /**
     * Setup event handlers for metrics panel buttons
     * @param {HTMLElement} content - The metrics panel content element
     */
    function setupMetricsPanelEventHandlers(content) {
        const dateRangeBtns = content.querySelectorAll('.date-range-btn');
        dateRangeBtns.forEach(btn => {
            // Remove old onclick attributes
            btn.removeAttribute('onclick');
            
            // Add new event listeners
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const days = parseInt(this.getAttribute('data-days'));
                const selector = this.closest('.date-range-selector');
                
                // Update active state
                selector.querySelectorAll('.date-range-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                // Call appropriate function based on context
                // Note: These functions should be available in the global scope
                // or passed in through initialization
                if (selector.classList.contains('sales-team-date-selector')) {
                    if (window.changeSalesTeamRange) {
                        window.changeSalesTeamRange(days);
                    }
                } else if (selector.classList.contains('order-types-date-selector')) {
                    if (window.changeOrderTypesRange) {
                        window.changeOrderTypesRange(days);
                    }
                } else {
                    if (window.changeDateRange) {
                        window.changeDateRange(days);
                    }
                }
            });
        });
    }
    
    /**
     * Restore section states from localStorage
     */
    function restoreSectionStates() {
        // Restore collapsible sections
        ['announcements', 'salesMetrics'].forEach(sectionName => {
            const isExpanded = localStorage.getItem(`section_${sectionName}_expanded`) === 'true';
            if (isExpanded) {
                toggleSection(sectionName);
            }
        });
        
        // Restore metrics panel state
        const metricsPanelExpanded = localStorage.getItem('metricsPanel_expanded') === 'true';
        if (metricsPanelExpanded) {
            const panel = document.getElementById('slideUpMetricsPanel');
            if (panel && !panel.classList.contains('expanded')) {
                toggleMetricsPanel();
            }
        }
    }
    
    // =====================================================
    // PUBLIC API
    // =====================================================
    
    // Export to global namespace
    window.DashboardNavigation = {
        // Sidebar functions
        toggleSidebarSection: toggleSidebarSection,
        restoreSidebarStates: restoreSidebarStates,
        
        // User functions
        handleLogout: handleLogout,
        toggleUserDropdown: toggleUserDropdown,
        
        // View functions
        switchView: switchView,
        
        // Section functions
        toggleSection: toggleSection,
        toggleMetricsPanel: toggleMetricsPanel,
        loadMetricsPanelContent: loadMetricsPanelContent,
        
        // Initialize
        init: function() {
            console.log('[DashboardNavigation] Initializing navigation module');
            
            // Setup event handlers
            setupDropdownHandlers();
            
            // Restore saved states
            restoreSidebarStates();
            restoreSectionStates();
            
            console.log('[DashboardNavigation] Navigation module initialized');
        }
    };
    
})(window);