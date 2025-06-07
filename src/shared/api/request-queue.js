// Request Queue for Offline Support
// Phase 5: API Consolidation

import { Logger } from '../../core/logger';
import { EventBus } from '../../core/event-bus';

/**
 * RequestQueue - Manages offline requests for later synchronization
 */
export class RequestQueue {
  constructor(options = {}) {
    this.logger = new Logger('RequestQueue');
    this.eventBus = options.eventBus || new EventBus();
    
    // Configuration
    this.maxQueueSize = options.maxQueueSize || 100;
    this.maxRetries = options.maxRetries || 3;
    this.syncInterval = options.syncInterval || 30000; // 30 seconds
    this.storageKey = options.storageKey || 'offline-queue';
    
    // Queue storage
    this.queue = [];
    this.processing = false;
    this.syncTimer = null;
    
    // Load queue from storage
    this.loadQueue();
    
    // Start sync process if online
    if (navigator.onLine) {
      this.startSync();
    }
    
    // Listen for online/offline events
    this.setupNetworkListeners();
  }
  
  /**
   * Add request to queue
   * @param {Object} config - Request configuration
   * @returns {Promise<Object>} Queue entry
   */
  async add(config) {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Offline queue is full');
    }
    
    const entry = {
      id: this.generateId(),
      config,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
      error: null
    };
    
    this.queue.push(entry);
    this.saveQueue();
    
    this.logger.info('Request queued', { 
      id: entry.id, 
      url: config.url 
    });
    
    this.eventBus.emit('queue:added', entry);
    
