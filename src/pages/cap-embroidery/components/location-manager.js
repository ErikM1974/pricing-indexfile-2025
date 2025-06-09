// Location Manager Component for Cap Embroidery
// Phase 2: Component Architecture

import { EventBus } from '../../../core/event-bus';
import { Logger } from '../../../core/logger';

export class LocationManager {
  constructor(options = {}) {
    this.container = document.querySelector(options.container);
    this.eventBus = options.eventBus || new EventBus();
    this.logger = new Logger('LocationManager');
    
    // Configuration
    this.locations = options.locations || [
      { id: 'front', name: 'Front Logo', maxStitches: 15000, default: true },
      { id: 'back', name: 'Back Logo', maxStitches: 10000 },
      { id: 'left-side', name: 'Left Side', maxStitches: 8000 },
      { id: 'right-side', name: 'Right Side', maxStitches: 8000 }
    ];
    
    // State
    this.activeLocations = new Map();
    this.stitchCounts = new Map();
    
    // Callbacks
    this.onChange = options.onChange || (() => {});
    
    if (this.container) {
      this.render();
      this.attachEvents();
      this.initializeDefaults();
    }
  }
  
  /**
   * Render the location manager UI
   */
  render() {
    this.container.innerHTML = `
      <div class="location-manager">
        <h3 class="location-manager-title">Embroidery Locations</h3>
        <div class="location-options" role="group" aria-label="Select embroidery locations">
          ${this.locations.map(location => this.renderLocation(location)).join('')}
        </div>
        <div class="location-summary" aria-live="polite">
          <span class="location-count">0 locations selected</span>
        </div>
      </div>
    `;
    
    this.logger.info('Location manager rendered');
  }
  
  /**
   * Render individual location option
   * @private
   */
  renderLocation(location) {
    return `
      <div class="location-option" data-location="${location.id}">
        <label class="location-checkbox-label">
          <input type="checkbox" 
                 class="location-checkbox" 
                 value="${location.id}"
                 ${location.default ? 'checked' : ''}
                 aria-describedby="${location.id}-desc">
          <span class="location-name">${location.name}</span>
        </label>
        <span id="${location.id}-desc" class="visually-hidden">
          Add embroidery to ${location.name.toLowerCase()} of the cap
        </span>
        
        <div class="stitch-count-section" style="display: ${location.default ? 'block' : 'none'}">
          <div class="stitch-count-controls">
            <label for="stitches-${location.id}" class="stitch-label">
              Stitch Count:
            </label>
            <div class="stitch-input-group">
              <button type="button" 
                      class="stitch-adjust-btn decrease" 
                      data-location="${location.id}"
                      aria-label="Decrease stitch count">
                −
              </button>
              <input type="number" 
                     id="stitches-${location.id}"
                     class="stitch-count-input" 
                     data-location="${location.id}" 
                     min="0" 
                     max="${location.maxStitches}" 
                     step="500"
                     value="0"
                     placeholder="e.g., 5000">
              <button type="button" 
                      class="stitch-adjust-btn increase" 
                      data-location="${location.id}"
                      aria-label="Increase stitch count">
                +
              </button>
            </div>
            <span class="stitch-hint">Max: ${location.maxStitches.toLocaleString()} stitches</span>
          </div>
          
          <div class="stitch-presets">
            <span class="preset-label">Quick select:</span>
            <button type="button" 
                    class="stitch-preset" 
                    data-location="${location.id}" 
                    data-stitches="5000">
              5K
            </button>
            <button type="button" 
                    class="stitch-preset" 
                    data-location="${location.id}" 
                    data-stitches="8000">
              8K
            </button>
            <button type="button" 
                    class="stitch-preset" 
                    data-location="${location.id}" 
                    data-stitches="10000">
              10K
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Attach event listeners
   */
  attachEvents() {
    // Location checkbox changes
    this.container.addEventListener('change', (e) => {
      if (e.target.classList.contains('location-checkbox')) {
        this.toggleLocation(e.target.value, e.target.checked);
      } else if (e.target.classList.contains('stitch-count-input')) {
        this.updateStitchCount(e.target.dataset.location, e.target.value);
      }
    });
    
    // Stitch count adjustments
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('stitch-adjust-btn')) {
        this.adjustStitchCount(e.target);
      } else if (e.target.classList.contains('stitch-preset')) {
        this.setPresetStitchCount(e.target);
      }
    });
    
    // Input validation
    this.container.addEventListener('input', (e) => {
      if (e.target.classList.contains('stitch-count-input')) {
        this.validateStitchInput(e.target);
      }
    });
    
    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      if (e.target.classList.contains('location-checkbox') && e.key === ' ') {
        e.preventDefault();
        e.target.click();
      }
    });
  }
  
  /**
   * Initialize default selections
   * @private
   */
  initializeDefaults() {
    this.locations.forEach(location => {
      if (location.default) {
        this.activeLocations.set(location.id, location);
        this.stitchCounts.set(location.id, 0);
      }
    });
    
    this.updateSummary();
  }
  
  /**
   * Toggle location on/off
   * @private
   */
  toggleLocation(locationId, enabled) {
    const location = this.locations.find(l => l.id === locationId);
    if (!location) return;
    
    const stitchSection = this.container.querySelector(
      `[data-location="${locationId}"] .stitch-count-section`
    );
    
    if (enabled) {
      this.activeLocations.set(locationId, location);
      if (!this.stitchCounts.has(locationId)) {
        this.stitchCounts.set(locationId, 0);
      }
      if (stitchSection) {
        stitchSection.style.display = 'block';
        // Focus on stitch input for accessibility
        const input = stitchSection.querySelector('.stitch-count-input');
        if (input) input.focus();
      }
    } else {
      this.activeLocations.delete(locationId);
      this.stitchCounts.delete(locationId);
      if (stitchSection) {
        stitchSection.style.display = 'none';
      }
    }
    
    this.updateSummary();
    this.emitChange();
    
    this.logger.debug('Location toggled', { locationId, enabled });
  }
  
  /**
   * Update stitch count for a location
   * @private
   */
  updateStitchCount(locationId, value) {
    const count = parseInt(value) || 0;
    const location = this.activeLocations.get(locationId);
    
    if (location && count >= 0 && count <= location.maxStitches) {
      this.stitchCounts.set(locationId, count);
      this.emitChange();
      this.logger.debug('Stitch count updated', { locationId, count });
    }
  }
  
  /**
   * Adjust stitch count with buttons
   * @private
   */
  adjustStitchCount(button) {
    const locationId = button.dataset.location;
    const input = this.container.querySelector(`#stitches-${locationId}`);
    if (!input) return;
    
    const currentValue = parseInt(input.value) || 0;
    const step = 500;
    const isIncrease = button.classList.contains('increase');
    
    const newValue = isIncrease ? currentValue + step : currentValue - step;
    input.value = Math.max(0, Math.min(newValue, parseInt(input.max)));
    
    this.updateStitchCount(locationId, input.value);
  }
  
