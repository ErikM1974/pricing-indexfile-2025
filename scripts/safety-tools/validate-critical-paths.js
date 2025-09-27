#!/usr/bin/env node

/**
 * @fileoverview Critical path validator to test all important application flows
 * @description Validates that all documented critical paths are working correctly
 * @author Safety System
 * @version 1.0
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';
const REPORT_FILE = 'critical-paths-report.json';
const TIMEOUT = 30000; // 30 seconds per test

// Critical paths from ACTIVE_FILES.md
const CRITICAL_PATHS = {
  'Core Entry Points': [
    {
      name: 'Main Catalog Page',
      path: '/index.html',
      dependencies: [
        'app-modern.js',
        'product-search-service.js',
        'catalog-search.js',
        'autocomplete-new.js'
      ],
      tests: [
        { type: 'element', selector: '#product-grid', name: 'Product grid exists' },
        { type: 'element', selector: '#search-box', name: 'Search box exists' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    },
    {
      name: 'Shopping Cart',
      path: '/cart.html',
      dependencies: [
        'cart.js',
        'cart-ui.js',
        'cart-price-recalculator.js',
        'order-form-pdf.js',
        'pricing-matrix-api.js',
        'utils.js'
      ],
      tests: [
        { type: 'element', selector: '#cart-items', name: 'Cart items container' },
        { type: 'element', selector: '#cart-total', name: 'Cart total display' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    },
    {
      name: 'Product Display',
      path: '/product.html',
      dependencies: ['product/app.js'],
      tests: [
        { type: 'element', selector: '#product-detail', name: 'Product detail section' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    }
  ],
  'DTG System': [
    {
      name: 'DTG Pricing Calculator',
      path: '/calculators/dtg-pricing.html',
      dependencies: ['dtg-adapter.js', 'dtg-pricing-service.js'],
      tests: [
        { type: 'element', selector: '#dtg-calculator', name: 'DTG calculator form' },
        { type: 'iframe', count: 1, name: 'Caspio iframe loaded' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    },
    {
      name: 'DTG Manual Pricing',
      path: '/calculators/dtg-manual-pricing.html',
      dependencies: ['dtg-config.js'],
      tests: [
        { type: 'element', selector: '#manual-pricing-form', name: 'Manual pricing form' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    },
    {
      name: 'DTG Quote Builder',
      path: '/quote-builders/dtg-quote-builder.html',
      dependencies: [], // 11 service files
      tests: [
        { type: 'element', selector: '#quote-builder', name: 'Quote builder interface' },
        { type: 'element', selector: '#quote-form', name: 'Quote form' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    }
  ],
  'Embroidery System': [
    {
      name: 'Embroidery Calculator',
      path: '/calculators/embroidery-pricing.html',
      dependencies: ['embroidery-pricing-service.js'],
      tests: [
        { type: 'element', selector: '#embroidery-calculator', name: 'Embroidery calculator' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    },
    {
      name: 'Embroidery Quote Builder',
      path: '/quote-builders/embroidery-quote-builder.html',
      dependencies: [], // 7 service files
      tests: [
        { type: 'element', selector: '#quote-builder', name: 'Quote builder' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    },
    {
      name: 'Cap Embroidery Quote Builder',
      path: '/quote-builders/cap-embroidery-quote-builder.html',
      dependencies: [], // 6 service files
      tests: [
        { type: 'element', selector: '#quote-builder', name: 'Quote builder' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    }
  ],
  'Special Calculators': [
    {
      name: 'Christmas Bundle',
      path: '/calculators/christmas-bundles.html',
      dependencies: ['product-search-service.js'],
      tests: [
        { type: 'element', selector: '#christmas-bundle', name: 'Christmas bundle form' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    },
    {
      name: 'Breast Cancer Bundle',
      path: '/calculators/breast-cancer-awareness-bundle.html',
      dependencies: ['breast-cancer-bundle-service.js'],
      tests: [
        { type: 'element', selector: '#bca-bundle', name: 'BCA bundle form' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    },
    {
      name: 'Safety Stripe Creator',
      path: '/calculators/safety-stripe-creator.html',
      dependencies: ['safety-stripe-calculator.js'],
      tests: [
        { type: 'element', selector: '#stripe-creator', name: 'Stripe creator form' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    },
    {
      name: 'Art Invoice Creator',
      path: '/calculators/art-invoice-creator.html',
      dependencies: ['art-invoice-service-v2.js'],
      tests: [
        { type: 'element', selector: '#invoice-form', name: 'Invoice form' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    }
  ],
  'Dashboards': [
    {
      name: 'Staff Dashboard',
      path: '/dashboards/staff-dashboard.html',
      dependencies: [],
      tests: [
        { type: 'element', selector: '#dashboard', name: 'Dashboard container' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    },
    {
      name: 'AE Dashboard',
      path: '/dashboards/ae-dashboard.html',
      dependencies: [],
      tests: [
        { type: 'element', selector: '#ae-dashboard', name: 'AE dashboard' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    },
    {
      name: 'Art Hub Dashboard',
      path: '/dashboards/art-hub-dashboard.html',
      dependencies: [],
      tests: [
        { type: 'element', selector: '#art-hub', name: 'Art hub' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    },
    {
      name: 'Art Invoices Dashboard',
      path: '/dashboards/art-invoices-dashboard.html',
      dependencies: [],
      tests: [
        { type: 'element', selector: '#invoices-dashboard', name: 'Invoices dashboard' },
        { type: 'console', maxErrors: 0, name: 'No console errors' }
      ]
    }
  ]
};

class CriticalPathValidator {
  constructor() {
    this.browser = null;
    this.results = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      totalTests: 0,
      passed: 0,
      failed: 0,
      paths: {}
    };
  }

  /**
   * Run all validation tests
   */
  async runValidation() {
    console.log('🔍 Starting Critical Path Validation...');
    console.log(`Base URL: ${BASE_URL}\n`);

    try {
      // Launch browser
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      // Test each category
      for (const [category, paths] of Object.entries(CRITICAL_PATHS)) {
        console.log(`\n📁 Testing ${category}:`);
        this.results.paths[category] = [];

        for (const pathConfig of paths) {
          await this.testPath(category, pathConfig);
        }
      }

      // Close browser
      await this.browser.close();

      // Save results
      this.saveResults();
      this.printSummary();

    } catch (error) {
      console.error('❌ Fatal error:', error.message);
      if (this.browser) {
        await this.browser.close();
      }
      process.exit(1);
    }
  }

  /**
   * Test a single critical path
   */
  async testPath(category, pathConfig) {
    const page = await this.browser.newPage();
    const url = BASE_URL + pathConfig.path;

    const result = {
      name: pathConfig.name,
      path: pathConfig.path,
      url: url,
      dependencies: pathConfig.dependencies,
      tests: [],
      status: 'passed',
      errors: [],
      warnings: []
    };

    console.log(`  Testing: ${pathConfig.name}`);

    try {
      // Set up console message collection
      const consoleMessages = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleMessages.push(msg.text());
        }
      });

      // Set up request failure detection
      const failedRequests = [];
      page.on('requestfailed', request => {
        failedRequests.push({
          url: request.url(),
          failure: request.failure().errorText
        });
      });

      // Navigate to page
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: TIMEOUT
      });

      // Check response status
      if (!response.ok()) {
        result.status = 'failed';
        result.errors.push(`Page returned status ${response.status()}`);
      }

      // Check for 404s in dependencies
      if (failedRequests.length > 0) {
        failedRequests.forEach(req => {
          const isDependency = pathConfig.dependencies.some(dep =>
            req.url.includes(dep)
          );
          if (isDependency) {
            result.status = 'failed';
            result.errors.push(`Dependency failed to load: ${req.url}`);
          }
        });
      }

      // Run tests
      for (const test of pathConfig.tests) {
        const testResult = await this.runTest(page, test, consoleMessages);
        result.tests.push(testResult);

        if (!testResult.passed) {
          result.status = 'failed';
        }
      }

      // Check for console errors
      if (consoleMessages.length > 0) {
        result.warnings.push(`Console errors: ${consoleMessages.length}`);
        result.errors.push(...consoleMessages.slice(0, 5)); // First 5 errors
      }

    } catch (error) {
      result.status = 'failed';
      result.errors.push(`Test failed: ${error.message}`);
    } finally {
      await page.close();
    }

    // Update statistics
    this.results.totalTests++;
    if (result.status === 'passed') {
      this.results.passed++;
      console.log(`    ✅ ${result.name}`);
    } else {
      this.results.failed++;
      console.log(`    ❌ ${result.name}`);
      result.errors.forEach(err => console.log(`       ${err}`));
    }

    this.results.paths[category].push(result);
  }

  /**
   * Run individual test
   */
  async runTest(page, test, consoleMessages) {
    const result = {
      name: test.name,
      type: test.type,
      passed: false,
      message: ''
    };

    try {
      switch (test.type) {
        case 'element':
          // Check if element exists
          const element = await page.$(test.selector);
          if (element) {
            result.passed = true;
            result.message = 'Element found';
          } else {
            result.message = `Element not found: ${test.selector}`;
          }
          break;

        case 'iframe':
          // Check iframe count
          const iframes = await page.$$('iframe');
          if (iframes.length >= test.count) {
            result.passed = true;
            result.message = `Found ${iframes.length} iframes`;
          } else {
            result.message = `Expected ${test.count} iframes, found ${iframes.length}`;
          }
          break;

        case 'console':
          // Check console errors
          if (consoleMessages.length <= test.maxErrors) {
            result.passed = true;
            result.message = `${consoleMessages.length} console errors`;
          } else {
            result.message = `Too many console errors: ${consoleMessages.length}`;
          }
          break;

        default:
          result.message = `Unknown test type: ${test.type}`;
      }
    } catch (error) {
      result.message = `Test error: ${error.message}`;
    }

    return result;
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
    console.log('\n' + '='.repeat(60));
    console.log('📊 Critical Path Validation Summary');
    console.log('='.repeat(60));
    console.log(`Total Paths Tested: ${this.results.totalTests}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`Success Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(1)}%`);

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Paths:');
      Object.entries(this.results.paths).forEach(([category, paths]) => {
        paths.forEach(path => {
          if (path.status === 'failed') {
            console.log(`  - ${category}/${path.name}`);
            path.errors.slice(0, 2).forEach(err => {
              console.log(`    ${err}`);
            });
          }
        });
      });
    }

    console.log(`\n✅ Results saved to: ${REPORT_FILE}`);

    // Exit with error if any failures
    if (this.results.failed > 0) {
      console.log('\n⚠️  Critical paths validation failed!');
      process.exit(1);
    } else {
      console.log('\n✅ All critical paths validated successfully!');
    }
  }
}

// Check if puppeteer is installed
try {
  require.resolve('puppeteer');
} catch (e) {
  console.log('⚠️  Puppeteer not installed. Installing...');
  console.log('Run: npm install puppeteer');
  console.log('\nNote: This script requires Puppeteer for browser automation testing.');
  process.exit(1);
}

// Run if called directly
if (require.main === module) {
  const validator = new CriticalPathValidator();
  validator.runValidation();
}

module.exports = CriticalPathValidator;