    return entry;
  }
  
  /**
   * Process queued requests
   */
  async processQueue() {
    if (this.processing || !navigator.onLine || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    this.logger.info('Processing queue', { count: this.queue.length });
    
    const processed = [];
    const failed = [];
    
    // Process each queued request
    for (const entry of this.queue) {
      if (entry.status !== 'pending') continue;
      
      try {
        await this.processEntry(entry);
        processed.push(entry);
      } catch (error) {
        entry.retries++;
        entry.error = error.message;
        
        if (entry.retries >= this.maxRetries) {
          entry.status = 'failed';
          failed.push(entry);
        }
        
        this.logger.error('Failed to process queued request', {
          id: entry.id,
          error: error.message,
          retries: entry.retries
        });
      }
    }
    
    // Remove successfully processed entries
    this.queue = this.queue.filter(entry => 
      !processed.includes(entry) && !failed.includes(entry)
    );
    
    // Move failed entries to dead letter queue
    if (failed.length > 0) {
      await this.handleFailedEntries(failed);
    }
    
    this.saveQueue();
    this.processing = false;
    
    // Emit completion event
    this.eventBus.emit('queue:processed', {
      processed: processed.length,
      failed: failed.length,
      remaining: this.queue.length
    });
    
    this.logger.info('Queue processing complete', {
      processed: processed.length,
      failed: failed.length,
      remaining: this.queue.length
    });
  }
  
  /**
   * Process individual queue entry
   * @private
   */
  async processEntry(entry) {
    const { config } = entry;
    
    // Import the API client dynamically to avoid circular dependencies
    const { getAPIClient } = await import('./unified-client');
    const api = getAPIClient();
    
    // Disable queueing for this request to prevent infinite loop
    const processConfig = {
      ...config,
      queueOffline: false,
      cache: false
    };
    
    // Make the request
    const response = await api.request(processConfig);
    
    // Mark as completed
    entry.status = 'completed';
    entry.response = response;
    
    this.logger.info('Queued request processed', {
      id: entry.id,
      url: config.url
    });
    
    // Emit success event
    this.eventBus.emit('queue:request-completed', {
      entry,
      response
    });
    
    return response;
  }
  
  /**
   * Handle failed entries
   * @private
   */
  async handleFailedEntries(entries) {
    // Store in dead letter queue
    const deadLetterKey = `${this.storageKey}-failed`;
    
    try {
      const existing = JSON.parse(localStorage.getItem(deadLetterKey) || '[]');
      const updated = [...existing, ...entries].slice(-50); // Keep last 50
      localStorage.setItem(deadLetterKey, JSON.stringify(updated));
    } catch (error) {
      this.logger.error('Failed to save dead letter queue', error);
    }
    
    // Emit failure event
    entries.forEach(entry => {
      this.eventBus.emit('queue:request-failed', {
        entry,
        permanent: true
      });
    });
  }
  
  /**
   * Get queue status
   * @returns {Object} Queue statistics
   */
  getStats() {
    const pending = this.queue.filter(e => e.status === 'pending').length;
    const oldestEntry = this.queue[0];
    const newestEntry = this.queue[this.queue.length - 1];
    
    return {
      total: this.queue.length,
      pending,
      processing: this.processing,
      oldestAge: oldestEntry ? Date.now() - oldestEntry.timestamp : null,
      newestAge: newestEntry ? Date.now() - newestEntry.timestamp : null,
      isOnline: navigator.onLine
    };
  }
  
  /**
   * Clear queue
   */
  clear() {
    this.queue = [];
    this.saveQueue();
    this.logger.info('Queue cleared');
    this.eventBus.emit('queue:cleared');
  }
  
  /**
   * Get queue entries
   * @returns {Array} Queue entries
   */
  getEntries() {
    return [...this.queue];
  }
  
  /**
   * Get failed entries from dead letter queue
   * @returns {Array} Failed entries
   */
  getFailedEntries() {
    const deadLetterKey = `${this.storageKey}-failed`;
    
    try {
      return JSON.parse(localStorage.getItem(deadLetterKey) || '[]');
    } catch {
      return [];
    }
  }
  
  /**
   * Retry failed entry
   * @param {string} entryId - Entry ID to retry
   */
  async retryEntry(entryId) {
    const entry = this.queue.find(e => e.id === entryId);
    
    if (!entry) {
      throw new Error('Entry not found in queue');
    }
    
    entry.status = 'pending';
    entry.retries = 0;
    entry.error = null;
    
    this.saveQueue();
    
    // Process immediately if online
    if (navigator.onLine) {
      await this.processQueue();
    }
  }
  
  /**
   * Setup network listeners
   * @private
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.logger.info('Network online - starting queue sync');
      this.startSync();
      this.processQueue();
    });
    
    window.addEventListener('offline', () => {
      this.logger.info('Network offline - stopping queue sync');
      this.stopSync();
    });
  }
  
  /**
   * Start sync timer
   * @private
   */
  startSync() {
    if (this.syncTimer) return;
    
    this.syncTimer = setInterval(() => {
      if (navigator.onLine && this.queue.length > 0) {
        this.processQueue();
      }
    }, this.syncInterval);
  }
  
  /**
   * Stop sync timer
   * @private
   */
  stopSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
  
  /**
   * Save queue to localStorage
   * @private
   */
  saveQueue() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      this.logger.error('Failed to save queue', error);
      
      // If storage is full, remove oldest entries
      if (error.name === 'QuotaExceededError' && this.queue.length > 0) {
        this.queue.shift();
        this.saveQueue();
      }
    }
  }
  
  /**
   * Load queue from localStorage
   * @private
   */
  loadQueue() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
        this.logger.info('Queue loaded from storage', {
          count: this.queue.length
        });
      }
    } catch (error) {
      this.logger.error('Failed to load queue', error);
      this.queue = [];
    }
  }
  
  /**
   * Generate unique ID
   * @private
   */
  generateId() {
    return `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Destroy queue manager
   */
  destroy() {
    this.stopSync();
    this.clear();
  }
}

/**
 * Queue priorities
 */
export const QueuePriorities = {
  HIGH: 3,
  NORMAL: 2,
  LOW: 1
};

/**
 * Conflict resolution strategies
 */
export const ConflictStrategies = {
  /**
   * Last write wins
   */
  LAST_WRITE_WINS: 'last-write-wins',
  
  /**
   * First write wins
   */
  FIRST_WRITE_WINS: 'first-write-wins',
  
  /**
   * Manual resolution required
   */
  MANUAL: 'manual',
  
  /**
   * Merge changes
   */
  MERGE: 'merge'
};