// EventBus - Centralized event management
// Replaces scattered window event dispatching with a unified system

export class EventBus {
  constructor() {
    this.events = {};
    this.logger = console;
  }
  
  on(event, handler, context = null) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push({ handler, context });
    
    // Return unsubscribe function
    return () => this.off(event, handler);
  }
  
  once(event, handler, context = null) {
    const wrappedHandler = (...args) => {
      handler.apply(context, args);
      this.off(event, wrappedHandler);
    };
    
    return this.on(event, wrappedHandler, context);
  }
  
  off(event, handler) {
    if (!this.events[event]) return;
    
    this.events[event] = this.events[event].filter(
      listener => listener.handler !== handler
    );
    
    if (this.events[event].length === 0) {
      delete this.events[event];
    }
  }
  
  emit(event, ...args) {
    if (!this.events[event]) return;
    
    this.logger.debug(`[EventBus] Emitting ${event}`, args);
    
    this.events[event].forEach(listener => {
      try {
        listener.handler.apply(listener.context, args);
      } catch (error) {
        this.logger.error(`[EventBus] Error in ${event} handler:`, error);
      }
    });
  }
  
  clear(event = null) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
  
  // Get all registered events (useful for debugging)
  getEvents() {
    return Object.keys(this.events);
  }
  
  // Get listener count for an event
  getListenerCount(event) {
    return this.events[event] ? this.events[event].length : 0;
  }
}