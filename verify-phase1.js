#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Phase 1 Infrastructure Verification\n');
console.log('=' .repeat(50));

const quoteBuilders = [
    { name: 'DTG Quote Builder', file: 'dtg-quote-builder.html', prefix: 'DTG' },
    { name: 'Embroidery Quote Builder', file: 'embroidery-quote-builder.html', prefix: 'EMB' },
    { name: 'Cap Embroidery Quote Builder', file: 'cap-embroidery-quote-builder.html', prefix: 'CAPEMB' },
    { name: 'Screen Print Quote Builder', file: 'screenprint-quote-builder.html', prefix: 'SP' }
];

const features = {
    'Inline Fallback': content => content.includes("if (typeof QuoteBuilderBase === 'undefined')"),
    'Cache Busting': content => content.includes('?v=20250911'),
    'Print Button': content => content.includes('printQuote()') || content.includes('Print Quote'),
    'Copy Button': content => content.includes('copyQuote()') || content.includes('Copy Quote'),
    'Email Button': content => content.includes('emailQuote()') || content.includes('Email Quote'),
    'Taylar Removed': content => !content.includes('taylar@nwcustomapparel.com'),
    'Taneisha Present': content => content.includes('taneisha@nwcustomapparel.com'),
    'Save to Database': content => content.includes('save-to-database') || content.includes('saveToDatabase'),
    'Console Logging': content => content.includes('console.log('),
    'Toast Notifications': content => content.includes('showSuccess') && content.includes('showError'),
    'Loading Overlay': content => content.includes('showLoading'),
    'Professional Print': content => content.includes('NORTHWEST CUSTOM APPAREL'),
    'Phone Formatting': content => content.includes('customer-phone'),
    'Email Validation': content => content.includes('validateEmail')
};

let totalPass = 0;
let totalFail = 0;

quoteBuilders.forEach(builder => {
    console.log(`\n📄 ${builder.name}`);
    console.log('-'.repeat(40));
    
    const filePath = path.join(__dirname, builder.file);
    
    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${builder.file}`);
        return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check correct prefix
    const hasCorrectPrefix = content.includes(`prefix: '${builder.prefix}'`);
    console.log(`${hasCorrectPrefix ? '✅' : '❌'} Correct prefix (${builder.prefix})`);
    
    let passCount = 0;
    let failCount = 0;
    
    Object.entries(features).forEach(([feature, check]) => {
        const passes = check(content);
        console.log(`${passes ? '✅' : '❌'} ${feature}`);
        
        if (passes) {
            passCount++;
            totalPass++;
        } else {
            failCount++;
            totalFail++;
        }
    });
    
    if (hasCorrectPrefix) {
        passCount++;
        totalPass++;
    } else {
        failCount++;
        totalFail++;
    }
    
    const percentage = Math.round((passCount / (passCount + failCount)) * 100);
    const status = percentage === 100 ? '✅ PERFECT' : percentage >= 80 ? '⚠️  GOOD' : '❌ NEEDS WORK';
    
    console.log(`\nScore: ${passCount}/${passCount + failCount} (${percentage}%) - ${status}`);
});

console.log('\n' + '='.repeat(50));
console.log('📊 OVERALL SUMMARY');
console.log('='.repeat(50));
console.log(`Total Features Passed: ${totalPass}`);
console.log(`Total Features Failed: ${totalFail}`);
console.log(`Success Rate: ${Math.round((totalPass / (totalPass + totalFail)) * 100)}%`);

if (totalFail === 0) {
    console.log('\n✅ All Phase 1 features are properly implemented!');
} else {
    console.log('\n⚠️  Some features need attention. Review the results above.');
}

// Check infrastructure files
console.log('\n' + '='.repeat(50));
console.log('🔧 INFRASTRUCTURE FILES');
console.log('='.repeat(50));

const infrastructureFiles = [
    '/shared_components/js/quote-builder-base.js',
    '/shared_components/js/quote-formatter.js',
    '/shared_components/css/quote-builder-common.css',
    '/shared_components/css/quote-print.css'
];

infrastructureFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    const exists = fs.existsSync(fullPath);
    console.log(`${exists ? '✅' : '❌'} ${file} ${exists ? 'exists' : 'NOT FOUND'}`);
    
    if (exists) {
        const stats = fs.statSync(fullPath);
        console.log(`   Size: ${stats.size} bytes | Modified: ${stats.mtime.toLocaleString()}`);
    }
});

console.log('\n💡 TIP: If external files aren\'t loading:');
console.log('   1. Clear browser cache (Ctrl+Shift+F5)');
console.log('   2. Ask Erik to restart the server on port 3000');
console.log('   3. The inline fallbacks will ensure features work anyway!');
console.log('');