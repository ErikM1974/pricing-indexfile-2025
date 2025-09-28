#!/usr/bin/env node

/**
 * Test script to verify testing feedback banners are working correctly
 * on both embroidery and cap embroidery quote builder pages
 */

const fs = require('fs');
const path = require('path');

// Files to test
const files = [
    'embroidery-quote-builder.html',
    'cap-embroidery-quote-builder.html'
];

console.log('🔍 Testing Feedback Banner Verification\n');
console.log('=' .repeat(50));

let allTestsPassed = true;

files.forEach(file => {
    console.log(`\n📄 Testing: ${file}`);
    console.log('-'.repeat(40));

    const filePath = path.join(__dirname, file);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${file}`);
        allTestsPassed = false;
        return;
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');

    // Tests to run
    const tests = [
        {
            name: 'Banner HTML structure exists',
            check: () => content.includes('<div id="testing-feedback-banner"')
        },
        {
            name: 'Banner has correct class',
            check: () => content.includes('class="testing-feedback-banner"')
        },
        {
            name: 'Contains personalized message for Nika & Taneisha',
            check: () => content.includes('Nika & Taneisha') || content.includes('Nika &amp; Taneisha')
        },
        {
            name: 'Has "What to Check" section',
            check: () => content.includes('What to Check')
        },
        {
            name: 'Has "How to Report" section',
            check: () => content.includes('How to Report')
        },
        {
            name: 'Has "Good Feedback Examples" section',
            check: () => content.includes('Good Feedback Examples')
        },
        {
            name: 'Has dismiss button',
            check: () => content.includes('dismissTestingBanner()')
        },
        {
            name: 'Has localStorage logic for daily reappear',
            check: () => (content.includes('embroideryTestingBannerDismissed') ||
                    content.includes('capEmbroideryTestingBannerDismissed')) &&
                    content.includes('localStorage')
        },
        {
            name: 'Has animation styles',
            check: () => content.includes('slideDown') &&
                    content.includes('@keyframes')
        },
        {
            name: 'Has correct background gradient',
            check: () => content.includes('linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%)')
        },
        {
            name: 'Has Slack messaging instruction',
            check: () => content.includes('Slack') &&
                    content.includes('Erik')
        }
    ];

    // Run tests
    tests.forEach(test => {
        try {
            const passed = test.check();
            if (passed) {
                console.log(`  ✅ ${test.name}`);
            } else {
                console.log(`  ❌ ${test.name}`);
                allTestsPassed = false;
            }
        } catch (error) {
            console.log(`  ❌ ${test.name} - Error: ${error.message}`);
            allTestsPassed = false;
        }
    });
});

console.log('\n' + '='.repeat(50));

// Summary
if (allTestsPassed) {
    console.log('✅ ALL TESTS PASSED! Feedback banners are properly configured.');
    console.log('\n📝 Summary:');
    console.log('  • Both quote builder pages have testing feedback banners');
    console.log('  • Banners include all required sections and functionality');
    console.log('  • Dismiss functionality with localStorage is implemented');
    console.log('  • Banners will reappear daily if dismissed');
    console.log('  • Staff can report issues via Slack to Erik');
} else {
    console.log('❌ SOME TESTS FAILED! Please review the issues above.');
}

console.log('\n🌐 To test in browser:');
console.log('  1. Open http://localhost:3000/embroidery-quote-builder');
console.log('  2. Verify yellow banner appears at top of page');
console.log('  3. Click "Got it!" to dismiss');
console.log('  4. Refresh page - banner should not reappear today');
console.log('  5. Clear localStorage to test reappearance');
console.log('\n  Repeat for: http://localhost:3000/cap-embroidery-quote-builder');