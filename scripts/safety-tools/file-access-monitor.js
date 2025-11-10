/**
 * @fileoverview File access monitoring middleware for Express
 * @description Tracks all file accesses to understand usage patterns before cleanup
 * @author Safety System
 * @version 1.0
 */

const fs = require('fs');
const path = require('path');
const url = require('url');

// Configuration
const LOG_FILE = 'file-access-log.json';
const REPORT_FILE = 'file-access-report.json';
const LOG_ROTATION_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * File Access Monitor Middleware
 * Add this to your server.js to track all file accesses
 */
class FileAccessMonitor {
  constructor(options = {}) {
    this.logFile = options.logFile || LOG_FILE;
    this.reportFile = options.reportFile || REPORT_FILE;
    this.ignorePaths = options.ignorePaths || [
      '/api',
      '/node_modules',
      '/favicon.ico',
      '/.git'
    ];
    this.accessMap = new Map();
    this.sessionData = {
      startTime: new Date().toISOString(),
      totalRequests: 0,
      uniqueFiles: 0,
      errors: []
    };

    // Load existing data if available
    this.loadExistingData();

    // Set up periodic save
    this.saveInterval = setInterval(() => {
      this.saveData();
    }, 30000); // Save every 30 seconds

    // Handle process termination
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Load existing access data
   */
  loadExistingData() {
    try {
      if (fs.existsSync(this.logFile)) {
        const data = fs.readFileSync(this.logFile, 'utf-8');
        const parsed = JSON.parse(data);

        // Restore access map
        if (parsed.files) {
          Object.entries(parsed.files).forEach(([file, data]) => {
            this.accessMap.set(file, data);
          });
        }
      }
    } catch (error) {
      console.error('Failed to load existing access data:', error.message);
    }
  }

  /**
   * Save access data to disk
   */
  saveData() {
    try {
      const data = {
        sessionData: this.sessionData,
        lastUpdated: new Date().toISOString(),
        files: {}
      };

      // Convert Map to object
      this.accessMap.forEach((value, key) => {
        data.files[key] = value;
      });

      fs.writeFileSync(this.logFile, JSON.stringify(data, null, 2));
    } catch (error) {
      this.sessionData.errors.push({
        time: new Date().toISOString(),
        error: `Failed to save data: ${error.message}`
      });
    }
  }

  /**
   * Express middleware function
   */
  middleware() {
    return (req, res, next) => {
      // Skip ignored paths
      const shouldIgnore = this.ignorePaths.some(ignorePath =>
        req.path.startsWith(ignorePath)
      );

      if (shouldIgnore) {
        return next();
      }

      // Track the request
      this.trackAccess(req);

      // Continue to next middleware
      next();
    };
  }

  /**
   * Track file access
   */
  trackAccess(req) {
    const now = new Date().toISOString();
    const filePath = req.path;

    // Skip if not a file request
    if (!this.isFileRequest(filePath)) {
      return;
    }

    this.sessionData.totalRequests++;

    // Get or create file entry
    let fileData = this.accessMap.get(filePath) || {
      firstAccess: now,
      lastAccess: now,
      accessCount: 0,
      methods: {},
      referrers: new Set(),
      userAgents: new Set(),
      statusCodes: {},
      accessTimes: []
    };

    // Update access data
    fileData.lastAccess = now;
    fileData.accessCount++;

    // Track HTTP method
    fileData.methods[req.method] = (fileData.methods[req.method] || 0) + 1;

    // Track referrer
    if (req.headers.referer) {
      fileData.referrers.add(req.headers.referer);
    }

    // Track user agent
    if (req.headers['user-agent']) {
      fileData.userAgents.add(req.headers['user-agent']);
    }

    // Track access times (keep last 100)
    fileData.accessTimes.push(now);
    if (fileData.accessTimes.length > 100) {
      fileData.accessTimes.shift();
    }

    // Store updated data
    this.accessMap.set(filePath, fileData);

    // Update unique files count
    this.sessionData.uniqueFiles = this.accessMap.size;
  }

  /**
   * Check if path is likely a file request
   */
  isFileRequest(filePath) {
    // Check for file extension
    const hasExtension = path.extname(filePath) !== '';

    // Common file patterns
    const filePatterns = [
      /\.(html?|js|css|json|xml|txt|md)$/i,
      /\.(png|jpg|jpeg|gif|svg|ico)$/i,
      /\.(pdf|doc|docx|xls|xlsx)$/i,
      /\.(woff2?|ttf|eot)$/i
    ];

    return hasExtension || filePatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Generate access report
   */
  generateReport() {
    const report = {
      generated: new Date().toISOString(),
      duration: this.getSessionDuration(),
      summary: {
        totalRequests: this.sessionData.totalRequests,
        uniqueFiles: this.sessionData.uniqueFiles,
        errors: this.sessionData.errors.length
      },
      files: {
        mostAccessed: [],
        leastAccessed: [],
        neverAccessed: [],
        byType: {},
        byFolder: {}
      },
      recommendations: []
    };

    // Sort files by access count
    const sortedFiles = Array.from(this.accessMap.entries())
      .map(([path, data]) => ({
        path,
        ...data,
        referrers: Array.from(data.referrers || []),
        userAgents: Array.from(data.userAgents || [])
      }))
      .sort((a, b) => b.accessCount - a.accessCount);

    // Most accessed files (top 20)
    report.files.mostAccessed = sortedFiles.slice(0, 20).map(file => ({
      path: file.path,
      accessCount: file.accessCount,
      lastAccess: file.lastAccess
    }));

    // Least accessed files (accessed only once or twice)
    report.files.leastAccessed = sortedFiles
      .filter(file => file.accessCount <= 2)
      .map(file => ({
        path: file.path,
        accessCount: file.accessCount,
        lastAccess: file.lastAccess
      }));

    // Group by file type
    sortedFiles.forEach(file => {
      const ext = path.extname(file.path) || 'no-extension';
      if (!report.files.byType[ext]) {
        report.files.byType[ext] = {
          count: 0,
          totalAccesses: 0,
          files: []
        };
      }
      report.files.byType[ext].count++;
      report.files.byType[ext].totalAccesses += file.accessCount;
      report.files.byType[ext].files.push(file.path);
    });

    // Group by folder
    sortedFiles.forEach(file => {
      const folder = path.dirname(file.path);
      if (!report.files.byFolder[folder]) {
        report.files.byFolder[folder] = {
          count: 0,
          totalAccesses: 0,
          files: []
        };
      }
      report.files.byFolder[folder].count++;
      report.files.byFolder[folder].totalAccesses += file.accessCount;
      report.files.byFolder[folder].files.push(path.basename(file.path));
    });

    // Find files never accessed (requires file system scan)
    report.files.neverAccessed = this.findNeverAccessedFiles();

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    // Save report
    fs.writeFileSync(this.reportFile, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Find files that exist but were never accessed
   */
  findNeverAccessedFiles() {
    const neverAccessed = [];
    const projectRoot = process.cwd();

    // Define folders to check
    const foldersToCheck = [
      'calculators',
      'shared_components',
      'dashboards',
      'quote-builders',
      'training'
    ];

    foldersToCheck.forEach(folder => {
      const folderPath = path.join(projectRoot, folder);
      if (fs.existsSync(folderPath)) {
        this.scanFolder(folderPath, neverAccessed);
      }
    });

    return neverAccessed;
  }

  /**
   * Recursively scan folder for unaccessed files
   */
  scanFolder(folderPath, neverAccessed) {
    try {
      const items = fs.readdirSync(folderPath);

      items.forEach(item => {
        const fullPath = path.join(folderPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          this.scanFolder(fullPath, neverAccessed);
        } else if (stat.isFile()) {
          const relativePath = '/' + path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

          // Check if file was accessed
          if (!this.accessMap.has(relativePath)) {
            neverAccessed.push(relativePath);
          }
        }
      });
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Generate cleanup recommendations
   */
  generateRecommendations(report) {
    const recommendations = [];

    // Files accessed only once might be candidates for removal
    if (report.files.leastAccessed.length > 0) {
      recommendations.push({
        priority: 'LOW',
        message: `Found ${report.files.leastAccessed.length} files accessed 2 times or less`,
        action: 'Review these files for potential quarantine',
        files: report.files.leastAccessed.slice(0, 10).map(f => f.path)
      });
    }

    // Never accessed files are strong candidates
    if (report.files.neverAccessed.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        message: `Found ${report.files.neverAccessed.length} files never accessed during monitoring`,
        action: 'Consider quarantining these files (after verification)',
        files: report.files.neverAccessed.slice(0, 10)
      });
    }

    // Check for patterns in file types
    const lowAccessTypes = Object.entries(report.files.byType)
      .filter(([ext, data]) => data.totalAccesses / data.count < 2)
      .map(([ext]) => ext);

    if (lowAccessTypes.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        message: `File types with low average access: ${lowAccessTypes.join(', ')}`,
        action: 'Review files of these types for relevance'
      });
    }

    return recommendations;
  }

  /**
   * Get session duration
   */
  getSessionDuration() {
    const start = new Date(this.sessionData.startTime);
    const now = new Date();
    const duration = now - start;

    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
    const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return `${days} days, ${hours} hours`;
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    console.log('\n📊 Generating final access report...');
    this.generateReport();
    this.saveData();
    clearInterval(this.saveInterval);
    console.log('✅ File access monitoring data saved');
    process.exit(0);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.sessionData,
      duration: this.getSessionDuration()
    };
  }
}

// Export for use in server.js
module.exports = FileAccessMonitor;

/**
 * Example integration in server.js:
 *
 * const FileAccessMonitor = require('./scripts/safety-tools/file-access-monitor');
 * const monitor = new FileAccessMonitor();
 *
 * // Add monitoring middleware BEFORE static file serving
 * app.use(monitor.middleware());
 *
 * // Add endpoint to view stats
 * app.get('/api/monitor/stats', (req, res) => {
 *   res.json(monitor.getStats());
 * });
 *
 * // Add endpoint to generate report
 * app.get('/api/monitor/report', (req, res) => {
 *   const report = monitor.generateReport();
 *   res.json(report);
 * });
 */