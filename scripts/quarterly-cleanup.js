#!/usr/bin/env node
/**
 * Quarterly Documentation Cleanup
 *
 * Generates a cleanup report identifying:
 * - Files not modified in 180+ days
 * - Files with no incoming references
 * - Archive files older than 6 months
 * - Potential duplicate content
 *
 * Usage: npm run quarterly-cleanup
 *
 * This is a READ-ONLY script - it suggests cleanup but doesn't delete anything.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const ARCHIVE_DIR = path.join(DOCS_DIR, 'archive');
const VERY_STALE_DAYS = 180;

// Find all .md files recursively
function findMarkdownFiles(dir, files = []) {
    if (!fs.existsSync(dir)) return files;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            findMarkdownFiles(fullPath, files);
        } else if (entry.name.endsWith('.md')) {
            files.push(fullPath);
        }
    }
    return files;
}

// Get last modified date via git
function getLastModified(filePath) {
    try {
        const result = execSync(`git log -1 --format="%ai" -- "${filePath}"`, {
            encoding: 'utf8',
            cwd: path.join(__dirname, '..'),
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        return result ? new Date(result) : null;
    } catch {
        return fs.existsSync(filePath) ? fs.statSync(filePath).mtime : null;
    }
}

// Simple content hash for duplicate detection
function getContentHash(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .slice(0, 1000); // First 1000 chars normalized
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash) + content.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

// Count incoming references
function countIncomingRefs(targetPath, allFiles) {
    let count = 0;
    const targetName = path.basename(targetPath);
    for (const file of allFiles) {
        if (file === targetPath) continue;
        try {
            const content = fs.readFileSync(file, 'utf8');
            if (content.includes(targetName)) count++;
        } catch { /* skip unreadable */ }
    }
    return count;
}

// Main cleanup analysis
function analyze() {
    console.log('\n🧹 Quarterly Documentation Cleanup Report\n');
    console.log('='.repeat(60));
    console.log(`Generated: ${new Date().toISOString().split('T')[0]}`);
    console.log('='.repeat(60));

    const now = new Date();
    const staleThreshold = new Date(now - VERY_STALE_DAYS * 24 * 60 * 60 * 1000);

    // Gather all files
    const memoryFiles = findMarkdownFiles(MEMORY_DIR);
    const archiveFiles = findMarkdownFiles(ARCHIVE_DIR);
    const allFiles = [...memoryFiles, ...archiveFiles];

    const report = {
        veryStaleFiles: [],
        orphanedFiles: [],
        oldArchives: [],
        potentialDuplicates: []
    };

    console.log(`\n📁 Scanning ${memoryFiles.length} memory files, ${archiveFiles.length} archive files...\n`);

    // Check memory files for staleness and orphans
    for (const file of memoryFiles) {
        const relativePath = path.relative(path.join(__dirname, '..'), file);
        const fileName = path.basename(file);

        // Skip index files
        if (['INDEX.md', 'README.md', 'CROSS_PROJECT_HUB.md', 'GLOSSARY.md'].includes(fileName)) continue;

        const lastMod = getLastModified(file);
        if (lastMod && lastMod < staleThreshold) {
            const daysOld = Math.floor((now - lastMod) / (24 * 60 * 60 * 1000));
            report.veryStaleFiles.push({ path: relativePath, daysOld });
        }

        const refs = countIncomingRefs(file, allFiles);
        if (refs === 0) {
            report.orphanedFiles.push({ path: relativePath, refs });
        }
    }

    // Check archive files for age
    for (const file of archiveFiles) {
        const relativePath = path.relative(path.join(__dirname, '..'), file);
        const lastMod = getLastModified(file);
        if (lastMod && lastMod < staleThreshold) {
            const daysOld = Math.floor((now - lastMod) / (24 * 60 * 60 * 1000));
            report.oldArchives.push({ path: relativePath, daysOld });
        }
    }

    // Check for potential duplicates (same content hash)
    const hashes = new Map();
    for (const file of memoryFiles) {
        try {
            const hash = getContentHash(file);
            const relativePath = path.relative(path.join(__dirname, '..'), file);
            if (hashes.has(hash)) {
                report.potentialDuplicates.push({
                    file1: hashes.get(hash),
                    file2: relativePath
                });
            } else {
                hashes.set(hash, relativePath);
            }
        } catch { /* skip */ }
    }

    // Output report
    if (report.veryStaleFiles.length > 0) {
        console.log(`\n⚠️  VERY STALE FILES (${VERY_STALE_DAYS}+ days without update):`);
        console.log('   Consider reviewing or archiving these:\n');
        report.veryStaleFiles
            .sort((a, b) => b.daysOld - a.daysOld)
            .forEach(f => console.log(`   ${f.daysOld} days: ${f.path}`));
    }

    if (report.orphanedFiles.length > 0) {
        console.log(`\n📭 ORPHANED FILES (no incoming references):`);
        console.log('   These files are not referenced anywhere:\n');
        report.orphanedFiles.forEach(f => console.log(`   ${f.path}`));
    }

    if (report.oldArchives.length > 0) {
        console.log(`\n🗄️  OLD ARCHIVES (${VERY_STALE_DAYS}+ days):`);
        console.log('   Consider permanent deletion:\n');
        report.oldArchives
            .sort((a, b) => b.daysOld - a.daysOld)
            .slice(0, 10)
            .forEach(f => console.log(`   ${f.daysOld} days: ${f.path}`));
        if (report.oldArchives.length > 10) {
            console.log(`   ... and ${report.oldArchives.length - 10} more`);
        }
    }

    if (report.potentialDuplicates.length > 0) {
        console.log(`\n🔄 POTENTIAL DUPLICATES (similar content):`);
        console.log('   Consider consolidating:\n');
        report.potentialDuplicates.forEach(d =>
            console.log(`   ${d.file1}\n   ↔ ${d.file2}\n`));
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`Very stale files:      ${report.veryStaleFiles.length}`);
    console.log(`Orphaned files:        ${report.orphanedFiles.length}`);
    console.log(`Old archives:          ${report.oldArchives.length}`);
    console.log(`Potential duplicates:  ${report.potentialDuplicates.length}`);
    console.log('');

    // Recommendations
    const totalIssues = report.veryStaleFiles.length + report.orphanedFiles.length;
    if (totalIssues > 0) {
        console.log('📋 RECOMMENDED ACTIONS:');
        if (report.veryStaleFiles.length > 0) {
            console.log(`   1. Review ${report.veryStaleFiles.length} stale files - update or archive`);
        }
        if (report.orphanedFiles.length > 0) {
            console.log(`   2. Add ${report.orphanedFiles.length} orphaned files to INDEX.md or archive`);
        }
        if (report.oldArchives.length > 5) {
            console.log(`   3. Delete ${report.oldArchives.length} old archives to free space`);
        }
        if (report.potentialDuplicates.length > 0) {
            console.log(`   4. Review ${report.potentialDuplicates.length} potential duplicates for consolidation`);
        }
        console.log('');
    } else {
        console.log('✅ Documentation is clean! No immediate action needed.\n');
    }

    // Save report
    const reportPath = path.join(__dirname, '..', 'quarterly-cleanup-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Full report saved to: quarterly-cleanup-report.json\n`);
}

// Run
analyze();
