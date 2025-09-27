#!/usr/bin/env node

/**
 * @fileoverview Comprehensive test suite for all HTML pages
 * @description Tests all 155+ HTML pages for basic functionality and missing resources
 * @author Safety System
 * @version 1.0
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const axios = require('axios');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';
const REPORT_FILE = 'comprehensive-test-report.json';
const TIMEOUT = 15000; // 15 seconds per page
const CONCURRENT_TESTS = 5; // Run 5 tests in parallel

class ComprehensiveTestSuite {
  constructor() {
    this.browser = null;
    this.results = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      },
      pages: [],
      missingResources: [],
      consoleErrors: [],
      networkErrors: []
    };
    this.startTime = Date.now();
  }

  /**
   * Discover all HTML files in project
   */
  discoverHtmlFiles() {
    const htmlFiles = [];
    const ignoreDirs = ['node_modules', '.git', '_archive', '_deprecated', '_quarantine', 'dist', 'build'];

    function scanDirectory(dir, baseDir = '') {
      const items = fs.readdirSync(dir);

      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const dirname = path.basename(fullPath);
          if (!ignoreDirs.includes(dirname)) {
            scanDirectory(fullPath, path.join(baseDir, item));
          }
        } else if (stat.isFile() && (item.endsWith('.html') || item.endsWith('.htm'))) {
          const relativePath = path.join(baseDir, item).replace(/\\/g, '/');
          htmlFiles.push('/' + relativePath);
        }
      });
    }

    scanDirectory(process.cwd());
    return htmlFiles.sort();
  }

  /**
   * Run comprehensive test suite
   */
  async runTests() {
    console.log('🧪 Starting Comprehensive Test Suite');
    console.log(`Base URL: ${BASE_URL}\n`);

    // Discover HTML files
    const htmlFiles = this.discoverHtmlFiles();
    console.log(`Found ${htmlFiles.length} HTML files to test\n`);

    this.results.summary.total = htmlFiles.length;

    try {
      // Launch browser
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      // Process files in batches
      for (let i = 0; i < htmlFiles.length; i += CONCURRENT_TESTS) {
        const batch = htmlFiles.slice(i, i + CONCURRENT_TESTS);
        await this.testBatch(batch);

        // Progress update
        const progress = Math.min(i + CONCURRENT_TESTS, htmlFiles.length);
        console.log(`\nProgress: ${progress}/${htmlFiles.length} pages tested`);
      }

      // Close browser
      await this.browser.close();

    } catch (error) {
      console.error('❌ Fatal error:', error.message);
      if (this.browser) {
        await this.browser.close();
      }
    }

    // Calculate duration
    this.results.summary.duration = Date.now() - this.startTime;

    // Save and display results
    this.saveResults();
    this.printSummary();
  }

  /**
   * Test a batch of pages concurrently
   */
  async testBatch(files) {
    const promises = files.map(file => this.testPage(file));
    await Promise.all(promises);
  }

  /**
   * Test individual page
   */
  async testPage(filePath) {
    const page = await this.browser.newPage();
    const url = BASE_URL + filePath;

    const result = {
      path: filePath,
      url: url,
      status: 'passed',
      loadTime: 0,
      errors: [],
      warnings: [],
      missingResources: [],
      consoleErrors: [],
      metrics: {}
    };

    const startTime = Date.now();

    try {
      // Set up error collection
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
          this.results.consoleErrors.push({
            page: filePath,
            error: msg.text()
          });
        }
      });

      // Track failed requests
      const failedRequests = [];
      page.on('requestfailed', request => {
        const failure = {
          url: request.url(),
          error: request.failure().errorText
        };
        failedRequests.push(failure);
        this.results.networkErrors.push({
          page: filePath,
          ...failure
        });
      });

      // Set viewport
      await page.setViewport({ width: 1280, height: 720 });

      // Navigate to page
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: TIMEOUT
      });

      result.loadTime = Date.now() - startTime;

      // Check response status
      if (!response) {
        result.status = 'failed';
        result.errors.push('No response received');
      } else if (!response.ok()) {
        result.status = 'failed';
        result.errors.push(`HTTP ${response.status()}`);
      }

      // Collect page metrics
      result.metrics = await page.metrics();

      // Check for basic elements
      const hasBody = await page.$('body') !== null;
      if (!hasBody) {
        result.status = 'failed';
        result.errors.push('No body element found');
      }

      // Check for common issues
      const checks = await page.evaluate(() => {
        return {
          hasTitle: document.title !== '',
          hasContent: document.body.innerHTML.length > 100,
          formCount: document.querySelectorAll('form').length,
          linkCount: document.querySelectorAll('a').length,
          scriptCount: document.querySelectorAll('script').length,
          imageCount: document.querySelectorAll('img').length,
          iframeCount: document.querySelectorAll('iframe').length
        };
      });

      result.metrics = { ...result.metrics, ...checks };

      // Check for missing resources
      if (failedRequests.length > 0) {
        result.missingResources = failedRequests;
        this.results.missingResources.push({
          page: filePath,
          resources: failedRequests
        });

        // Mark as failed if critical resources are missing
        const criticalMissing = failedRequests.some(req =>
          req.url.endsWith('.js') || req.url.endsWith('.css')
        );
        if (criticalMissing) {
          result.status = 'failed';
          result.errors.push(`${failedRequests.length} resources failed to load`);
        } else {
          result.warnings.push(`${failedRequests.length} non-critical resources failed`);
        }
      }

      // Check console errors
      if (consoleErrors.length > 0) {
        result.consoleErrors = consoleErrors;
        result.warnings.push(`${consoleErrors.length} console errors`);
      }

      // Take screenshot if failed
      if (result.status === 'failed') {
        const screenshotPath = `screenshots/failed-${filePath.replace(/\//g, '-')}.png`;
        const screenshotDir = path.dirname(screenshotPath);
        if (!fs.existsSync(screenshotDir)) {
          fs.mkdirSync(screenshotDir, { recursive: true });
        }
        await page.screenshot({ path: screenshotPath });
        result.screenshot = screenshotPath;
      }

    } catch (error) {
      result.status = 'failed';
      result.errors.push(error.message);
    } finally {
      await page.close();
    }

    // Update summary
    if (result.status === 'passed') {
      this.results.summary.passed++;
      console.log(`✅ ${filePath}`);
    } else {
      this.results.summary.failed++;
      console.log(`❌ ${filePath}: ${result.errors[0]}`);
    }

    this.results.pages.push(result);
  }

  /**
   * Quick health check without browser
   */
  async quickHealthCheck() {
    console.log('🩺 Running Quick Health Check...\n');

    const htmlFiles = this.discoverHtmlFiles();
    const results = {
      accessible: [],
      notFound: [],
      serverError: []
    };

    for (const file of htmlFiles) {
      const url = BASE_URL + file;

      try {
        const response = await axios.head(url, { timeout: 5000 });

        if (response.status === 200) {
          results.accessible.push(file);
          console.log(`✅ ${file}`);
        } else if (response.status === 404) {
          results.notFound.push(file);
          console.log(`❌ 404: ${file}`);
        } else {
          results.serverError.push({ file, status: response.status });
          console.log(`⚠️  ${response.status}: ${file}`);
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          results.notFound.push(file);
          console.log(`❌ 404: ${file}`);
        } else {
          results.serverError.push({ file, error: error.message });
          console.log(`❌ Error: ${file}`);
        }
      }
    }

    console.log('\n📊 Quick Health Check Results:');
    console.log(`✅ Accessible: ${results.accessible.length}`);
    console.log(`❌ Not Found: ${results.notFound.length}`);
    console.log(`⚠️  Errors: ${results.serverError.length}`);

    return results;
  }

  /**
   * Save test results
   */
  saveResults() {
    fs.writeFileSync(REPORT_FILE, JSON.stringify(this.results, null, 2));
  }

  /**
   * Print summary
   */
  printSummary() {
    const duration = (this.results.summary.duration / 1000).toFixed(2);
    const successRate = ((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('📊 Comprehensive Test Summary');
    console.log('='.repeat(60));
    console.log(`Total Pages: ${this.results.summary.total}`);
    console.log(`✅ Passed: ${this.results.summary.passed}`);
    console.log(`❌ Failed: ${this.results.summary.failed}`);
    console.log(`⏩ Skipped: ${this.results.summary.skipped}`);
    console.log(`Success Rate: ${successRate}%`);
    console.log(`Duration: ${duration} seconds`);

    // Show top issues
    if (this.results.missingResources.length > 0) {
      console.log('\n🔴 Pages with Missing Resources:');
      this.results.missingResources.slice(0, 5).forEach(item => {
        console.log(`  ${item.page}: ${item.resources.length} missing`);
      });
    }

    if (this.results.consoleErrors.length > 0) {
      console.log('\n⚠️  Pages with Console Errors:');
      const errorsByPage = {};
      this.results.consoleErrors.forEach(err => {
        errorsByPage[err.page] = (errorsByPage[err.page] || 0) + 1;
      });
      Object.entries(errorsByPage)
        .slice(0, 5)
        .forEach(([page, count]) => {
          console.log(`  ${page}: ${count} errors`);
        });
    }

    // Show failed pages
    if (this.results.summary.failed > 0) {
      console.log('\n❌ Failed Pages:');
      this.results.pages
        .filter(p => p.status === 'failed')
        .slice(0, 10)
        .forEach(page => {
          console.log(`  ${page.path}: ${page.errors[0]}`);
        });
    }

    console.log(`\n✅ Full report saved to: ${REPORT_FILE}`);

    // Exit code
    process.exit(this.results.summary.failed > 0 ? 1 : 0);
  }
}

// Check dependencies
function checkDependencies() {
  const missing = [];

  try {
    require.resolve('puppeteer');
  } catch (e) {
    missing.push('puppeteer');
  }

  try {
    require.resolve('axios');
  } catch (e) {
    missing.push('axios');
  }

  if (missing.length > 0) {
    console.log('⚠️  Missing dependencies. Please install:');
    console.log(`npm install ${missing.join(' ')}`);
    process.exit(1);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help') {
    console.log('\n🧪 Comprehensive Test Suite\n');
    console.log('Usage:');
    console.log('  node comprehensive-test-suite.js test    - Run full test suite');
    console.log('  node comprehensive-test-suite.js quick   - Quick health check (no browser)');
    console.log('  node comprehensive-test-suite.js list    - List all HTML files');
    console.log('');
    console.log('Environment Variables:');
    console.log('  TEST_URL - Base URL for testing (default: http://localhost:3001)');
    return;
  }

  // Check dependencies
  checkDependencies();

  const suite = new ComprehensiveTestSuite();

  switch (command) {
    case 'test':
      suite.runTests();
      break;

    case 'quick':
      suite.quickHealthCheck();
      break;

    case 'list':
      const files = suite.discoverHtmlFiles();
      console.log(`\n📄 Found ${files.length} HTML files:\n`);
      files.forEach(file => console.log(`  ${file}`));
      break;

    default:
      console.log(`❌ Unknown command: ${command}`);
  }
}

module.exports = ComprehensiveTestSuite;