  /**
   * Set preset stitch count
   * @private
   */
  setPresetStitchCount(button) {
    const locationId = button.dataset.location;
    const stitches = button.dataset.stitches;
    const input = this.container.querySelector(`#stitches-${locationId}`);
    
    if (input) {
      input.value = stitches;
      this.updateStitchCount(locationId, stitches);
      
      // Visual feedback
      button.classList.add('selected');
      setTimeout(() => button.classList.remove('selected'), 300);
    }
  }
  
  /**
   * Validate stitch input
   * @private
   */
  validateStitchInput(input) {
    const max = parseInt(input.max);
    const value = parseInt(input.value) || 0;
    
    if (value > max) {
      input.value = max;
      input.classList.add('error');
      setTimeout(() => input.classList.remove('error'), 1000);
    }
  }
  
  /**
   * Update location summary
   * @private
   */
  updateSummary() {
    const count = this.activeLocations.size;
    const summary = this.container.querySelector('.location-count');
    
    if (summary) {
      const text = count === 0 ? 'No locations selected' :
                   count === 1 ? '1 location selected' :
                   `${count} locations selected`;
      summary.textContent = text;
    }
  }
  
  /**
   * Emit change event
   * @private
   */
  emitChange() {
    const data = this.getSelections();
    this.onChange(data);
    this.eventBus.emit('location:change', data);
  }
  
  /**
   * Get current selections
   * @returns {Object} Current location selections and stitch counts
   */
  getSelections() {
    const locations = Array.from(this.activeLocations.keys());
    const stitchCounts = {};
    
    this.stitchCounts.forEach((count, locationId) => {
      if (count > 0) {
        stitchCounts[locationId] = count;
      }
    });
    
    return {
      locations,
      stitchCounts,
      locationDetails: Array.from(this.activeLocations.values())
    };
  }
  
  /**
   * Set selections programmatically
   * @param {Object} selections - Locations and stitch counts to set
   */
  setSelections(selections) {
    // Clear current selections
    this.container.querySelectorAll('.location-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
    this.activeLocations.clear();
    this.stitchCounts.clear();
    
    // Set new selections
    if (selections.locations) {
      selections.locations.forEach(locationId => {
        const checkbox = this.container.querySelector(`input[value="${locationId}"]`);
        if (checkbox) {
          checkbox.checked = true;
          this.toggleLocation(locationId, true);
        }
      });
    }
    
    if (selections.stitchCounts) {
      Object.entries(selections.stitchCounts).forEach(([locationId, count]) => {
        const input = this.container.querySelector(`#stitches-${locationId}`);
        if (input) {
          input.value = count;
          this.updateStitchCount(locationId, count);
        }
      });
    }
  }
  
  /**
   * Reset all selections
   */
  reset() {
    this.setSelections({ locations: [], stitchCounts: {} });
    this.logger.info('Location manager reset');
  }
  
  /**
   * Enable/disable the component
   * @param {boolean} enabled - Whether to enable or disable
   */
  setEnabled(enabled) {
    const inputs = this.container.querySelectorAll('input, button');
    inputs.forEach(input => {
      input.disabled = !enabled;
    });
    
    this.container.classList.toggle('disabled', !enabled);
  }
}