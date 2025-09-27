#!/usr/bin/env node

/**
 * @fileoverview Dependency mapping tool to understand all file relationships
 * @description Scans HTML, JS, and CSS files to build a complete dependency graph
 * @author Safety System
 * @version 1.0
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = process.cwd();
const OUTPUT_FILE = 'dependency-map.json';
const GRAPH_FILE = 'dependency-graph.html';

// Patterns to find dependencies
const PATTERNS = {
  // HTML patterns
  html: {
    script: /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi,
    link: /<link\s+[^>]*href=["']([^"']+\.(?:css|js))["'][^>]*>/gi,
    iframe: /<iframe\s+[^>]*src=["']([^"']+)["'][^>]*>/gi,
    img: /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi,
    anchor: /<a\s+[^>]*href=["']([^"'#]+\.html?)["'][^>]*>/gi
  },
  // JavaScript patterns
  js: {
    import: /import\s+.*?from\s+["']([^"']+)["']/g,
    require: /require\s*\(\s*["']([^"']+)["']\s*\)/g,
    dynamicImport: /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    scriptSrc: /\.src\s*=\s*["']([^"']+\.js)["']/g,
    linkHref: /\.href\s*=\s*["']([^"']+\.css)["']/g,
    fetch: /fetch\s*\(\s*["']([^"']+\.(?:js|json|html))["']/g,
    ajax: /\$\.(ajax|get|post|getJSON)\s*\(\s*["']([^"']+)["']/g,
    xmlhttp: /open\s*\(\s*["'][^"']+["'],\s*["']([^"']+)["']/g
  },
  // CSS patterns
  css: {
    import: /@import\s+(?:url\s*\()?\s*["']([^"']+)["']\s*\)?/g,
    url: /url\s*\(\s*["']([^"']+)["']\s*\)/g
  }
};

// File extensions to scan
const FILE_EXTENSIONS = {
  html: ['.html', '.htm'],
  js: ['.js', '.mjs'],
  css: ['.css', '.scss', '.sass']
};

// Folders to ignore
const IGNORE_FOLDERS = [
  'node_modules',
  '.git',
  '_archive',
  '_deprecated',
  '_quarantine',
  'dist',
  'build'
];

class DependencyMapper {
  constructor() {
    this.dependencies = new Map(); // file -> Set of dependencies
    this.reverseDependencies = new Map(); // file -> Set of files that depend on it
    this.fileTypes = new Map(); // file -> type (html, js, css, etc)
    this.errors = [];
    this.stats = {
      filesScanned: 0,
      dependenciesFound: 0,
      orphanedFiles: [],
      circularDependencies: [],
      missingFiles: []
    };
  }

  /**
   * Scan entire project
   */
  async scan() {
    console.log('🔍 Starting dependency scan...\n');

    // Scan all files
    this.scanDirectory(PROJECT_ROOT);

    // Analyze results
    this.analyzeResults();

    // Generate output
    this.saveResults();
    this.generateVisualGraph();

    // Print summary
    this.printSummary();
  }

  /**
   * Recursively scan directory
   */
  scanDirectory(dir) {
    // Skip ignored folders
    const dirName = path.basename(dir);
    if (IGNORE_FOLDERS.includes(dirName)) {
      return;
    }

    try {
      const items = fs.readdirSync(dir);

      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          this.scanDirectory(fullPath);
        } else if (stat.isFile()) {
          this.scanFile(fullPath);
        }
      });
    } catch (error) {
      this.errors.push(`Failed to scan directory ${dir}: ${error.message}`);
    }
  }

  /**
   * Scan a single file for dependencies
   */
  scanFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const relativePath = this.getRelativePath(filePath);

    // Determine file type
    let fileType = null;
    if (FILE_EXTENSIONS.html.includes(ext)) fileType = 'html';
    else if (FILE_EXTENSIONS.js.includes(ext)) fileType = 'js';
    else if (FILE_EXTENSIONS.css.includes(ext)) fileType = 'css';
    else return; // Skip other file types

    this.fileTypes.set(relativePath, fileType);
    this.stats.filesScanned++;

    // Read file content
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      this.errors.push(`Failed to read ${filePath}: ${error.message}`);
      return;
    }

    // Find dependencies based on file type
    const dependencies = new Set();

    switch (fileType) {
      case 'html':
        this.findHtmlDependencies(content, dependencies, filePath);
        break;
      case 'js':
        this.findJsDependencies(content, dependencies, filePath);
        break;
      case 'css':
        this.findCssDependencies(content, dependencies, filePath);
        break;
    }

    // Store dependencies
    if (dependencies.size > 0) {
      this.dependencies.set(relativePath, dependencies);

      // Build reverse dependencies
      dependencies.forEach(dep => {
        if (!this.reverseDependencies.has(dep)) {
          this.reverseDependencies.set(dep, new Set());
        }
        this.reverseDependencies.get(dep).add(relativePath);
      });

      this.stats.dependenciesFound += dependencies.size;
    }
  }

  /**
   * Find dependencies in HTML files
   */
  findHtmlDependencies(content, dependencies, filePath) {
    Object.entries(PATTERNS.html).forEach(([type, pattern]) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const dep = this.normalizePath(match[1], filePath);
        if (dep && !dep.startsWith('http')) {
          dependencies.add(dep);
        }
      }
      pattern.lastIndex = 0; // Reset regex
    });
  }

  /**
   * Find dependencies in JavaScript files
   */
  findJsDependencies(content, dependencies, filePath) {
    Object.entries(PATTERNS.js).forEach(([type, pattern]) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const dep = type === 'ajax' ? match[2] : match[1];
        const normalized = this.normalizePath(dep, filePath);
        if (normalized && !normalized.startsWith('http')) {
          dependencies.add(normalized);
        }
      }
      pattern.lastIndex = 0; // Reset regex
    });
  }

  /**
   * Find dependencies in CSS files
   */
  findCssDependencies(content, dependencies, filePath) {
    Object.entries(PATTERNS.css).forEach(([type, pattern]) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const dep = this.normalizePath(match[1], filePath);
        if (dep && !dep.startsWith('http') && !dep.startsWith('data:')) {
          dependencies.add(dep);
        }
      }
      pattern.lastIndex = 0; // Reset regex
    });
  }

  /**
   * Normalize and resolve path
   */
  normalizePath(depPath, fromFile) {
    if (!depPath) return null;

    // Skip external URLs and data URIs
    if (depPath.startsWith('http') || depPath.startsWith('//') || depPath.startsWith('data:')) {
      return null;
    }

    // Remove query parameters and hash
    depPath = depPath.split('?')[0].split('#')[0];

    // Handle absolute paths
    if (depPath.startsWith('/')) {
      return depPath;
    }

    // Handle relative paths
    const dir = path.dirname(fromFile);
    const resolved = path.resolve(dir, depPath);
    return this.getRelativePath(resolved);
  }

  /**
   * Get relative path from project root
   */
  getRelativePath(absolutePath) {
    const relative = path.relative(PROJECT_ROOT, absolutePath);
    return '/' + relative.replace(/\\/g, '/');
  }

  /**
   * Analyze scan results
   */
  analyzeResults() {
    // Find orphaned files (no dependencies and nothing depends on them)
    this.fileTypes.forEach((type, file) => {
      const hasDependencies = this.dependencies.has(file);
      const hasReverseDependencies = this.reverseDependencies.has(file);

      if (!hasDependencies && !hasReverseDependencies) {
        // Check if it's an entry point
        if (!this.isEntryPoint(file)) {
          this.stats.orphanedFiles.push(file);
        }
      }
    });

    // Check for missing files
    this.dependencies.forEach((deps, file) => {
      deps.forEach(dep => {
        const depPath = path.join(PROJECT_ROOT, dep.substring(1));
        if (!fs.existsSync(depPath)) {
          this.stats.missingFiles.push({
            from: file,
            missing: dep
          });
        }
      });
    });

    // Detect circular dependencies
    this.detectCircularDependencies();
  }

  /**
   * Check if file is likely an entry point
   */
  isEntryPoint(file) {
    const entryPatterns = [
      /^\/index\.html?$/,
      /^\/cart\.html?$/,
      /^\/product\.html?$/,
      /\/dashboard/,
      /\/calculators\//,
      /\/quote-builders\//
    ];

    return entryPatterns.some(pattern => pattern.test(file));
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies() {
    const visited = new Set();
    const stack = new Set();

    const detectCycle = (file, path = []) => {
      if (stack.has(file)) {
        // Found a cycle
        const cycleStart = path.indexOf(file);
        const cycle = path.slice(cycleStart).concat(file);
        this.stats.circularDependencies.push(cycle);
        return;
      }

      if (visited.has(file)) return;

      visited.add(file);
      stack.add(file);

      const deps = this.dependencies.get(file);
      if (deps) {
        deps.forEach(dep => {
          detectCycle(dep, [...path, file]);
        });
      }

      stack.delete(file);
    };

    // Check from each file
    this.fileTypes.forEach((type, file) => {
      if (!visited.has(file)) {
        detectCycle(file);
      }
    });
  }

  /**
   * Save results to JSON
   */
  saveResults() {
    const results = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      dependencies: {},
      reverseDependencies: {},
      fileTypes: {},
      entryPoints: [],
      errors: this.errors
    };

    // Convert Maps to objects
    this.dependencies.forEach((deps, file) => {
      results.dependencies[file] = Array.from(deps);
    });

    this.reverseDependencies.forEach((deps, file) => {
      results.reverseDependencies[file] = Array.from(deps);
    });

    this.fileTypes.forEach((type, file) => {
      results.fileTypes[file] = type;
      if (this.isEntryPoint(file)) {
        results.entryPoints.push(file);
      }
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  }

  /**
   * Generate visual dependency graph (HTML with vis.js)
   */
  generateVisualGraph() {
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();
    let nodeId = 0;

    // Create nodes
    this.fileTypes.forEach((type, file) => {
      const id = nodeId++;
      nodeMap.set(file, id);

      const isOrphaned = this.stats.orphanedFiles.includes(file);
      const isEntryPoint = this.isEntryPoint(file);

      nodes.push({
        id: id,
        label: path.basename(file),
        title: file,
        group: type,
        color: isOrphaned ? '#ff0000' : (isEntryPoint ? '#00ff00' : undefined)
      });
    });

    // Create edges
    this.dependencies.forEach((deps, file) => {
      const fromId = nodeMap.get(file);
      deps.forEach(dep => {
        const toId = nodeMap.get(dep);
        if (fromId !== undefined && toId !== undefined) {
          edges.push({
            from: fromId,
            to: toId
          });
        }
      });
    });

    // Generate HTML
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Dependency Graph - NWCA Pricing System</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/vis-network/9.1.2/dist/vis-network.min.js"></script>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/vis-network/9.1.2/dist/vis-network.min.css" rel="stylesheet">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
    h1 { color: #333; }
    #network { width: 100%; height: 600px; border: 1px solid #ccc; }
    .legend { margin: 20px 0; }
    .legend span { margin-right: 20px; }
    .stats { background: #f5f5f5; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>Dependency Graph - NWCA Pricing System</h1>

  <div class="stats">
    <h3>Statistics</h3>
    <p>Files Scanned: ${this.stats.filesScanned}</p>
    <p>Dependencies Found: ${this.stats.dependenciesFound}</p>
    <p>Orphaned Files: ${this.stats.orphanedFiles.length}</p>
    <p>Missing Files: ${this.stats.missingFiles.length}</p>
    <p>Circular Dependencies: ${this.stats.circularDependencies.length}</p>
  </div>

  <div class="legend">
    <span>🟢 Entry Points</span>
    <span>🔴 Orphaned Files</span>
    <span>🔵 HTML</span>
    <span>🟡 JavaScript</span>
    <span>🟣 CSS</span>
  </div>

  <div id="network"></div>

  <script>
    const nodes = new vis.DataSet(${JSON.stringify(nodes)});
    const edges = new vis.DataSet(${JSON.stringify(edges)});

    const container = document.getElementById('network');
    const data = { nodes: nodes, edges: edges };

    const options = {
      groups: {
        html: { color: '#2196F3' },
        js: { color: '#FFC107' },
        css: { color: '#9C27B0' }
      },
      physics: {
        stabilization: { iterations: 100 },
        barnesHut: { gravitationalConstant: -8000, springConstant: 0.001 }
      },
      edges: {
        arrows: 'to',
        color: { opacity: 0.5 }
      }
    };

    const network = new vis.Network(container, data, options);
  </script>
</body>
</html>`;

    fs.writeFileSync(GRAPH_FILE, html);
  }

  /**
   * Print summary
   */
  printSummary() {
    console.log('\n📊 Dependency Scan Complete\n');
    console.log(`Files Scanned: ${this.stats.filesScanned}`);
    console.log(`Dependencies Found: ${this.stats.dependenciesFound}`);
    console.log(`Orphaned Files: ${this.stats.orphanedFiles.length}`);
    console.log(`Missing Files: ${this.stats.missingFiles.length}`);
    console.log(`Circular Dependencies: ${this.stats.circularDependencies.length}`);

    if (this.stats.orphanedFiles.length > 0) {
      console.log('\n⚠️  Orphaned Files (no dependencies):');
      this.stats.orphanedFiles.slice(0, 10).forEach(file => {
        console.log(`   - ${file}`);
      });
      if (this.stats.orphanedFiles.length > 10) {
        console.log(`   ... and ${this.stats.orphanedFiles.length - 10} more`);
      }
    }

    if (this.stats.missingFiles.length > 0) {
      console.log('\n❌ Missing Files:');
      this.stats.missingFiles.slice(0, 10).forEach(({ from, missing }) => {
        console.log(`   - ${missing} (referenced by ${from})`);
      });
    }

    console.log(`\n✅ Results saved to:`);
    console.log(`   - ${OUTPUT_FILE} (JSON data)`);
    console.log(`   - ${GRAPH_FILE} (Visual graph)`);
  }
}

// Run if called directly
if (require.main === module) {
  const mapper = new DependencyMapper();
  mapper.scan();
}

module.exports = DependencyMapper;