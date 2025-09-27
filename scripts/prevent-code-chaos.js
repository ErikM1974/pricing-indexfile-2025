#!/usr/bin/env node

/**
 * @fileoverview Preventative maintenance script to catch code problems early
 * @description Run this weekly to prevent code chaos from accumulating
 * @author Claude Coding Standards Enforcement
 * @version 2.0
 */

const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Configuration
const config = {
  // Folders to scan
  scanFolders: ['src', 'calculators', 'dashboards', 'quote-builders'],

  // Folders to ignore
  ignoreFolders: ['node_modules', '.git', '_archive', '_deprecated', 'dist', 'build'],

  // Problematic patterns
  badPatterns: {
    fileNames: ['-backup', '-FINAL', '-FIXED', '-old', '-copy', '-temp', '-test'],
    testFiles: ['test-', 'debug-', 'verify-', 'diagnose-'],
    duplicates: ['v2', 'v3', 'v4', '_2', '_3']
  },

  // File size limits (in lines)
  limits: {
    javascript: 500,
    html: 200,
    css: 1000,
    function: 50
  }
};

// Statistics
const stats = {
  totalFiles: 0,
  issues: {
    badNames: [],
    testInWrongPlace: [],
    inlineStyles: [],
    inlineScripts: [],
    hardcodedUrls: [],
    largeFiles: [],
    duplicates: [],
    orphaned: []
  }
};

/**
 * Print colored message
 */
function print(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

/**
 * Check if path should be ignored
 */
function shouldIgnore(filePath) {
  return config.ignoreFolders.some(folder => filePath.includes(folder));
}

/**
 * Get file extension
 */
function getExtension(fileName) {
  return path.extname(fileName).toLowerCase();
}

/**
 * Count lines in file
 */
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch (e) {
    return 0;
  }
}

/**
 * Check for problematic file names
 */
function checkFileName(filePath) {
  const fileName = path.basename(filePath);

  // Check for bad patterns in file names
  config.badPatterns.fileNames.forEach(pattern => {
    if (fileName.includes(pattern)) {
      stats.issues.badNames.push({
        file: filePath,
        pattern: pattern
      });
    }
  });

  // Check for test files outside test folder
  config.badPatterns.testFiles.forEach(pattern => {
    if (fileName.startsWith(pattern) && !filePath.includes('/tests/')) {
      stats.issues.testInWrongPlace.push(filePath);
    }
  });

  // Check for version numbers indicating duplicates
  config.badPatterns.duplicates.forEach(pattern => {
    if (fileName.includes(pattern)) {
      stats.issues.duplicates.push({
        file: filePath,
        pattern: pattern
      });
    }
  });
}

/**
 * Check HTML files for inline code
 */
function checkHtmlFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for inline styles
    if (content.includes('style="') || content.includes("style='")) {
      const matches = content.match(/style=["'][^"']+["']/g) || [];
      if (matches.length > 0) {
        stats.issues.inlineStyles.push({
          file: filePath,
          count: matches.length
        });
      }
    }

    // Check for inline scripts
    if (content.includes('<script>') && content.includes('</script>')) {
      const scriptBlocks = content.match(/<script>[\s\S]*?<\/script>/g) || [];
      if (scriptBlocks.length > 0) {
        stats.issues.inlineScripts.push({
          file: filePath,
          count: scriptBlocks.length
        });
      }
    }
  } catch (e) {
    // Ignore read errors
  }
}

/**
 * Check JavaScript files for issues
 */
function checkJavaScriptFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for hardcoded URLs
    const urlMatches = content.match(/["']https?:\/\/[^"']+["']/g) || [];
    urlMatches.forEach(match => {
      // Ignore CDN and external library URLs
      if (!match.includes('cdn') && !match.includes('googleapis') &&
          !match.includes('fontawesome') && !match.includes('jsdelivr')) {
        stats.issues.hardcodedUrls.push({
          file: filePath,
          url: match
        });
      }
    });

    // Check file size
    const lines = countLines(filePath);
    if (lines > config.limits.javascript) {
      stats.issues.largeFiles.push({
        file: filePath,
        lines: lines,
        limit: config.limits.javascript
      });
    }
  } catch (e) {
    // Ignore read errors
  }
}

