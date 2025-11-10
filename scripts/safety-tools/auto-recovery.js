#!/usr/bin/env node

/**
 * @fileoverview Auto-recovery system for restoring files from quarantine
 * @description Automatically recovers missing files when errors are detected
 * @author Safety System
 * @version 1.0
 */

const fs = require('fs');
const path = require('path');
const { quarantineFile, recoverFile } = require('./safe-delete');

// Configuration
const RECOVERY_LOG = 'recovery-log.json';
const QUARANTINE_BASE = '_quarantine';
const MAX_RECOVERY_ATTEMPTS = 3; // Prevent infinite loops

class AutoRecoverySystem {
  constructor() {
    this.recoveryLog = this.loadRecoveryLog();
    this.activeRecoveries = new Map();
  }

  /**
   * Load recovery log
   */
  loadRecoveryLog() {
    try {
      if (fs.existsSync(RECOVERY_LOG)) {
        const content = fs.readFileSync(RECOVERY_LOG, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to load recovery log:', error.message);
    }

    return {
      sessions: [],
      totalRecoveries: 0,
      failedRecoveries: 0,
      files: {}
    };
  }

  /**
   * Save recovery log
   */
  saveRecoveryLog() {
    try {
      fs.writeFileSync(RECOVERY_LOG, JSON.stringify(this.recoveryLog, null, 2));
    } catch (error) {
      console.error('Failed to save recovery log:', error.message);
    }
  }

  /**
   * Express middleware for auto-recovery
   */
  middleware() {
    return async (req, res, next) => {
      // Handle recovery requests
      if (req.path === '/api/recover-file' && req.method === 'POST') {
        const { original, quarantine, page, sessionId } = req.body;
        const result = await this.attemptRecovery(original, quarantine, page, sessionId);
        return res.json(result);
      }

      // Monitor 404 errors
      const originalSend = res.send;
      res.send = function(data) {
        if (res.statusCode === 404) {
          // Attempt auto-recovery for 404s
          const filePath = req.path;
          autoRecovery.checkAndRecover(filePath, req.headers.referer);
        }
        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Check and recover missing file
   */
  async checkAndRecover(filePath, referrer = '') {
    // Skip if already attempting recovery
    if (this.activeRecoveries.has(filePath)) {
      return;
    }

    // Check if file exists in quarantine
    const quarantinePath = this.findInQuarantine(filePath);
    if (!quarantinePath) {
      return null;
    }

    // Check recovery attempts
    if (!this.recoveryLog.files[filePath]) {
      this.recoveryLog.files[filePath] = {
        attempts: 0,
        firstAttempt: new Date().toISOString(),
        lastAttempt: null,
        recovered: false
      };
    }

    const fileLog = this.recoveryLog.files[filePath];

    // Don't exceed max attempts
    if (fileLog.attempts >= MAX_RECOVERY_ATTEMPTS) {
      console.log(`⚠️  Max recovery attempts reached for ${filePath}`);
      return null;
    }

    // Mark as active recovery
    this.activeRecoveries.set(filePath, true);

    console.log(`🔄 Auto-recovering: ${filePath}`);

    try {
      // Attempt recovery
      const success = await this.recoverFromQuarantine(quarantinePath, filePath);

      if (success) {
        fileLog.recovered = true;
        fileLog.recoveredAt = new Date().toISOString();
        this.recoveryLog.totalRecoveries++;

        console.log(`✅ Successfully recovered: ${filePath}`);

        // Log recovery session
        this.logRecoverySession({
          file: filePath,
          quarantine: quarantinePath,
          referrer: referrer,
          success: true,
          timestamp: new Date().toISOString()
        });

        return { success: true, file: filePath };
      } else {
        throw new Error('Recovery failed');
      }
    } catch (error) {
      fileLog.attempts++;
      fileLog.lastAttempt = new Date().toISOString();
      fileLog.lastError = error.message;
      this.recoveryLog.failedRecoveries++;

      console.error(`❌ Failed to recover ${filePath}: ${error.message}`);

      // Log failed recovery
      this.logRecoverySession({
        file: filePath,
        quarantine: quarantinePath,
        referrer: referrer,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return { success: false, file: filePath, error: error.message };
    } finally {
      // Remove from active recoveries
      this.activeRecoveries.delete(filePath);
      this.saveRecoveryLog();
    }
  }

  /**
   * Attempt recovery from specific quarantine location
   */
  async attemptRecovery(originalPath, quarantinePath, page, sessionId) {
    console.log(`🔄 Recovery requested for: ${originalPath}`);
    console.log(`   From quarantine: ${quarantinePath}`);
    console.log(`   Requested by: ${page}`);

    const result = await this.checkAndRecover(originalPath, page);

    if (result && result.success) {
      // Send notification about successful recovery
      this.notifyRecovery(originalPath, page, sessionId);
    }

    return result || { success: false, message: 'File not found in quarantine' };
  }

  /**
   * Find file in quarantine folders
   */
  findInQuarantine(filePath) {
    if (!fs.existsSync(QUARANTINE_BASE)) {
      return null;
    }

    // Remove leading slash for relative path
    const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

    // Check recent quarantine folders (last 7 days)
    const folders = fs.readdirSync(QUARANTINE_BASE)
      .filter(folder => folder.match(/\d{4}-\d{2}-\d{2}/))
      .sort()
      .reverse()
      .slice(0, 7); // Check last 7 days

    for (const folder of folders) {
      const quarantinePath = path.join(QUARANTINE_BASE, folder, relativePath);

      if (fs.existsSync(quarantinePath)) {
        return quarantinePath;
      }
    }

    return null;
  }

  /**
   * Recover file from quarantine
   */
  async recoverFromQuarantine(quarantinePath, originalPath) {
    // Ensure original path is relative to project root
    const targetPath = originalPath.startsWith('/')
      ? path.join(process.cwd(), originalPath.substring(1))
      : path.join(process.cwd(), originalPath);

    // Create directory if needed
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Move file back
    fs.copyFileSync(quarantinePath, targetPath);

    // Verify recovery
    if (!fs.existsSync(targetPath)) {
      throw new Error('File recovery verification failed');
    }

    return true;
  }

  /**
   * Log recovery session
   */
  logRecoverySession(session) {
    this.recoveryLog.sessions.push(session);

    // Keep only last 1000 sessions
    if (this.recoveryLog.sessions.length > 1000) {
      this.recoveryLog.sessions = this.recoveryLog.sessions.slice(-1000);
    }
  }

  /**
   * Notify about successful recovery
   */
  notifyRecovery(filePath, page, sessionId) {
    console.log('📧 Recovery Notification:');
    console.log(`   File: ${filePath}`);
    console.log(`   Recovered for: ${page}`);
    console.log(`   Session: ${sessionId}`);

    // Here you could send email, Slack notification, etc.
  }

  /**
   * Generate recovery report
   */
  generateReport() {
    const report = {
      generated: new Date().toISOString(),
      summary: {
        totalRecoveries: this.recoveryLog.totalRecoveries,
        failedRecoveries: this.recoveryLog.failedRecoveries,
        successRate: this.recoveryLog.totalRecoveries > 0
          ? ((this.recoveryLog.totalRecoveries /
             (this.recoveryLog.totalRecoveries + this.recoveryLog.failedRecoveries)) * 100).toFixed(2) + '%'
          : '0%'
      },
      recentRecoveries: this.recoveryLog.sessions
        .filter(s => s.success)
        .slice(-20),
      problemFiles: Object.entries(this.recoveryLog.files)
        .filter(([file, data]) => data.attempts >= MAX_RECOVERY_ATTEMPTS)
        .map(([file, data]) => ({
          file,
          attempts: data.attempts,
          lastError: data.lastError
        })),
      recommendations: []
    };

    // Generate recommendations
    if (report.problemFiles.length > 0) {
      report.recommendations.push({
        priority: 'HIGH',
        message: `${report.problemFiles.length} files failed max recovery attempts`,
        action: 'These files may be permanently missing or have deeper issues'
      });
    }

    const recentFailures = this.recoveryLog.sessions
      .slice(-100)
      .filter(s => !s.success).length;

    if (recentFailures > 10) {
      report.recommendations.push({
        priority: 'MEDIUM',
        message: `${recentFailures} recovery failures in last 100 attempts`,
        action: 'Review quarantine system and file paths'
      });
    }

    return report;
  }

  /**
   * Manual recovery command
   */
  async manualRecover(filePath) {
    console.log(`🔧 Manual recovery requested for: ${filePath}`);

    const quarantinePath = this.findInQuarantine(filePath);

    if (!quarantinePath) {
      console.log(`❌ File not found in quarantine: ${filePath}`);
      return false;
    }

    try {
      const success = await this.recoverFromQuarantine(quarantinePath, filePath);
      if (success) {
        console.log(`✅ Successfully recovered: ${filePath}`);
        return true;
      }
    } catch (error) {
      console.error(`❌ Recovery failed: ${error.message}`);
    }

    return false;
  }

  /**
   * Batch recovery
   */
  async batchRecover(files) {
    const results = {
      successful: [],
      failed: []
    };

    for (const file of files) {
      const result = await this.manualRecover(file);
      if (result) {
        results.successful.push(file);
      } else {
        results.failed.push(file);
      }
    }

    console.log(`\n📊 Batch Recovery Results:`);
    console.log(`   ✅ Successful: ${results.successful.length}`);
    console.log(`   ❌ Failed: ${results.failed.length}`);

    return results;
  }
}

// Create singleton instance
const autoRecovery = new AutoRecoverySystem();

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help') {
    console.log('\n🔄 Auto-Recovery System\n');
    console.log('Usage:');
    console.log('  node auto-recovery.js recover <file>    - Manually recover a file');
    console.log('  node auto-recovery.js batch <file1> ... - Batch recover multiple files');
    console.log('  node auto-recovery.js report            - Generate recovery report');
    console.log('  node auto-recovery.js monitor           - Start monitoring mode');
    return;
  }

  switch (command) {
    case 'recover':
      const file = args[1];
      if (!file) {
        console.log('❌ Please specify a file to recover');
        return;
      }
      autoRecovery.manualRecover(file);
      break;

    case 'batch':
      const files = args.slice(1);
      if (files.length === 0) {
        console.log('❌ Please specify files to recover');
        return;
      }
      autoRecovery.batchRecover(files);
      break;

    case 'report':
      const report = autoRecovery.generateReport();
      console.log('\n📊 Recovery Report:');
      console.log(JSON.stringify(report, null, 2));
      break;

    case 'monitor':
      console.log('🔍 Starting recovery monitor...');
      console.log('This should be integrated with your Express server.');
      console.log('\nAdd to server.js:');
      console.log('const { autoRecovery } = require("./scripts/safety-tools/auto-recovery");');
      console.log('app.use(autoRecovery.middleware());');
      break;

    default:
      console.log(`❌ Unknown command: ${command}`);
  }
}

// Export for use in server
module.exports = { autoRecovery, AutoRecoverySystem };