// Design System Tokens
// Phase 6: UI Redesign - Central design tokens for consistency

/**
 * Design tokens following a systematic approach
 * All values are CSS custom properties for runtime theming
 */

export const tokens = {
  // Color System
  colors: {
    // Brand colors
    primary: {
      50: '#e6f2ff',
      100: '#b3d9ff',
      200: '#80c0ff',
      300: '#4da6ff',
      400: '#1a8cff',
      500: '#0073e6', // Main brand blue
      600: '#005bb3',
      700: '#004280',
      800: '#002a4d',
      900: '#00121a'
    },
    
    secondary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e'
    },
    
    // Semantic colors
    semantic: {
      error: {
        light: '#fee2e2',
        main: '#ef4444',
        dark: '#dc2626',
        contrast: '#ffffff'
      },
      warning: {
        light: '#fef3c7',
        main: '#f59e0b',
        dark: '#d97706',
        contrast: '#000000'
      },
      success: {
        light: '#d1fae5',
        main: '#10b981',
        dark: '#059669',
        contrast: '#ffffff'
      },
      info: {
        light: '#dbeafe',
        main: '#3b82f6',
        dark: '#2563eb',
        contrast: '#ffffff'
      }
    },
    
    // Neutral colors
    neutral: {
      0: '#ffffff',
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
      950: '#0a0a0a',
      1000: '#000000'
    },
    
    // Surface colors for different themes
    surface: {
      background: 'var(--color-neutral-50)',
      foreground: 'var(--color-neutral-0)',
      elevated: 'var(--color-neutral-0)',
      overlay: 'rgba(0, 0, 0, 0.5)',
      divider: 'var(--color-neutral-200)'
    },
    
    // Text colors
    text: {
      primary: 'var(--color-neutral-900)',
      secondary: 'var(--color-neutral-600)',
      disabled: 'var(--color-neutral-400)',
      inverse: 'var(--color-neutral-0)',
      link: 'var(--color-primary-500)',
      linkHover: 'var(--color-primary-600)'
    }
  },
  
  // Spacing System (based on 4px grid)
  spacing: {
    0: '0',
    1: '0.25rem', // 4px
    2: '0.5rem',  // 8px
    3: '0.75rem', // 12px
    4: '1rem',    // 16px
    5: '1.25rem', // 20px
    6: '1.5rem',  // 24px
    7: '1.75rem', // 28px
    8: '2rem',    // 32px
    10: '2.5rem', // 40px
    12: '3rem',   // 48px
    16: '4rem',   // 64px
    20: '5rem',   // 80px
    24: '6rem',   // 96px
    32: '8rem',   // 128px
    40: '10rem',  // 160px
    48: '12rem',  // 192px
    56: '14rem',  // 224px
    64: '16rem'   // 256px
  },
  
  // Typography System
  typography: {
    // Font families
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    },
    
    // Font sizes
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem',    // 48px
      '6xl': '3.75rem', // 60px
      '7xl': '4.5rem',  // 72px
      '8xl': '6rem',    // 96px
      '9xl': '8rem'     // 128px
    },
    
    // Font weights
    fontWeight: {
      thin: 100,
      extralight: 200,
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
      black: 900
    },
    
    // Line heights
    lineHeight: {
      none: 1,
      tight: 1.25,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
      loose: 2
    },
    
    // Letter spacing
    letterSpacing: {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em'
    }
  },
  
  // Border System
  borders: {
    // Border widths
    width: {
      0: '0',
      1: '1px',
      2: '2px',
      4: '4px',
      8: '8px'
    },
    
    // Border radius
    radius: {
      none: '0',
      sm: '0.125rem',   // 2px
      base: '0.25rem',  // 4px
      md: '0.375rem',   // 6px
      lg: '0.5rem',     // 8px
      xl: '0.75rem',    // 12px
      '2xl': '1rem',    // 16px
      '3xl': '1.5rem',  // 24px
      full: '9999px',
      circle: '50%'
    },
    
    // Border styles
    style: {
      solid: 'solid',
      dashed: 'dashed',
      dotted: 'dotted',
      double: 'double',
      none: 'none'
    }
  },
  
  // Shadow System
  shadows: {
    none: 'none',
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    base: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    md: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    lg: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    xl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    '2xl': '0 35px 60px -15px rgba(0, 0, 0, 0.3)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    outline: '0 0 0 3px rgba(66, 153, 225, 0.5)'
  },
  
  // Breakpoints for responsive design
  breakpoints: {
    xs: '0px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  },
  
  // Z-index scale
  zIndex: {
    auto: 'auto',
    0: 0,
    10: 10,
    20: 20,
    30: 30,
    40: 40,
    50: 50,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070
  },
  
  // Transitions and animations
  transitions: {
    // Durations
    duration: {
      75: '75ms',
      100: '100ms',
      150: '150ms',
      200: '200ms',
      300: '300ms',
      500: '500ms',
      700: '700ms',
      1000: '1000ms'
    },
    
    // Timing functions
    timing: {
      linear: 'linear',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
    },
    
    // Common transitions
    property: {
      none: 'none',
      all: 'all',
      default: 'background-color, border-color, color, fill, stroke, opacity, box-shadow, transform',
      colors: 'background-color, border-color, color, fill, stroke',
      opacity: 'opacity',
      shadow: 'box-shadow',
      transform: 'transform'
    }
  },
  
  // Container sizes
  containers: {
    xs: '20rem',    // 320px
    sm: '24rem',    // 384px
    md: '28rem',    // 448px
    lg: '32rem',    // 512px
    xl: '36rem',    // 576px
    '2xl': '42rem', // 672px
    '3xl': '48rem', // 768px
    '4xl': '56rem', // 896px
    '5xl': '64rem', // 1024px
    '6xl': '72rem', // 1152px
    '7xl': '80rem', // 1280px
    full: '100%',
    prose: '65ch'
  }
};

