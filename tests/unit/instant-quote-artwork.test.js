// Invariants for the shared artwork step on /custom-stickers and /custom-banners.
//
// The rule this file exists to protect: ARTWORK IS ALWAYS OPTIONAL. Every
// rejection path has to leave the customer able to finish their quote request,
// and has to SAY so — a message that only reports a technical failure is a
// customer who thinks they're stuck and leaves.

const A = require('../../pages/js/instant-quote-artwork');

const file = (name, size, type) => ({ name, size, type: type || '' });
const MB = 1024 * 1024;

describe('accepted formats', () => {
  test('everything a sticker or banner customer actually sends', () => {
    ['logo.png', 'photo.JPG', 'art.jpeg', 'mark.svg', 'scan.tif', 'scan.tiff',
     'proof.pdf', 'layers.psd', 'vector.ai', 'vector.eps', 'old.ps', 'anim.gif', 'shot.webp']
      .forEach(n => expect(A.validate(file(n, 2 * MB)).ok).toBe(true));
  });

  test('extension matching is case-insensitive', () => {
    expect(A.validate(file('LOGO.PNG', 1000)).ok).toBe(true);
    expect(A.validate(file('Vector.AI', 1000)).ok).toBe(true);
  });

  test('the accept attribute covers both mime types and extensions', () => {
    // Some OSes match on one, some on the other; offering only mimes hides
    // .ai/.eps in the file picker on Windows.
    expect(A.ACCEPT_ATTR).toContain('application/pdf');
    expect(A.ACCEPT_ATTR).toContain('.ai');
    expect(A.ACCEPT_ATTR).toContain('.eps');
    expect(A.ACCEPT_ATTR).toContain('image/tiff');
  });
});

describe('rejections always tell the customer they are still fine', () => {
  test('a file over 20 MB', () => {
    const r = A.validate(file('huge.pdf', 21 * MB));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('too_big');
    expect(r.message).toMatch(/still goes through/i);
    expect(r.message).toMatch(/sales@nwcustomapparel\.com/);
  });

  test('a file type we cannot read', () => {
    const r = A.validate(file('brief.docx', 1000));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('type');
    expect(r.message).toMatch(/sales@nwcustomapparel\.com/);
  });

  test('an empty file', () => {
    const r = A.validate(file('empty.png', 0));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('empty');
  });

  test('🔴 EVERY rejection message names a way to still get a quote', () => {
    ['huge.pdf', 'brief.docx', 'sheet.xlsx', 'archive.zip', 'app.exe', 'noext']
      .forEach(n => {
        const r = A.validate(file(n, n === 'huge.pdf' ? 21 * MB : 1000));
        if (!r.ok && r.reason !== 'none') {
          expect(r.message).toMatch(/sales@nwcustomapparel\.com|still goes through/i);
        }
      });
  });

  test('executables and archives are refused', () => {
    ['virus.exe', 'bundle.zip', 'script.js', 'page.html', 'data.csv']
      .forEach(n => expect(A.validate(file(n, 1000)).ok).toBe(false));
  });

  test('a file with no extension is refused rather than guessed at', () => {
    expect(A.validate(file('artwork', 1000)).ok).toBe(false);
  });

  test('no file at all is not an error state', () => {
    // Skipping is a normal, supported choice — it must not render as a failure.
    const r = A.validate(null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('none');
    expect(r.message).toBe('');
  });
});

describe('limits match the server', () => {
  test('20 MB, the same number multer enforces', () => {
    expect(A.MAX_BYTES).toBe(20 * 1024 * 1024);
    expect(A.validate(file('ok.pdf', 20 * MB)).ok).toBe(true);
    expect(A.validate(file('over.pdf', 20 * MB + 1)).ok).toBe(false);
  });

  test('the client list is a subset of what the server accepts', () => {
    // The server also allows embroidery formats (.dst/.emb/...) that a sticker
    // customer has no reason to send. Offering fewer here is fine; offering MORE
    // would mean a file that passes in the browser and 415s on upload.
    const serverExts = ['png','jpg','jpeg','gif','webp','svg','svgz','tif','tiff',
                        'pdf','psd','ai','eps','ps','dst','emb','dsb','exp','pxf','u01'];
    A.ACCEPT_EXT.forEach(e => expect(serverExts).toContain(e));
  });
});

describe('helpers', () => {
  test('extensionOf', () => {
    expect(A.extensionOf('a/b/c.PNG')).toBe('png');
    expect(A.extensionOf('no-dot')).toBe('');
    expect(A.extensionOf('archive.tar.gz')).toBe('gz');
    expect(A.extensionOf(null)).toBe('');
  });

  test('formatBytes reads like a human wrote it', () => {
    expect(A.formatBytes(2048)).toBe('2 KB');
    expect(A.formatBytes(5 * MB)).toBe('5.0 MB');
    expect(A.formatBytes(0)).toBe('');
  });
});

describe('thumbnail preview', () => {
  test('formats a browser can paint get a real preview', () => {
    ['logo.png', 'photo.JPG', 'art.jpeg', 'anim.gif', 'shot.webp', 'mark.svg']
      .forEach(n => expect(A.isPreviewable(n)).toBe(true));
  });

  test('formats it cannot paint fall back to a badge, not a broken image', () => {
    // A broken <img> reads as "your upload failed". Naming the format is honest.
    ['proof.pdf', 'layers.psd', 'vector.ai', 'vector.eps', 'scan.tif']
      .forEach(n => expect(A.isPreviewable(n)).toBe(false));
  });

  test('the badge names the actual format', () => {
    expect(A.badgeFor('proof.pdf')).toBe('PDF');
    expect(A.badgeFor('vector.AI')).toBe('AI');
    expect(A.badgeFor('layers.psd')).toBe('PSD');
    expect(A.badgeFor('noextension')).toBe('FILE');
  });

  test('everything previewable is also an accepted upload', () => {
    // A preview for a file we would then reject would be a lie.
    A.PREVIEWABLE.forEach(e => expect(A.ACCEPT_EXT).toContain(e));
  });
});
