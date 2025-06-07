// Logger - Centralized logging with levels and namespaces
export class Logger {
  constructor(namespace, options = {}) {
    this.namespace = namespace;
    this.enabled = options.enabled !== false;
    this.logLevel = options.logLevel || 'info';
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }
  
  _shouldLog(level) {
    return this.enabled && this.levels[level] >= this.levels[this.logLevel];
  }
  
  _formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.namespace}] [${level.toUpperCase()}]`;
    return { prefix, message, data };
  }
  
  debug(message, ...data) {
    if (this._shouldLog('debug')) {
      const formatted = this._formatMessage('debug', message, data);
      console.log(formatted.prefix, formatted.message, ...formatted.data);
    }
  }
  
  info(message, ...data) {
    if (this._shouldLog('info')) {
      const formatted = this._formatMessage('info', message, data);
      console.log(formatted.prefix, formatted.message, ...formatted.data);
    }
  }
  
  warn(message, ...data) {
    if (this._shouldLog('warn')) {
      const formatted = this._formatMessage('warn', message, data);
      console.warn(formatted.prefix, formatted.message, ...formatted.data);
    }
  }
  
  error(message, ...data) {
    if (this._shouldLog('error')) {
      const formatted = this._formatMessage('error', message, data);
      console.error(formatted.prefix, formatted.message, ...formatted.data);
    }
  }
}