/**
 * Generate CSS custom properties from tokens
 * @returns {string} CSS string with custom properties
 */
export function generateCSSVariables() {
  let css = ':root {\n';
  
  // Colors
  Object.entries(tokens.colors).forEach(([category, values]) => {
    if (typeof values === 'object') {
      Object.entries(values).forEach(([key, value]) => {
        if (typeof value === 'string') {
          css += `  --color-${category}-${key}: ${value};\n`;
        } else if (typeof value === 'object') {
          Object.entries(value).forEach(([subkey, subvalue]) => {
            css += `  --color-${category}-${key}-${subkey}: ${subvalue};\n`;
          });
        }
      });
    }
  });
  
  // Spacing
  Object.entries(tokens.spacing).forEach(([key, value]) => {
    css += `  --spacing-${key}: ${value};\n`;
  });
  
  // Typography
  Object.entries(tokens.typography).forEach(([category, values]) => {
    Object.entries(values).forEach(([key, value]) => {
      css += `  --typography-${category}-${key}: ${value};\n`;
    });
  });
  
  // Borders
  Object.entries(tokens.borders).forEach(([category, values]) => {
    Object.entries(values).forEach(([key, value]) => {
      css += `  --border-${category}-${key}: ${value};\n`;
    });
  });
  
  // Shadows
  Object.entries(tokens.shadows).forEach(([key, value]) => {
    css += `  --shadow-${key}: ${value};\n`;
  });
  
  // Breakpoints
  Object.entries(tokens.breakpoints).forEach(([key, value]) => {
    css += `  --breakpoint-${key}: ${value};\n`;
  });
  
  // Z-index
  Object.entries(tokens.zIndex).forEach(([key, value]) => {
    css += `  --z-${key}: ${value};\n`;
  });
  
  // Transitions
  Object.entries(tokens.transitions).forEach(([category, values]) => {
    Object.entries(values).forEach(([key, value]) => {
      css += `  --transition-${category}-${key}: ${value};\n`;
    });
  });
  
  // Containers
  Object.entries(tokens.containers).forEach(([key, value]) => {
    css += `  --container-${key}: ${value};\n`;
  });
  
  css += '}\n';
  
  return css;
}

// Export individual token categories for easier access
export const { 
  colors, 
  spacing, 
  typography, 
  borders, 
  shadows, 
  breakpoints, 
  zIndex, 
  transitions,
  containers 
} = tokens;