# Pricing System Refactoring: Phases 3-6 Detailed Implementation Plan

## Table of Contents
1. [Phase 3: State Management](#phase-3-state-management)
2. [Phase 4: Cap Embroidery Modules](#phase-4-cap-embroidery-modules)
3. [Phase 5: API Consolidation](#phase-5-api-consolidation)
4. [Phase 6: UI Redesign](#phase-6-ui-redesign)
5. [Implementation Timeline](#implementation-timeline)
6. [Migration Guide](#migration-guide)

---

## Phase 3: State Management

### Overview
Implement a centralized state management system that provides a single source of truth for all pricing data, user selections, and application state. This will eliminate data inconsistencies and enable real-time synchronization across components.

### Branch Name
`refactor/state-management-phase3`

### Key Objectives
1. Create a centralized store for all application state
2. Implement predictable state updates through actions
3. Enable real-time synchronization between components
4. Add state persistence and recovery
5. Implement undo/redo functionality

### Technical Implementation

#### 1. Create State Store (`src/shared/state/store.js`)
```javascript
class PricingStore {
  constructor() {
    this.state = {
      product: {
        id: null,
        name: '',
        basePrice: 0,
        options: {}
      },
      selections: {
        quantity: 0,
        colors: [],
        sizes: [],
        embellishmentType: null,
        locations: []
      },
      pricing: {
        unitPrice: 0,
        totalPrice: 0,
        breakdown: {}
      },
      quotes: [],
      ui: {
        loading: false,
        errors: [],
        activeTab: null
      }
    };
  }
}
```

#### 2. Action System (`src/shared/state/actions.js`)
- `updateQuantity(quantity)`
- `selectColor(color)`
- `calculatePricing()`
- `saveQuote()`
- `loadQuote(quoteId)`

#### 3. State Subscribers
- Implement observer pattern for components to subscribe to state changes
- Automatic re-rendering on state updates
- Batched updates for performance

#### 4. Persistence Layer
- LocalStorage adapter for offline state
- Session recovery
- Export/import state functionality

### Files to Create
- `/src/shared/state/store.js` - Main state store
- `/src/shared/state/actions.js` - State mutation actions
- `/src/shared/state/reducers.js` - State update logic
- `/src/shared/state/middleware.js` - Logging, persistence, validation
- `/src/shared/state/selectors.js` - Computed state values

### Migration Steps
1. Identify all current state variables in existing code
2. Map state variables to new store structure
3. Replace direct DOM manipulation with state updates
4. Update components to use state subscribers
5. Test state synchronization between components

### Testing Requirements
- Unit tests for all reducers
- Integration tests for state synchronization
- Performance tests for large state updates
- Edge case testing (network failures, concurrent updates)

---

## Phase 4: Cap Embroidery Modules

### Overview
Migrate all cap embroidery specific functionality into modular, reusable components that integrate with the new architecture. This phase eliminates code duplication and creates specialized components for embroidery pricing.

### Branch Name
`refactor/cap-embroidery-modules-phase4`

### Key Objectives
1. Extract embroidery-specific logic into dedicated modules
2. Create specialized embroidery components
3. Implement stitch count calculations
4. Handle multi-location embroidery
5. Integrate with new state management

### Technical Implementation

#### 1. Embroidery Calculator Module (`src/modules/embroidery/calculator.js`)
```javascript
class EmbroideryCalculator extends PricingCalculator {
  calculateStitchCount(design) {
    // Implement stitch count logic
  }
  
  calculateLocationPricing(locations) {
    // Multi-location pricing logic
  }
  
  applyVolumeDiscounts(quantity, stitchCount) {
    // Volume discount calculations
  }
}
```

#### 2. Location Manager (`src/modules/embroidery/location-manager.js`)
- Front logo management
- Back logo management
- Side embroidery options
- Custom location support

#### 3. Design Complexity Analyzer
- Simple/Complex design detection
- Automatic stitch count estimation
- Design size validation

#### 4. Cap-Specific Features
- Cap type selection (structured, unstructured, etc.)
- Special pricing for different cap materials
- Minimum quantity requirements

### Files to Create
- `/src/modules/embroidery/calculator.js` - Main embroidery calculator
- `/src/modules/embroidery/location-manager.js` - Logo location handler
- `/src/modules/embroidery/stitch-counter.js` - Stitch count logic
- `/src/modules/embroidery/components/` - UI components
  - `LocationSelector.js`
  - `StitchCountInput.js`
  - `DesignUploader.js`
- `/src/modules/embroidery/validators.js` - Input validation

### Code Migration Map
| Current File | New Location | Action |
|-------------|--------------|---------|
| `cap-embroidery-controller-v2.js` | `modules/embroidery/calculator.js` | Extract calculation logic |
| `cap-embroidery-back-logo.js` | `modules/embroidery/location-manager.js` | Merge into location system |
| `cap-embroidery-validation.js` | `modules/embroidery/validators.js` | Standardize validation |
| `cap-embroidery-quote-adapter.js` | Remove | Use base quote system |

### Integration Points
1. Connect to state store for selections
2. Use EventBus for component communication
3. Integrate with API client for pricing data
4. Use base UI components for interface

---

## Phase 5: API Consolidation

### Overview
Create a unified API layer that handles all external communications, implements intelligent caching, provides offline support, and standardizes error handling across the application.

### Branch Name
`refactor/api-consolidation-phase5`

### Key Objectives
1. Unify all API endpoints into single client
2. Implement smart caching strategies
3. Add offline support with queue system
4. Standardize error handling
5. Add request/response interceptors

### Technical Implementation

#### 1. Unified API Client (`src/shared/api/unified-client.js`)
```javascript
class UnifiedAPIClient {
  constructor() {
    this.cache = new CacheManager();
    this.queue = new RequestQueue();
    this.interceptors = new InterceptorChain();
  }
  
  async request(config) {
    // Check cache first
    // Add to queue if offline
    // Apply interceptors
    // Make request
    // Update cache
  }
}
```

#### 2. Cache Manager (`src/shared/api/cache-manager.js`)
- LRU cache implementation
- TTL-based expiration
- Cache invalidation strategies
- Persistent cache option

#### 3. Offline Queue System
- Queue requests when offline
- Retry logic with exponential backoff
- Sync when connection restored
- Conflict resolution

#### 4. API Endpoints Configuration
```javascript
const API_ENDPOINTS = {
  pricing: {
    matrix: '/api/pricing/matrix',
    calculate: '/api/pricing/calculate',
    quotes: '/api/quotes'
  },
  inventory: {
    check: '/api/inventory/check',
    reserve: '/api/inventory/reserve'
  },
  orders: {
    create: '/api/orders/create',
    update: '/api/orders/update'
  }
};
```

### Files to Create
- `/src/shared/api/unified-client.js` - Main API client
- `/src/shared/api/cache-manager.js` - Caching logic
- `/src/shared/api/request-queue.js` - Offline queue
- `/src/shared/api/interceptors.js` - Request/response interceptors
- `/src/shared/api/endpoints.js` - Endpoint configuration
- `/src/shared/api/error-handler.js` - Centralized error handling

### API Migration Plan
1. Audit all current API calls
2. Map endpoints to new structure
3. Implement backwards compatibility layer
4. Gradually migrate components
5. Remove old API code

### Caching Strategy
| Endpoint Type | Cache Duration | Strategy |
|--------------|----------------|----------|
| Pricing Matrix | 1 hour | LRU with TTL |
| Product Data | 30 minutes | Invalidate on update |
| Quotes | No cache | Always fresh |
| Inventory | 5 minutes | Background refresh |

---

## Phase 6: UI Redesign

### Overview
Implement a modern, responsive UI design system with improved user experience, accessibility features, and mobile-first approach. This phase focuses on visual consistency and usability improvements.

### Branch Name
`refactor/ui-redesign-phase6`

### Key Objectives
1. Create design system with tokens
2. Implement responsive grid system
3. Add micro-interactions and animations
4. Improve mobile experience
5. Enhance accessibility (WCAG 2.1 AA)

### Technical Implementation

#### 1. Design Tokens (`src/shared/design-system/tokens.js`)
```javascript
const tokens = {
  colors: {
    primary: { /* shades */ },
    secondary: { /* shades */ },
    semantic: {
      error: '#e53e3e',
      warning: '#dd6b20',
      success: '#38a169'
    }
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem'
  },
  typography: { /* font families, sizes, weights */ },
  breakpoints: { /* responsive breakpoints */ }
};
```

#### 2. Component Library
- Button variants (primary, secondary, ghost)
- Form controls with validation states
- Card layouts
- Modal system
- Toast notifications
- Loading states

#### 3. Layout System
- CSS Grid-based layouts
- Flexbox utilities
- Container queries
- Responsive spacing

#### 4. Interaction Patterns
- Smooth transitions
- Loading skeletons
- Progressive disclosure
- Touch-friendly targets

### Files to Create
- `/src/shared/design-system/tokens.js` - Design tokens
- `/src/shared/design-system/components/` - UI components
  - `Button.js`
  - `Card.js`
  - `Form.js`
  - `Modal.js`
  - `Toast.js`
- `/src/shared/design-system/layouts/` - Layout components
  - `Grid.js`
  - `Stack.js`
  - `Container.js`
- `/src/shared/design-system/styles/` - CSS modules
  - `reset.css`
  - `utilities.css`
  - `animations.css`

### Mobile-First Features
1. Touch-optimized interactions
2. Swipe gestures for navigation
3. Collapsible sections
4. Bottom sheet patterns
5. Optimized font sizes

### Accessibility Checklist
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Color contrast (4.5:1 minimum)
- [ ] Focus indicators
- [ ] ARIA labels
- [ ] Error announcements
- [ ] Skip links

---

## Implementation Timeline

### Suggested Schedule
| Phase | Duration | Dependencies | Priority |
|-------|----------|--------------|----------|
| Phase 3 | 2 weeks | Phase 2 complete | High |
| Phase 4 | 2 weeks | Phase 3 complete | High |
| Phase 5 | 3 weeks | Phase 3 complete | Medium |
| Phase 6 | 3 weeks | Phases 3-5 complete | Medium |

### Parallel Work Opportunities
- Phase 5 API work can begin alongside Phase 4
- UI design mockups can be created during Phases 3-4
- Documentation can be updated continuously

---

## Migration Guide

### For Developers

#### 1. Getting Started
```bash
# Clone and checkout the branch
git checkout refactor/[phase-name]

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test
```

#### 2. Code Style Guidelines
- Use ES6+ features
- Follow functional programming principles where applicable
- Write self-documenting code
- Add JSDoc comments for public APIs
- Keep functions small and focused

#### 3. Testing Requirements
- Unit tests for all new code (target 80% coverage)
- Integration tests for critical paths
- E2E tests for user workflows
- Performance benchmarks

### For Project Managers

#### 1. Risk Mitigation
- Each phase is independently deployable
- Rollback procedures documented
- Feature flags for gradual rollout
- A/B testing capabilities

#### 2. Success Metrics
- Page load time < 2 seconds
- Time to interactive < 3 seconds
- 0% increase in error rates
- Improved developer velocity

#### 3. Communication Plan
- Weekly progress updates
- Demo sessions after each phase
- Documentation updates
- Stakeholder reviews

### Common Issues and Solutions

#### Issue: State synchronization problems
**Solution:** Check event listener cleanup, verify state subscriptions

#### Issue: API cache conflicts
**Solution:** Clear cache, check TTL settings, verify cache keys

#### Issue: Mobile layout breaks
**Solution:** Test with device emulators, check viewport meta tag

#### Issue: Performance degradation
**Solution:** Profile with Chrome DevTools, check bundle sizes, lazy load

---

## Appendix

### Useful Commands
```bash
# Generate component
npm run generate:component [name]

# Build for production
npm run build

# Analyze bundle
npm run analyze

# Run specific tests
npm test -- --grep "pattern"
```

### Resources
- [Component Architecture Best Practices](https://example.com)
- [State Management Patterns](https://example.com)
- [API Design Guidelines](https://example.com)
- [Accessibility Checklist](https://www.w3.org/WAI/WCAG21/quickref/)

### Contact
For questions or clarifications:
- Technical Lead: [Email]
- Project Manager: [Email]
- Documentation: [Wiki Link]