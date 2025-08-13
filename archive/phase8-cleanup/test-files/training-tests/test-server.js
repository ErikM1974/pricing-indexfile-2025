const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
    console.log(`Request: ${req.url}`);
    
    // Default to index.html
    let filePath = req.url;
    if (filePath === '/') {
        filePath = '/adriyella-daily-tasks.html';
    }
    
    // Remove query strings
    filePath = filePath.split('?')[0];
    
    // Try to find the file in multiple locations
    let possiblePaths = [];
    
    // If it's a training file, look in current directory
    if (filePath.includes('adriyella-daily-tasks')) {
        possiblePaths.push('.' + filePath);
    }
    // For other files, check parent directory first
    else if (filePath.startsWith('/')) {
        possiblePaths.push('..' + filePath);  // Parent directory
        possiblePaths.push('.' + filePath);   // Current directory
    }
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Try each possible path
    let fileFound = false;
    let fileIndex = 0;
    
    function tryNextFile() {
        if (fileIndex >= possiblePaths.length) {
            res.writeHead(404);
            res.end(`File not found: ${req.url}`);
            return;
        }
        
        const currentPath = possiblePaths[fileIndex];
        fileIndex++;
        
        fs.readFile(currentPath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    tryNextFile(); // Try next path
                } else {
                    res.writeHead(500);
                    res.end('Server error: ' + error.code);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }
    
    tryNextFile();
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`\nAvailable pages:`);
    console.log(`- http://localhost:${PORT}/adriyella-daily-tasks.html (original)`);
    console.log(`- http://localhost:${PORT}/adriyella-daily-tasks-v2.html (updated with fixes)`);
    console.log(`- http://localhost:${PORT}/training-progress-dashboard.html (NEW: Training Progress Dashboard)`);
    console.log(`\nNote: This server now serves files from both the training directory and parent directory.`);
});