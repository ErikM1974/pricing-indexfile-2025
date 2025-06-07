// Theme Configuration
// Phase 6: UI Redesign - Theme management

import { tokens } from './tokens.js';

/**
 * Theme configuration with light and dark modes
 */
export const themes = {
  light: {
    name: 'light',
    colors: {
      // Surface colors
      background: tokens.colors.neutral[50],
      foreground: tokens.colors.neutral[0],
      card: tokens.colors.neutral[0],
      cardForeground: tokens.colors.neutral[950],
      popover: tokens.colors.neutral[0],
      popoverForeground: tokens.colors.neutral[950],
      
      // Primary colors
      primary: tokens.colors.primary[500],
      primaryForeground: tokens.colors.neutral[0],
      
      // Secondary colors
      secondary: tokens.colors.secondary[500],
      secondaryForeground: tokens.colors.neutral[0],
      
      // Muted colors
      muted: tokens.colors.neutral[100],
      mutedForeground: tokens.colors.neutral[600],
      
      // Accent colors
      accent: tokens.colors.primary[100],
      accentForeground: tokens.colors.primary[900],
      
      // Destructive colors
      destructive: tokens.colors.semantic.error.main,
      destructiveForeground: tokens.colors.semantic.error.contrast,
      
      // Border and input
      border: tokens.colors.neutral[200],
      input: tokens.colors.neutral[200],
      ring: tokens.colors.primary[500],
      
      // Text colors
      text: {
        primary: tokens.colors.neutral[900],
        secondary: tokens.colors.neutral[600],
        muted: tokens.colors.neutral[500],
        disabled: tokens.colors.neutral[400],
        inverse: tokens.colors.neutral[0]
      }
    },
    shadows: {
      sm: tokens.shadows.sm,
      md: tokens.shadows.md,
      lg: tokens.shadows.lg
    }
  },
  
  dark: {
    name: 'dark',
    colors: {
      // Surface colors
      background: tokens.colors.neutral[950],
      foreground: tokens.colors.neutral[50],
      card: tokens.colors.neutral[900],
      cardForeground: tokens.colors.neutral[50],
      popover: tokens.colors.neutral[900],
      popoverForeground: tokens.colors.neutral[50],
      
      // Primary colors
      primary: tokens.colors.primary[400],
      primaryForeground: tokens.colors.neutral[950],
      
      // Secondary colors
      secondary: tokens.colors.secondary[400],
      secondaryForeground: tokens.colors.neutral[950],
      
      // Muted colors
      muted: tokens.colors.neutral[800],
      mutedForeground: tokens.colors.neutral[400],
      
      // Accent colors
      accent: tokens.colors.primary[800],
      accentForeground: tokens.colors.primary[100],
      
      // Destructive colors
      destructive: tokens.colors.semantic.error.dark,
      destructiveForeground: tokens.colors.semantic.error.contrast,
      
      // Border and input
      border: tokens.colors.neutral[800],
      input: tokens.colors.neutral[800],
      ring: tokens.colors.primary[400],
      
      // Text colors
      text: {
        primary: tokens.colors.neutral[50],
        secondary: tokens.colors.neutral[300],
        muted: tokens.colors.neutral[400],
        disabled: tokens.colors.neutral[600],
        inverse: tokens.colors.neutral[950]
      }
    },
    shadows: {
      sm: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)',
      md: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
      lg: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
    }
  }
};

/**
 * Default theme
 */
export const defaultTheme = themes.light;

/**
 * Get current theme from localStorage or system preference
 * @returns {string} Theme name ('light' or 'dark')
 */
export function getCurrentTheme() {
  // Check localStorage first
  const stored = localStorage.getItem('theme');
  if (stored && themes[stored]) {
    return stored;
  }
  
  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  
  return 'light';
}

/**
 * Apply theme to document
 * @param {string} themeName - Theme name to apply
 */
export function applyTheme(themeName) {
  const theme = themes[themeName] || defaultTheme;
  const root = document.documentElement;
  
  // Apply theme class
  root.classList.remove('theme-light', 'theme-dark');
  root.classList.add(`theme-${theme.name}`);
  
  // Apply CSS variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    if (typeof value === 'object') {
      Object.entries(value).forEach(([subkey, subvalue]) => {
        root.style.setProperty(`--${key}-${subkey}`, subvalue);
      });
    } else {
      root.style.setProperty(`--${key}`, value);
    }
  });
  
  // Apply shadow variables
  Object.entries(theme.shadows).forEach(([key, value]) => {
    root.style.setProperty(`--shadow-${key}`, value);
  });
  
  // Store preference
  localStorage.setItem('theme', theme.name);
  
  // Dispatch theme change event
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

/**
 * Initialize theme on page load
 */
export function initializeTheme() {
  const currentTheme = getCurrentTheme();
  applyTheme(currentTheme);
  
  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}

// Export default theme object
export default {
  themes,
  defaultTheme,
  getCurrentTheme,
  applyTheme,
  initializeTheme
};