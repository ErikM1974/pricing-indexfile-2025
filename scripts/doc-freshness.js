#!/usr/bin/env node
/**
 * Documentation Freshness & Health Check
 *
 * Comprehensive doc health assessment:
 * - Staleness report (files not modified in 90+ days)
 * - Cross-file link validation
 * - Missing "Last Updated" metadata
 * - Large file warnings (>1000 lines)
 * - Archive candidates (no incoming references)
 *
 * Usage: npm run doc-freshness
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const STALE_DAYS = 90;
const LARGE_FILE_LINES = 1000;

// Find all .md files recursively
function findMarkdownFiles(dir, files = []) {
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
            cwd: path.dirname(filePath),
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        return result ? new Date(result) : null;
    } catch {
        // File not in git or git not available
        return fs.statSync(filePath).mtime;
    }
}

// Count lines in file
function countLines(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
}

// Check for "Last Updated" metadata
function hasLastUpdated(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return /\*\*Last Updated:\*\*/.test(content) || /Last Updated:/.test(content);
}

// Extract all markdown links from content
function extractLinks(content) {
    const linkPattern = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
    const links = [];
    let match;
    while ((match = linkPattern.exec(content)) !== null) {
        if (!match[2].startsWith('http')) {
            links.push(match[2]);
        }
    }
    return links;
}

// Count incoming references to a file
function countIncomingRefs(targetPath, allFiles) {
    let count = 0;
    const targetName = path.basename(targetPath);

    for (const file of allFiles) {
        if (file === targetPath) continue;
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes(targetName)) {
            count++;
        }
    }
    return count;
}

// Main analysis
function analyze() {
    console.log('\n📊 Documentation Freshness Report\n');
    console.log('='.repeat(60));
    console.log(`Generated: ${new Date().toISOString().split('T')[0]}`);
    console.log('='.repeat(60));

    const allFiles = findMarkdownFiles(MEMORY_DIR);
    const now = new Date();
    const staleThreshold = new Date(now - STALE_DAYS * 24 * 60 * 60 * 1000);

    const report = {
        totalFiles: allFiles.length,
        staleFiles: [],
        largeFiles: [],
        missingMetadata: [],
        brokenLinks: [],
        archiveCandidates: [],
        healthScore: 100
    };

    console.log(`\n📁 Analyzing ${allFiles.length} markdown files...\n`);

    // Analyze each file
    for (const file of allFiles) {
        const relativePath = path.relative(MEMORY_DIR, file);
        const fileName = path.basename(file);

        // Skip README files
        if (fileName === 'README.md' || fileName === 'INDEX.md') continue;

        // Check staleness
        const lastMod = getLastModified(file);
        if (lastMod && lastMod < staleThreshold) {
            const daysOld = Math.floor((now - lastMod) / (24 * 60 * 60 * 1000));
            report.staleFiles.push({ path: relativePath, daysOld, lastMod });
        }

        // Check file size
        const lines = countLines(file);
        if (lines > LARGE_FILE_LINES) {
            report.largeFiles.push({ path: relativePath, lines });
        }

        // Check metadata
        if (!hasLastUpdated(file)) {
            report.missingMetadata.push(relativePath);
        }

        // Check for broken links
        const content = fs.readFileSync(file, 'utf8');
        const links = extractLinks(content);
        for (const link of links) {
            const resolved = path.resolve(path.dirname(file), link);
            if (!fs.existsSync(resolved)) {
                report.brokenLinks.push({ source: relativePath, target: link });
            }
        }

        // Check incoming references
        const incomingRefs = countIncomingRefs(file, allFiles);
        if (incomingRefs === 0 && fileName !== 'CROSS_PROJECT_HUB.md' && fileName !== 'GLOSSARY.md') {
            report.archiveCandidates.push({ path: relativePath, refs: incomingRefs });
        }
    }

    // Calculate health score
    const issues = report.staleFiles.length + report.brokenLinks.length +
                   Math.floor(report.missingMetadata.length / 5);
    report.healthScore = Math.max(0, 100 - issues * 5);

    // Output report
    console.log('─'.repeat(60));
    console.log(`HEALTH SCORE: ${report.healthScore}/100`);
    console.log('─'.repeat(60));

    if (report.staleFiles.length > 0) {
        console.log(`\n⏰ STALE FILES (not modified in ${STALE_DAYS}+ days): ${report.staleFiles.length}`);
        report.staleFiles
            .sort((a, b) => b.daysOld - a.daysOld)
            .slice(0, 10)
            .forEach(f => console.log(`   ${f.daysOld} days: memory/${f.path}`));
        if (report.staleFiles.length > 10) {
            console.log(`   ... and ${report.staleFiles.length - 10} more`);
        }
    }

    if (report.largeFiles.length > 0) {
        console.log(`\n📏 LARGE FILES (>${LARGE_FILE_LINES} lines): ${report.largeFiles.length}`);
        report.largeFiles
            .sort((a, b) => b.lines - a.lines)
            .forEach(f => console.log(`   ${f.lines} lines: memory/${f.path}`));
    }

    if (report.brokenLinks.length > 0) {
        console.log(`\n🔗 BROKEN LINKS: ${report.brokenLinks.length}`);
        report.brokenLinks.slice(0, 5).forEach(l =>
            console.log(`   ${l.source} → ${l.target} (not found)`));
    }

    if (report.missingMetadata.length > 0) {
        console.log(`\n📝 MISSING "Last Updated": ${report.missingMetadata.length} files`);
        console.log('   (Run with --verbose to see list)');
    }

    if (report.archiveCandidates.length > 0) {
        console.log(`\n📦 ARCHIVE CANDIDATES (no incoming refs): ${report.archiveCandidates.length}`);
        report.archiveCandidates.slice(0, 5).forEach(f =>
            console.log(`   memory/${f.path}`));
        if (report.archiveCandidates.length > 5) {
            console.log(`   ... and ${report.archiveCandidates.length - 5} more`);
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total files:        ${report.totalFiles}`);
    console.log(`Stale files:        ${report.staleFiles.length}`);
    console.log(`Large files:        ${report.largeFiles.length}`);
    console.log(`Broken links:       ${report.brokenLinks.length}`);
    console.log(`Missing metadata:   ${report.missingMetadata.length}`);
    console.log(`Archive candidates: ${report.archiveCandidates.length}`);
    console.log(`Health score:       ${report.healthScore}/100`);
    console.log('');

    // Save JSON report
    const reportPath = path.join(__dirname, '..', 'doc-health-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Full report saved to: doc-health-report.json\n`);

    return report.healthScore >= 70 ? 0 : 1;
}

// Run
const exitCode = analyze();
process.exit(exitCode);
