#!/usr/bin/env node

/**
 * @fileoverview Safe deletion system that quarantines files instead of permanently deleting them
 * @description Moves files to dated quarantine folder with manifest for easy recovery
 * @author Safety System
 * @version 1.0
 */

const fs = require('fs');
const path = require('path');

// Configuration
const QUARANTINE_BASE = '_quarantine';
const RETENTION_DAYS = 90; // Keep quarantined files for 90 days
const MANIFEST_FILE = 'manifest.json';

// Color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

/**
 * Print colored message to console
 */
function print(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

/**
 * Create quarantine folder for today if it doesn't exist
 */
function getQuarantineFolder() {
  const today = new Date().toISOString().split('T')[0];
  const folderPath = path.join(QUARANTINE_BASE, today);

  if (!fs.existsSync(QUARANTINE_BASE)) {
    fs.mkdirSync(QUARANTINE_BASE);
  }

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  return folderPath;
}

/**
 * Load or create manifest file
 */
function loadManifest(quarantineFolder) {
  const manifestPath = path.join(quarantineFolder, MANIFEST_FILE);

  if (fs.existsSync(manifestPath)) {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content);
  }

  return {
    date: new Date().toISOString(),
    files: [],
    totalSize: 0,
    retention: {
      days: RETENTION_DAYS,
      deleteAfter: new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    }
  };
}

/**
 * Save manifest file
 */
function saveManifest(quarantineFolder, manifest) {
  const manifestPath = path.join(quarantineFolder, MANIFEST_FILE);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (e) {
    return 0;
  }
}

/**
 * Quarantine a single file
 */