/**
 * Check CSS files for issues
 */
function checkCssFile(filePath) {
  const lines = countLines(filePath);
  if (lines > config.limits.css) {
    stats.issues.largeFiles.push({
      file: filePath,
      lines: lines,
      limit: config.limits.css
    });
  }
}

/**
 * Process a single file
 */
function processFile(filePath) {
  stats.totalFiles++;

  // Check file name for problems
  checkFileName(filePath);

  // Check file content based on type
  const ext = getExtension(filePath);
  switch (ext) {
    case '.html':
      checkHtmlFile(filePath);
      break;
    case '.js':
      checkJavaScriptFile(filePath);
      break;
    case '.css':
      checkCssFile(filePath);
      break;
  }
}

/**
 * Walk directory recursively
 */
function walkDirectory(dir) {
  if (shouldIgnore(dir)) return;

  try {
    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walkDirectory(fullPath);
      } else if (stat.isFile()) {
        processFile(fullPath);
      }
    });
  } catch (e) {
    // Ignore directories we can't read
  }
}

/**
 * Find duplicate files by similar names
 */
function findDuplicates() {
  const fileMap = {};

  // Build map of base names
  function buildFileMap(dir) {
    if (shouldIgnore(dir)) return;

    try {
      const items = fs.readdirSync(dir);
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isFile()) {
          // Get base name without version numbers or suffixes
          let baseName = item
            .replace(/-v\d+/, '')
            .replace(/-\d+/, '')
            .replace(/-backup/, '')
            .replace(/-FINAL/, '')
            .replace(/-FIXED/, '')
            .replace(/-old/, '')
            .replace(/-copy/, '');

          if (!fileMap[baseName]) {
            fileMap[baseName] = [];
          }
          fileMap[baseName].push(fullPath);
        } else if (stat.isDirectory()) {
          buildFileMap(fullPath);
        }
      });
    } catch (e) {
      // Ignore
    }
  }

  config.scanFolders.forEach(folder => {
    if (fs.existsSync(folder)) {
      buildFileMap(folder);
    }
  });

  // Find actual duplicates
  Object.keys(fileMap).forEach(baseName => {
    if (fileMap[baseName].length > 1) {
      stats.issues.duplicates.push({
        baseName: baseName,
        files: fileMap[baseName]
      });
    }
  });
}

/**
 * Print report
 */
