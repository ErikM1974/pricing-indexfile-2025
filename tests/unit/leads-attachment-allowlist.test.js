/**
 * @jest-environment jsdom
 *
 * Regression lock for the 2026-07-19 stored-link-injection fix (Leads CRM).
 *
 * Lead fields — including payload.artworkUrls and _source.url — come from the
 * PUBLIC POST /api/form-submissions, so an attacker can inject any https:// URL.
 * collectAttachments() previously ran artworkUrls through a scheme-only check
 * (safeHttpUrl), so an arbitrary host rendered as a tracking-beacon <img>; the
 * "View in JotForm" link (_source.url) had the same hole. Attachments must be
 * restricted to our proxy files + JotForm uploads; the source link to jotform.com.
 */
// leads-common.js is an IIFE that reads a global DashPage — stub it before load.
global.DashPage = { apiUrl: function (p) { return 'https://proxy.example.com' + p; } };
require('../../dashboards/js/leads-common.js');
const L = window.LeadsCommon;

describe('isAllowedAttachmentUrl — host allowlist (not just scheme)', () => {
    test('accepts our proxy files host', () => {
        expect(L.isAllowedAttachmentUrl('https://proxy.example.com/api/files/abc123')).toBe(true);
    });
    test('accepts JotForm upload hosts', () => {
        expect(L.isAllowedAttachmentUrl('https://www.jotform.com/uploads/user/x.png')).toBe(true);
        expect(L.isAllowedAttachmentUrl('https://files.jotform.com/y.jpg')).toBe(true);
    });
    test('REJECTS an arbitrary https host (the injection vector)', () => {
        expect(L.isAllowedAttachmentUrl('https://evil.example/beacon.png')).toBe(false);
    });
    test('REJECTS a look-alike that only embeds the allowed host in the path', () => {
        expect(L.isAllowedAttachmentUrl('https://evil.example/https://www.jotform.com/uploads/x.png')).toBe(false);
        expect(L.isAllowedAttachmentUrl('https://evil.example/proxy.example.com/api/files/x')).toBe(false);
    });
    test('REJECTS non-string / non-https', () => {
        expect(L.isAllowedAttachmentUrl('http://proxy.example.com/api/files/x')).toBe(false);
        expect(L.isAllowedAttachmentUrl(null)).toBe(false);
    });
});

describe('safeSourceUrl — jotform.com only', () => {
    test('accepts jotform.com submission links', () => {
        expect(L.safeSourceUrl('https://www.jotform.com/submission/123')).toBe('https://www.jotform.com/submission/123');
        expect(L.safeSourceUrl('https://jotform.com/edit/456')).toBe('https://jotform.com/edit/456');
    });
    test('REJECTS an arbitrary host (phishing link)', () => {
        expect(L.safeSourceUrl('https://evil.example/phish')).toBe('');
    });
    test('REJECTS a host that only contains jotform.com in the path', () => {
        expect(L.safeSourceUrl('https://evil.com/jotform.com')).toBe('');
    });
    test('REJECTS http / garbage', () => {
        expect(L.safeSourceUrl('http://www.jotform.com/x')).toBe('');
        expect(L.safeSourceUrl('not a url')).toBe('');
    });
});

describe('csvCell — RFC-4180 quoting + Excel formula-injection hardening', () => {
    test('plain values pass through unquoted', () => {
        expect(L.csvCell('Acme Co')).toBe('Acme Co');
        expect(L.csvCell(2500)).toBe('2500');
        expect(L.csvCell(null)).toBe('');
    });
    test('quotes/commas/newlines are RFC-4180 quoted', () => {
        expect(L.csvCell('a,b')).toBe('"a,b"');
        expect(L.csvCell('she said "hi"')).toBe('"she said ""hi"""');
        expect(L.csvCell('line1\nline2')).toBe('"line1\nline2"');
    });
    test('formula-lead-in cells are apostrophe-prefixed (=+-@)', () => {
        expect(L.csvCell('=1+1')).toBe("'=1+1");
        expect(L.csvCell('+1-800-EVIL')).toBe("'+1-800-EVIL");
        expect(L.csvCell('-2+3')).toBe("'-2+3");
        expect(L.csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    });
    test('a formula cell that ALSO contains quotes/commas gets both (prefix then RFC-4180 quote)', () => {
        expect(L.csvCell('=cmd,arg')).toBe('"\'=cmd,arg"');
        // A malicious HYPERLINK: apostrophe-prefixed, then quotes force quoting + doubling.
        expect(L.csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    });
});

describe('collectAttachments — filters injected artworkUrls', () => {
    test('keeps only allowlisted hosts, drops the injected beacon', () => {
        const atts = L.collectAttachments({
            artworkUrls: [
                'https://evil.example/beacon.png',                 // injected — must be dropped
                'https://proxy.example.com/api/files/legit',       // ours — kept
                'https://www.jotform.com/uploads/user/real.png',   // jotform — kept
            ],
        });
        const urls = atts.map(function (a) { return a.url; });
        expect(urls).toEqual([
            'https://proxy.example.com/api/files/legit',
            'https://www.jotform.com/uploads/user/real.png',
        ]);
        expect(urls).not.toContain('https://evil.example/beacon.png');
    });
});