function quarantineFile(filePath, reason = 'Manual cleanup') {
  if (!fs.existsSync(filePath)) {
    print(`❌ File not found: ${filePath}`, 'red');
    return false;
  }

  const quarantineFolder = getQuarantineFolder();
  const manifest = loadManifest(quarantineFolder);

  // Get file info
  const fileName = path.basename(filePath);
  const fileSize = getFileSize(filePath);
  const originalPath = path.resolve(filePath);

  // Create subdirectory structure in quarantine to preserve paths
  const relativePath = path.relative(process.cwd(), originalPath);
  const quarantinePath = path.join(quarantineFolder, relativePath);
  const quarantineDir = path.dirname(quarantinePath);

  // Create directory structure in quarantine
  fs.mkdirSync(quarantineDir, { recursive: true });

  // Move file to quarantine
  try {
    fs.renameSync(filePath, quarantinePath);

    // Add to manifest
    manifest.files.push({
      originalPath: originalPath,
      quarantinePath: quarantinePath,
      fileName: fileName,
      size: fileSize,
      reason: reason,
      quarantinedAt: new Date().toISOString(),
      recoverable: true
    });
    manifest.totalSize += fileSize;

    // Save updated manifest
    saveManifest(quarantineFolder, manifest);

    print(`✅ Quarantined: ${fileName}`, 'green');
    print(`   Original: ${originalPath}`, 'cyan');
    print(`   Quarantine: ${quarantinePath}`, 'cyan');
    print(`   Reason: ${reason}`, 'yellow');

    return true;
  } catch (error) {
    print(`❌ Failed to quarantine ${fileName}: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Recover a file from quarantine
 */
function recoverFile(quarantinePath) {
  // Find the file in today's or recent quarantine folders
  const quarantineFolders = fs.readdirSync(QUARANTINE_BASE)
    .filter(folder => folder.match(/\d{4}-\d{2}-\d{2}/))
    .sort()
    .reverse(); // Most recent first

  for (const folder of quarantineFolders) {
    const folderPath = path.join(QUARANTINE_BASE, folder);
    const manifest = loadManifest(folderPath);

    // Look for file in manifest
    const fileEntry = manifest.files.find(f =>
      f.quarantinePath === quarantinePath ||
      f.fileName === path.basename(quarantinePath) ||
      f.originalPath === quarantinePath
    );

    if (fileEntry && fileEntry.recoverable) {
      const fullQuarantinePath = path.join(folderPath, path.relative(folderPath, fileEntry.quarantinePath));

      if (fs.existsSync(fullQuarantinePath)) {
        try {
          // Restore to original location
          const originalDir = path.dirname(fileEntry.originalPath);
          fs.mkdirSync(originalDir, { recursive: true });
          fs.renameSync(fullQuarantinePath, fileEntry.originalPath);

          // Mark as recovered in manifest
          fileEntry.recoverable = false;
          fileEntry.recoveredAt = new Date().toISOString();
          saveManifest(folderPath, manifest);

          print(`✅ Recovered: ${fileEntry.fileName}`, 'green');
          print(`   Restored to: ${fileEntry.originalPath}`, 'cyan');
          return true;
        } catch (error) {
          print(`❌ Failed to recover: ${error.message}`, 'red');
          return false;
        }
      }
    }
  }

  print(`❌ File not found in quarantine: ${quarantinePath}`, 'red');
  return false;
}

/**
 * List all quarantined files
 */
function listQuarantined() {
  if (!fs.existsSync(QUARANTINE_BASE)) {
    print('No quarantine folder exists yet.', 'yellow');
    return;
  }

  const folders = fs.readdirSync(QUARANTINE_BASE)
    .filter(folder => folder.match(/\d{4}-\d{2}-\d{2}/))
    .sort();

  if (folders.length === 0) {
    print('No quarantined files found.', 'yellow');
    return;
  }

  print('\n📦 Quarantined Files:\n', 'cyan');

  let totalFiles = 0;
  let totalSize = 0;

  folders.forEach(folder => {
    const folderPath = path.join(QUARANTINE_BASE, folder);
    const manifest = loadManifest(folderPath);

    if (manifest.files.length > 0) {
      print(`\n📅 ${folder} (${manifest.files.length} files)`, 'blue');
      print(`   Retention: ${manifest.retention.days} days (delete after ${manifest.retention.deleteAfter.split('T')[0]})`, 'yellow');

      manifest.files.forEach(file => {
        const status = file.recoverable ? '✅' : '♻️';
        const size = (file.size / 1024).toFixed(2) + 'KB';
        print(`   ${status} ${file.fileName} (${size}) - ${file.reason}`, 'reset');
      });

      totalFiles += manifest.files.length;
      totalSize += manifest.totalSize;
    }
  });

  print(`\n📊 Total: ${totalFiles} files (${(totalSize / 1024 / 1024).toFixed(2)}MB)`, 'cyan');
}

/**
 * Clean up old quarantine folders
 */
function cleanupOldQuarantine() {
  if (!fs.existsSync(QUARANTINE_BASE)) {
    return;
  }

  const now = Date.now();
  const folders = fs.readdirSync(QUARANTINE_BASE)
    .filter(folder => folder.match(/\d{4}-\d{2}-\d{2}/));

  let cleaned = 0;

  folders.forEach(folder => {
    const folderDate = new Date(folder);
    const ageInDays = (now - folderDate.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays > RETENTION_DAYS) {
      const folderPath = path.join(QUARANTINE_BASE, folder);

      // Remove old quarantine folder
      fs.rmSync(folderPath, { recursive: true, force: true });
      cleaned++;

      print(`🗑️  Removed old quarantine: ${folder} (${Math.floor(ageInDays)} days old)`, 'yellow');
    }
  });

  if (cleaned > 0) {
    print(`\n✅ Cleaned up ${cleaned} old quarantine folders`, 'green');
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help') {
    print('\n🛡️  Safe Delete System - Quarantine Instead of Delete\n', 'cyan');
    print('Usage:', 'blue');
    print('  node safe-delete.js quarantine <file> [reason]  - Move file to quarantine');
    print('  node safe-delete.js recover <file>               - Recover file from quarantine');
    print('  node safe-delete.js list                         - List all quarantined files');
    print('  node safe-delete.js cleanup                      - Remove old quarantine folders');
    print('');
    print('Examples:', 'blue');
    print('  node safe-delete.js quarantine old-file.js "Unused for 6 months"');
    print('  node safe-delete.js recover old-file.js');
    print('  node safe-delete.js list');
    print('');
    return;
  }

  switch (command) {
    case 'quarantine':
      const fileToQuarantine = args[1];
      const reason = args[2] || 'Manual cleanup';
      if (!fileToQuarantine) {
        print('❌ Please specify a file to quarantine', 'red');
        return;
      }
      quarantineFile(fileToQuarantine, reason);
      break;

    case 'recover':
      const fileToRecover = args[1];
      if (!fileToRecover) {
        print('❌ Please specify a file to recover', 'red');
        return;
      }
      recoverFile(fileToRecover);
      break;

    case 'list':
      listQuarantined();
      break;

    case 'cleanup':
      cleanupOldQuarantine();
      break;

    default:
      print(`❌ Unknown command: ${command}`, 'red');
      print('Use --help for usage information', 'yellow');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for use in other scripts
module.exports = {
  quarantineFile,
  recoverFile,
  listQuarantined,
  cleanupOldQuarantine
};