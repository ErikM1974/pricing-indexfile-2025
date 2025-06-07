// Design System Main Export
// Phase 6: UI Redesign - Central export for all design system modules

// Export tokens
export * from './tokens/index.js';

// Export components
export * from './components/index.js';

// Initialize design system
export async function initializeDesignSystem(options = {}) {
  const {
    theme = 'light',
    includeStyles = true,
    initToasts = true
  } = options;
  
  // Initialize theme
  const { initializeTheme } = await import('./tokens/theme.js');
  initializeTheme();
  
  // Apply initial theme
  if (theme) {
    const { applyTheme } = await import('./tokens/theme-utils.js');
    applyTheme(theme);
  }
  
  // Include component styles
  if (includeStyles) {
    const { getAllComponentStyles } = await import('./components/index.js');
    const styleElement = document.createElement('style');
    styleElement.id = 'design-system-styles';
    styleElement.textContent = getAllComponentStyles();
    
    // Also include token styles
    const tokenStyles = document.createElement('link');
    tokenStyles.rel = 'stylesheet';
    tokenStyles.href = new URL('./styles/tokens.css', import.meta.url).href;
    
    const resetStyles = document.createElement('link');
    resetStyles.rel = 'stylesheet';
    resetStyles.href = new URL('./styles/reset.css', import.meta.url).href;
    
    const animationStyles = document.createElement('link');
    animationStyles.rel = 'stylesheet';
    animationStyles.href = new URL('./styles/animations.css', import.meta.url).href;
    
    const utilityStyles = document.createElement('link');
    utilityStyles.rel = 'stylesheet';
    utilityStyles.href = new URL('./styles/utilities.css', import.meta.url).href;
    
    // Add to head in order
    document.head.appendChild(resetStyles);
    document.head.appendChild(tokenStyles);
    document.head.appendChild(styleElement);
    document.head.appendChild(animationStyles);
    document.head.appendChild(utilityStyles);
  }
  
  // Initialize toast system
  if (initToasts) {
    const { initializeToasts } = await import('./components/Toast.js');
    initializeToasts();
  }
  
  console.log('[Design System] Initialized successfully');
}

// Quick setup function
export async function setupDesignSystem() {
  await initializeDesignSystem({
    theme: 'light',
    includeStyles: true,
    initToasts: true
  });
}

// Export version
export const version = '1.0.0';

// Export as default
export default {
  initializeDesignSystem,
  setupDesignSystem,
  version
};