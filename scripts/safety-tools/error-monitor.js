/**
 * @fileoverview Client-side error monitoring system
 * @description Catches missing files and errors immediately, reports to server
 * @author Safety System
 * @version 1.0
 */

// This script should be included on all pages to monitor for errors
// Add to every HTML file: <script src="/scripts/safety-tools/error-monitor.js"></script>

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    enabled: true,
    reportUrl: '/api/error-report',
    batchSize: 10,
    batchDelay: 5000, // 5 seconds
    maxErrors: 100,
    enableConsoleLog: false, // Changed to false by default to avoid console noise when monitoring is off
    enableAutoRecovery: true,
    quarantinePath: '/_quarantine',
    monitoringEnabled: null // Will be checked on first error
  };

  // Error storage
  const errorQueue = [];
  let batchTimer = null;
  let errorCount = 0;

  /**
   * Error Monitor Class
   */
  class ErrorMonitor {
    constructor() {
      this.sessionId = this.generateSessionId();
      this.startTime = Date.now();
      this.setupErrorHandlers();
      this.setupResourceMonitoring();
      this.setupConsoleInterception();
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
      return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Set up global error handlers
     */
    setupErrorHandlers() {
      // Handle JavaScript errors
      window.addEventListener('error', (event) => {
        this.handleError({
          type: 'javascript',
          message: event.message,
          source: event.filename,
          line: event.lineno,
          column: event.colno,
          error: event.error ? event.error.stack : null,
          timestamp: Date.now()
        });

        // Check if it's a missing file error
        if (this.isMissingFileError(event)) {
          this.handleMissingFile(event.filename || event.source);
        }
      });

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.handleError({
          type: 'unhandled_promise',
          message: event.reason ? event.reason.toString() : 'Unhandled promise rejection',
          promise: event.promise,
          timestamp: Date.now()
        });
      });
    }

    /**
     * Monitor resource loading (images, scripts, stylesheets)
     */
    setupResourceMonitoring() {
      // Monitor dynamically added scripts
      const originalAppendChild = Element.prototype.appendChild;
      Element.prototype.appendChild = function(element) {
        if (element.tagName === 'SCRIPT' && element.src) {
          element.addEventListener('error', () => {
            errorMonitor.handleMissingFile(element.src);
          });
        } else if (element.tagName === 'LINK' && element.rel === 'stylesheet' && element.href) {
          element.addEventListener('error', () => {
            errorMonitor.handleMissingFile(element.href);
          });
        }
        return originalAppendChild.call(this, element);
      };

      // Monitor existing resources
      document.addEventListener('DOMContentLoaded', () => {
        // Check scripts
        document.querySelectorAll('script[src]').forEach(script => {
          if (!script.loaded && script.src) {
            script.addEventListener('error', () => {
              this.handleMissingFile(script.src);
            });
          }
        });

        // Check stylesheets
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
          if (link.href) {
            link.addEventListener('error', () => {
              this.handleMissingFile(link.href);
            });
          }
        });

        // Check images
        document.querySelectorAll('img').forEach(img => {
          if (img.src && !img.complete) {
            img.addEventListener('error', () => {
              this.handleMissingFile(img.src);
            });
          }
        });
      });
    }

    /**
     * Intercept console errors
     */
    setupConsoleInterception() {
      const originalError = console.error;
      console.error = function(...args) {
        errorMonitor.handleError({
          type: 'console_error',
          message: args.join(' '),
          timestamp: Date.now()
        });
        originalError.apply(console, args);
      };
    }

    /**
     * Check if error is a missing file error
     */
    isMissingFileError(event) {
      const indicators = [
        '404',
        'Not Found',
        'Failed to load',
        'NetworkError',
        'Failed to fetch',
        'ERR_FILE_NOT_FOUND'
      ];

      return indicators.some(indicator =>
        event.message && event.message.includes(indicator)
      );
    }

    /**
     * Handle missing file
     */
    handleMissingFile(url) {
      const error = {
        type: 'missing_file',
        severity: 'critical',
        url: url,
        page: window.location.href,
        timestamp: Date.now()
      };

      // Log to console
      if (CONFIG.enableConsoleLog) {
        console.warn(`🔴 Missing file detected: ${url}`);
      }

      // Try auto-recovery
      if (CONFIG.enableAutoRecovery) {
        this.attemptRecovery(url);
      }

      // Add to error queue
      this.handleError(error);

      // Show user notification
      this.showNotification(`Missing file: ${this.getFilename(url)}`);
    }

    /**
     * Attempt to recover missing file from quarantine
     */
    attemptRecovery(url) {
      const filename = this.getFilename(url);
      const today = new Date().toISOString().split('T')[0];
      const quarantineUrl = `${CONFIG.quarantinePath}/${today}${url}`;

      // Try to load from quarantine
      fetch(quarantineUrl, { method: 'HEAD' })
        .then(response => {
          if (response.ok) {
            console.warn(`🔄 Found ${filename} in quarantine. Attempting recovery...`);
            this.notifyServerRecovery(url, quarantineUrl);
          }
        })
        .catch(() => {
          // File not in quarantine
        });
    }

    /**
     * Notify server about recovery attempt
     */
    notifyServerRecovery(originalUrl, quarantineUrl) {
      fetch('/api/recover-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original: originalUrl,
          quarantine: quarantineUrl,
          page: window.location.href,
          sessionId: this.sessionId
        })
      });
    }

    /**
     * Handle any error
     */
    handleError(error) {
      // Don't exceed max errors
      if (errorCount >= CONFIG.maxErrors) {
        return;
      }

      errorCount++;

      // Add session info
      error.sessionId = this.sessionId;
      error.userAgent = navigator.userAgent;
      error.page = window.location.href;
      error.referrer = document.referrer;

      // Add to queue
      errorQueue.push(error);

      // Schedule batch send
      this.scheduleBatchSend();
    }

    /**
     * Schedule batch send of errors
     */
    scheduleBatchSend() {
      if (batchTimer) {
        return;
      }

      batchTimer = setTimeout(() => {
        this.sendErrorBatch();
        batchTimer = null;
      }, CONFIG.batchDelay);

      // Send immediately if batch size reached
      if (errorQueue.length >= CONFIG.batchSize) {
        clearTimeout(batchTimer);
        batchTimer = null;
        this.sendErrorBatch();
      }
    }

    /**
     * Send error batch to server
     */
    sendErrorBatch() {
      if (errorQueue.length === 0) {
        return;
      }

      const batch = errorQueue.splice(0, CONFIG.batchSize);

      // Check if monitoring is enabled on first attempt
      if (CONFIG.monitoringEnabled === null) {
        // Test if endpoint exists with a quick HEAD request
        fetch(CONFIG.reportUrl, { method: 'HEAD' })
          .then(response => {
            CONFIG.monitoringEnabled = response.ok;
            if (CONFIG.monitoringEnabled) {
              this.doSendErrors(batch);
            }
          })
          .catch(() => {
            CONFIG.monitoringEnabled = false;
            // Monitoring not available, silently discard errors
          });
      } else if (CONFIG.monitoringEnabled) {
        this.doSendErrors(batch);
      }
      // If monitoring is disabled, silently discard errors
    }

    /**
     * Actually send errors to server
     */
    doSendErrors(batch) {
      fetch(CONFIG.reportUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          errors: batch,
          timestamp: Date.now()
        })
      }).catch(err => {
        // Silently fail - monitoring might be disabled
      });
    }

    /**
     * Show user notification
     */
    showNotification(message) {
      // Check if notification already exists
      let notification = document.getElementById('error-monitor-notification');

      if (!notification) {
        // Create notification element
        notification = document.createElement('div');
        notification.id = 'error-monitor-notification';
        notification.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #f44336;
          color: white;
          padding: 15px 20px;
          border-radius: 4px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          z-index: 10000;
          max-width: 300px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          display: none;
        `;
        document.body.appendChild(notification);
      }

      // Update message
      notification.textContent = message;
      notification.style.display = 'block';

      // Auto-hide after 5 seconds
      setTimeout(() => {
        notification.style.display = 'none';
      }, 5000);
    }

    /**
     * Get filename from URL
     */
    getFilename(url) {
      return url.split('/').pop().split('?')[0];
    }

    /**
     * Generate error report
     */
    generateReport() {
      return {
        sessionId: this.sessionId,
        duration: Date.now() - this.startTime,
        errorCount: errorCount,
        page: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      };
    }

    /**
     * Clear errors
     */
    clearErrors() {
      errorQueue.length = 0;
      errorCount = 0;
      if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }
    }
  }

  // Initialize error monitor
  const errorMonitor = new ErrorMonitor();

  // Expose API for manual error reporting
  window.errorMonitor = {
    report: (message, details) => {
      errorMonitor.handleError({
        type: 'manual',
        message: message,
        details: details,
        timestamp: Date.now()
      });
    },
    clearErrors: () => errorMonitor.clearErrors(),
    getReport: () => errorMonitor.generateReport(),
    enable: () => CONFIG.enabled = true,
    disable: () => CONFIG.enabled = false
  };

  // Send remaining errors before page unload
  window.addEventListener('beforeunload', () => {
    if (errorQueue.length > 0) {
      errorMonitor.sendErrorBatch();
    }
  });

  // Log initialization
  if (CONFIG.enableConsoleLog) {
    console.log('🛡️ Error Monitor initialized');
  }
})();

/**
 * Server-side error handler (Express middleware)
 * Add this to your server.js
 */
const errorReportHandler = (req, res, next) => {
  if (req.path === '/api/error-report' && req.method === 'POST') {
    const { sessionId, errors, timestamp } = req.body;

    // Log errors
    console.error(`📊 Error Report from session ${sessionId}:`);
    errors.forEach(error => {
      if (error.type === 'missing_file') {
        console.error(`  🔴 MISSING FILE: ${error.url}`);
        console.error(`     Page: ${error.page}`);
      } else {
        console.error(`  ⚠️  ${error.type}: ${error.message}`);
      }
    });

    // Save to file for analysis
    const fs = require('fs');
    const logFile = 'error-reports.json';
    let reports = [];

    try {
      if (fs.existsSync(logFile)) {
        reports = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
      }
    } catch (e) {
      // Ignore
    }

    reports.push({
      sessionId,
      errors,
      timestamp,
      receivedAt: Date.now()
    });

    // Keep only last 1000 reports
    if (reports.length > 1000) {
      reports = reports.slice(-1000);
    }

    fs.writeFileSync(logFile, JSON.stringify(reports, null, 2));

    res.json({ status: 'received' });
  } else {
    next();
  }
};

// Export for server use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { errorReportHandler };
}