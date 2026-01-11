#!/usr/bin/env node
/**
 * Memory Documentation Validation Script
 *
 * Validates documentation linking using a tiered approach:
 * - Root-level files: Must be linked in INDEX.md
 * - Subdirectory files: Must be linked in their subdirectory README.md OR INDEX.md
 * - Subdirectories: Must be mentioned in INDEX.md Directory Map
 *
 * Usage: npm run validate-docs
 * Exit codes: 0 = valid, 1 = errors found
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const INDEX_PATH = path.join(MEMORY_DIR, 'INDEX.md');
const CLAUDE_PATH = path.join(__dirname, '..', 'CLAUDE.md');

// Files that don't need to be linked anywhere
const EXCLUDED_FILENAMES = [
    'INDEX.md',
    'README.md',
];

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

// Extract markdown links from content (returns relative paths as found)
function extractLinkPaths(content) {
    const linkPattern = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
    const links = [];
    let match;

    while ((match = linkPattern.exec(content)) !== null) {
        const linkPath = match[2];
        if (!linkPath.startsWith('http')) {
            links.push(linkPath);
        }
    }
    return links;
}

// Check if a filename appears in content (for simple mentions)
function fileIsMentioned(content, filename) {
    return content.includes(filename);
}

// Main validation
function validate() {
    console.log('\n📚 Memory Documentation Validator\n');
    console.log('='.repeat(50));

    let hasErrors = false;
    const orphaned = [];
    const deadLinks = [];

    // 1. Find all memory files
    const allMemoryFiles = findMarkdownFiles(MEMORY_DIR);
    console.log(`\n📁 Found ${allMemoryFiles.length} markdown files in memory/\n`);

    // 2. Read INDEX.md
    if (!fs.existsSync(INDEX_PATH)) {
        console.error('❌ INDEX.md not found!');
        process.exit(1);
    }
    const indexContent = fs.readFileSync(INDEX_PATH, 'utf8');
    const indexLinks = extractLinkPaths(indexContent);

    // Build set of files linked from INDEX.md (resolved to absolute paths)
    const linkedFromIndex = new Set();
    for (const link of indexLinks) {
        const resolved = path.resolve(MEMORY_DIR, link);
        linkedFromIndex.add(path.normalize(resolved));
    }

    // 3. Build map of subdirectory README content
    const subdirReadmes = new Map();
    const subdirs = fs.readdirSync(MEMORY_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    for (const subdir of subdirs) {
        const readmePath = path.join(MEMORY_DIR, subdir, 'README.md');
        if (fs.existsSync(readmePath)) {
            const content = fs.readFileSync(readmePath, 'utf8');
            subdirReadmes.set(subdir, {
                content,
                links: extractLinkPaths(content)
            });
        }
    }

    // 4. Check each memory file
    for (const file of allMemoryFiles) {
        const relativePath = path.relative(MEMORY_DIR, file);
        const fileName = path.basename(file);
        const dirName = path.dirname(relativePath);
        const isRootLevel = dirName === '.';

        // Skip excluded files
        if (EXCLUDED_FILENAMES.includes(fileName)) continue;

        // Check if file is linked/documented
        let isLinked = false;

        // Check 1: Linked directly from INDEX.md
        if (linkedFromIndex.has(path.normalize(file))) {
            isLinked = true;
        }

        // Check 2: File appears in INDEX.md Directory Map (tree notation like "├── FILE.md")
        if (!isLinked && isRootLevel) {
            // Match tree notation: "├── FILENAME.md" or "└── FILENAME.md" or just "FILENAME.md"
            if (indexContent.includes(`├── ${fileName}`) ||
                indexContent.includes(`└── ${fileName}`) ||
                indexContent.includes(`│   ├── ${fileName}`) ||
                indexContent.includes(`│   └── ${fileName}`)) {
                isLinked = true;
            }
        }

        // Check 3: For subdirectory files, check if linked from subdirectory README
        if (!isLinked && !isRootLevel) {
            const topDir = relativePath.split(path.sep)[0];
            const readme = subdirReadmes.get(topDir);
            if (readme) {
                // Check if filename or relative path is mentioned
                if (fileIsMentioned(readme.content, fileName)) {
                    isLinked = true;
                }
                // Also check resolved links
                for (const link of readme.links) {
                    const resolved = path.resolve(MEMORY_DIR, topDir, link);
                    if (path.normalize(resolved) === path.normalize(file)) {
                        isLinked = true;
                        break;
                    }
                }
            }
        }

        // Check 4: For subdirectory files, check if the subdirectory is mentioned in INDEX
        if (!isLinked && !isRootLevel) {
            const topDir = relativePath.split(path.sep)[0];
            // If subdirectory is mentioned in INDEX.md Directory Map, consider sub-files covered
            if (indexContent.includes(`/${topDir}/`) || indexContent.includes(`├── /${topDir}/`)) {
                isLinked = true;
            }
        }

        if (!isLinked) {
            orphaned.push(relativePath);
        }
    }

    // 5. Check for dead links in INDEX.md
    for (const link of indexLinks) {
        const resolved = path.resolve(MEMORY_DIR, link);
        if (!fs.existsSync(resolved)) {
            deadLinks.push(link);
        }
    }

    // 6. Report orphaned files
    if (orphaned.length > 0) {
        hasErrors = true;
        console.log('⚠️  ORPHANED FILES (not discoverable):');
        console.log('   These files are not linked in INDEX.md or their subdirectory README:\n');
        orphaned.forEach(f => console.log(`   - memory/${f}`));
        console.log('');
    }

    // 7. Report dead links
    if (deadLinks.length > 0) {
        hasErrors = true;
        console.log('❌ DEAD LINKS (in INDEX.md but file not found):');
        deadLinks.forEach(f => console.log(`   - ${f}`));
        console.log('');
    }

    // 8. Check CLAUDE.md critical links
    if (fs.existsSync(CLAUDE_PATH)) {
        const claudeContent = fs.readFileSync(CLAUDE_PATH, 'utf8');
        const claudeLinks = extractLinkPaths(claudeContent);
        const deadClaudeLinks = [];

        for (const link of claudeLinks) {
            // Handle both /memory/ and ./memory/ style paths
            let resolved;
            if (link.startsWith('/memory/')) {
                resolved = path.join(__dirname, '..', link);
            } else {
                resolved = path.resolve(path.dirname(CLAUDE_PATH), link);
            }
            if (!fs.existsSync(resolved)) {
                deadClaudeLinks.push(link);
            }
        }

        if (deadClaudeLinks.length > 0) {
            hasErrors = true;
            console.log('❌ DEAD LINKS in CLAUDE.md:');
            deadClaudeLinks.forEach(f => console.log(`   - ${f}`));
            console.log('');
        }
    }

    // 9. Summary
    console.log('='.repeat(50));
    if (hasErrors) {
        console.log('\n❌ VALIDATION FAILED\n');
        console.log('To fix:');
        if (orphaned.length > 0) {
            console.log('  • Root files → Add to memory/INDEX.md');
            console.log('  • Subdirectory files → Add to subdirectory README.md');
        }
        if (deadLinks.length > 0) {
            console.log('  • Remove or update dead links');
        }
        console.log('');
        process.exit(1);
    } else {
        console.log('\n✅ ALL DOCUMENTATION PROPERLY LINKED\n');
        console.log(`   ${allMemoryFiles.length} memory files`);
        console.log(`   ${subdirs.length} subdirectories`);
        console.log(`   ${indexLinks.length} links in INDEX.md`);
        console.log('');
        process.exit(0);
    }
}

// Run
validate();
