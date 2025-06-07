// Theme Utilities
// Phase 6: UI Redesign - Helper functions for theme management

import { themes, getCurrentTheme as getThemePreference } from './theme.js';

/**
 * Apply theme with transition effect
 * @param {string} themeName - Theme to apply
 * @param {boolean} smooth - Whether to use smooth transition
 */
export function applyTheme(themeName, smooth = true) {
  const root = document.documentElement;
  
  if (smooth) {
    // Add transition class
    root.classList.add('theme-transition');
    
    // Remove transition class after animation
    setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 300);
  }
  
  // Apply the theme
  const theme = themes[themeName] || themes.light;
  
  // Remove existing theme classes
  Object.keys(themes).forEach(name => {
    root.classList.remove(`theme-${name}`);
  });
  
  // Add new theme class
  root.classList.add(`theme-${theme.name}`);
  
  // Store preference
  localStorage.setItem('theme', theme.name);
  
  // Dispatch event
  window.dispatchEvent(new CustomEvent('themechange', { 
    detail: { 
      theme: theme.name,
      colors: theme.colors 
    } 
  }));
}

/**
 * Get current theme object
 * @returns {Object} Current theme configuration
 */
export function getTheme() {
  const themeName = getThemePreference();
  return themes[themeName] || themes.light;
}

/**
 * Toggle between light and dark themes
 * @returns {string} New theme name
 */
export function toggleTheme() {
  const current = getThemePreference();
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  return next;
}

/**
 * Create theme-aware color getter
 * @param {string} colorPath - Dot-separated path to color (e.g., 'text.primary')
 * @returns {string} CSS variable reference
 */
export function themed(colorPath) {
  return `var(--${colorPath.replace(/\./g, '-')})`;
}

/**
 * Media query helper for responsive design
 * @param {string} breakpoint - Breakpoint name from tokens
 * @returns {string} Media query string
 */
export function breakpoint(breakpoint) {
  const breakpoints = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  };
  
  return `@media (min-width: ${breakpoints[breakpoint]})`;
}

/**
 * Create responsive style object
 * @param {Object} styles - Object with breakpoint keys
 * @returns {Object} Flattened style object with media queries
 */
export function responsive(styles) {
  const result = {};
  
  Object.entries(styles).forEach(([key, value]) => {
    if (key === 'base' || !key.includes('@')) {
      Object.assign(result, value);
    } else {
      const bp = key.replace('@', '');
      result[breakpoint(bp)] = value;
    }
  });
  
  return result;
}

/**
 * Contrast color helper
 * @param {string} backgroundColor - Background color
 * @returns {string} Appropriate text color for contrast
 */
export function contrastColor(backgroundColor) {
  // Simple implementation - can be enhanced with proper color contrast calculation
  const isDark = backgroundColor.includes('dark') || 
                 backgroundColor.includes('900') || 
                 backgroundColor.includes('800');
  
  return isDark ? 'var(--text-inverse)' : 'var(--text-primary)';
}

/**
 * CSS-in-JS helper for creating styled components
 * @param {string} tag - HTML tag name
 * @param {Object} styles - Style object
 * @returns {Function} Component factory
 */
export function styled(tag, styles) {
  return function(props = {}) {
    const element = document.createElement(tag);
    
    // Apply base styles
    Object.entries(styles).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number') {
        element.style[key] = value;
      }
    });
    
    // Apply prop styles
    if (props.style) {
      Object.assign(element.style, props.style);
    }
    
    // Apply classes
    if (props.className) {
      element.className = props.className;
    }
    
    // Apply other props
    Object.entries(props).forEach(([key, value]) => {
      if (key !== 'style' && key !== 'className' && key !== 'children') {
        element.setAttribute(key, value);
      }
    });
    
    // Add children
    if (props.children) {
      if (Array.isArray(props.children)) {
        props.children.forEach(child => element.appendChild(child));
      } else if (typeof props.children === 'string') {
        element.textContent = props.children;
      } else {
        element.appendChild(props.children);
      }
    }
    
    return element;
  };
}

// Export all utilities
export default {
  applyTheme,
  getTheme,
  toggleTheme,
  themed,
  breakpoint,
  responsive,
  contrastColor,
  styled
};