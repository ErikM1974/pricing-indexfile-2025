/**
 * State Management
 * Simple, reactive state management for the application
 */

export class AppState {
    constructor() {
        this.state = {
            product: null,
            selectedColor: null,
            inventory: null,
            loading: false,
            error: null
        };
        
        this.subscribers = new Map();
    }

    /**
     * Get a value from state
     */
    get(key) {
        return this.state[key];
    }

    /**
     * Set a value in state and notify subscribers
     */
    set(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;
        
        // Notify subscribers if value changed
        if (oldValue !== value) {
            this.notify(key, value, oldValue);
        }
    }

    /**
     * Update multiple values at once
     */
    update(updates) {
        Object.keys(updates).forEach(key => {
            this.set(key, updates[key]);
        });
    }

    /**
     * Subscribe to state changes
     */
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        
        this.subscribers.get(key).add(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(key);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }

    /**
     * Notify subscribers of state change
     */
    notify(key, value, oldValue) {
        const callbacks = this.subscribers.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(value, oldValue);
                } catch (error) {
                    console.error('State subscriber error:', error);
                }
            });
        }
    }

    /**
     * Reset state to initial values
     */
    reset() {
        this.state = {
            product: null,
            selectedColor: null,
            inventory: null,
            loading: false,
            error: null
        };
        
        // Notify all subscribers
        Object.keys(this.state).forEach(key => {
            this.notify(key, null, null);
        });
    }

    /**
     * Get full state (for debugging)
     */
    getState() {
        return { ...this.state };
    }
}