// Logger - Centralized logging with levels and formatting
// Replaces console.log scattered throughout the codebase

export class Logger {
  constructor(prefix = 'NWCA', options = {}) {
    this.prefix = prefix;
    this.enabled = options.enabled !== false;
    this.level = options.level || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');
    this.levels = {
      debug: 0,
      log: 1,
      info: 2,
      warn: 3,
      error: 4
    };
    
    // Color codes for browser console
    this.colors = {
      debug: '#6c757d',
      log: '#007bff',
      info: '#17a2b8',
      warn: '#ffc107',
      error: '#dc3545'
    };
  }
  
  shouldLog(level) {
    return this.enabled && this.levels[level] >= this.levels[this.level];
  }
  
  formatMessage(level, args) {
    const timestamp = new Date().toISOString().substr(11, 8);
    const prefix = `[${timestamp}] [${this.prefix}]`;
    return [prefix, ...args];
  }
  
  debug(...args) {
    if (this.shouldLog('debug')) {
      const formatted = this.formatMessage('debug', args);
      console.log(`%c${formatted[0]}`, `color: ${this.colors.debug}`, ...formatted.slice(1));
    }
  }
  
  log(...args) {
    if (this.shouldLog('log')) {
      const formatted = this.formatMessage('log', args);
      console.log(`%c${formatted[0]}`, `color: ${this.colors.log}`, ...formatted.slice(1));
    }
  }
  
  info(...args) {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage('info', args);
      console.info(`%c${formatted[0]}`, `color: ${this.colors.info}`, ...formatted.slice(1));
    }
  }
  
  warn(...args) {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage('warn', args);
      console.warn(`%c${formatted[0]}`, `color: ${this.colors.warn}`, ...formatted.slice(1));
    }
  }
  
  error(...args) {
    if (this.shouldLog('error')) {
      const formatted = this.formatMessage('error', args);
      console.error(`%c${formatted[0]}`, `color: ${this.colors.error}`, ...formatted.slice(1));
    }
  }
  
  group(label) {
    if (this.enabled) {
      console.group(`[${this.prefix}] ${label}`);
    }
  }
  
  groupEnd() {
    if (this.enabled) {
      console.groupEnd();
    }
  }
  
  time(label) {
    if (this.enabled) {
      console.time(`[${this.prefix}] ${label}`);
    }
  }
  
  timeEnd(label) {
    if (this.enabled) {
      console.timeEnd(`[${this.prefix}] ${label}`);
    }
  }
  
  // Create a child logger with additional prefix
  child(childPrefix) {
    return new Logger(`${this.prefix}:${childPrefix}`, {
      enabled: this.enabled,
      level: this.level
    });
  }
  
  // Set logging level dynamically
  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.level = level;
    }
  }
  
  // Enable/disable logging
  enable() {
    this.enabled = true;
  }
  
  disable() {
    this.enabled = false;
  }
}