function printReport() {
  print('\n' + '='.repeat(60), 'cyan');
  print('CODE CHAOS PREVENTION REPORT', 'cyan');
  print('='.repeat(60), 'cyan');

  print(`\n📊 Scanned ${stats.totalFiles} files\n`);

  let totalIssues = 0;

  // Bad file names
  if (stats.issues.badNames.length > 0) {
    print(`❌ Files with problematic names: ${stats.issues.badNames.length}`, 'red');
    stats.issues.badNames.forEach(issue => {
      print(`   - ${issue.file} (contains "${issue.pattern}")`, 'yellow');
    });
    totalIssues += stats.issues.badNames.length;
  }

  // Test files in wrong place
  if (stats.issues.testInWrongPlace.length > 0) {
    print(`\n❌ Test files outside /tests folder: ${stats.issues.testInWrongPlace.length}`, 'red');
    stats.issues.testInWrongPlace.forEach(file => {
      print(`   - ${file}`, 'yellow');
    });
    totalIssues += stats.issues.testInWrongPlace.length;
  }

  // Inline styles
  if (stats.issues.inlineStyles.length > 0) {
    print(`\n❌ HTML files with inline styles: ${stats.issues.inlineStyles.length}`, 'red');
    stats.issues.inlineStyles.forEach(issue => {
      print(`   - ${issue.file} (${issue.count} inline styles)`, 'yellow');
    });
    totalIssues += stats.issues.inlineStyles.length;
  }

  // Inline scripts
  if (stats.issues.inlineScripts.length > 0) {
    print(`\n❌ HTML files with inline scripts: ${stats.issues.inlineScripts.length}`, 'red');
    stats.issues.inlineScripts.forEach(issue => {
      print(`   - ${issue.file} (${issue.count} script blocks)`, 'yellow');
    });
    totalIssues += stats.issues.inlineScripts.length;
  }

  // Hardcoded URLs
  if (stats.issues.hardcodedUrls.length > 0) {
    print(`\n❌ JavaScript files with hardcoded URLs: ${stats.issues.hardcodedUrls.length}`, 'red');
    const uniqueFiles = [...new Set(stats.issues.hardcodedUrls.map(i => i.file))];
    uniqueFiles.forEach(file => {
      const urls = stats.issues.hardcodedUrls
        .filter(i => i.file === file)
        .map(i => i.url);
      print(`   - ${file} (${urls.length} URLs)`, 'yellow');
    });
    totalIssues += stats.issues.hardcodedUrls.length;
  }

  // Large files
  if (stats.issues.largeFiles.length > 0) {
    print(`\n⚠️  Files exceeding size limits: ${stats.issues.largeFiles.length}`, 'yellow');
    stats.issues.largeFiles.forEach(issue => {
      print(`   - ${issue.file} (${issue.lines} lines, limit: ${issue.limit})`, 'yellow');
    });
  }

  // Potential duplicates
  const realDuplicates = stats.issues.duplicates.filter(d => d.files && d.files.length > 1);
  if (realDuplicates.length > 0) {
    print(`\n⚠️  Potential duplicate files: ${realDuplicates.length} groups`, 'yellow');
    realDuplicates.forEach(dup => {
      print(`   Base: ${dup.baseName}`, 'yellow');
      dup.files.forEach(f => print(`     - ${f}`, 'cyan'));
    });
  }

  // Summary
  print('\n' + '='.repeat(60), 'cyan');
  if (totalIssues === 0) {
    print('✅ EXCELLENT! No critical issues found.', 'green');
    print('Your codebase is clean and well-organized! 🎉', 'green');
  } else if (totalIssues < 10) {
    print(`⚠️  Found ${totalIssues} issues that should be addressed soon.`, 'yellow');
    print('Fix these before they accumulate!', 'yellow');
  } else {
    print(`❌ ALERT! Found ${totalIssues} issues requiring immediate attention!`, 'red');
    print('Clean these up NOW to prevent code chaos!', 'red');
  }
  print('='.repeat(60) + '\n', 'cyan');

  // Recommendations
  if (totalIssues > 0) {
    print('📋 Recommended Actions:', 'blue');
    if (stats.issues.badNames.length > 0) {
      print('   1. Rename files with -backup, -FINAL, etc. Use Git for versions.', 'blue');
    }
    if (stats.issues.testInWrongPlace.length > 0) {
      print('   2. Move all test files to /tests folder.', 'blue');
    }
    if (stats.issues.inlineStyles.length > 0) {
      print('   3. Extract inline styles to external CSS files.', 'blue');
    }
    if (stats.issues.inlineScripts.length > 0) {
      print('   4. Extract inline scripts to external JS files.', 'blue');
    }
    if (stats.issues.hardcodedUrls.length > 0) {
      print('   5. Move hardcoded URLs to configuration files.', 'blue');
    }
    if (stats.issues.largeFiles.length > 0) {
      print('   6. Split large files into smaller, focused modules.', 'blue');
    }
    if (realDuplicates.length > 0) {
      print('   7. Review and consolidate duplicate files.', 'blue');
    }
    print('');
  }

  // Exit code
  process.exit(totalIssues > 10 ? 1 : 0);
}

/**
 * Main execution
 */
function main() {
  print('\n🔍 Scanning for code chaos patterns...', 'cyan');

  // Scan each configured folder
  config.scanFolders.forEach(folder => {
    if (fs.existsSync(folder)) {
      print(`   Scanning ${folder}/...`, 'blue');
      walkDirectory(folder);
    }
  });

  // Find duplicates
  print('   Analyzing for duplicate files...', 'blue');
  findDuplicates();

  // Print report
  printReport();
}

// Run the script
main();