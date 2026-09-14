'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { sealArchive, openArchive } = require('../../lib/december-finish-line');

const [inputPath, keyPath, outputPath] = process.argv.slice(2);
if (!inputPath || !keyPath || !outputPath) throw new Error('Usage: node seal-package.js PRIVATE_JSON PRIVATE_KEY OUTPUT_ENC');
const root = path.resolve(__dirname, '../..');
for (const file of [inputPath, keyPath]) {
    const relative = path.relative(root, path.resolve(file));
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) throw new Error('Plaintext and key must stay outside the checkout');
}
fs.mkdirSync(path.dirname(keyPath), { recursive: true });
if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath, crypto.randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
const key = fs.readFileSync(keyPath, 'utf8').trim();
const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const sealed = sealArchive(payload, key);
const reopened = openArchive(sealed, key);
if (JSON.stringify(reopened) !== JSON.stringify(payload)) throw new Error('Archive verification failed');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, sealed);
process.stdout.write(JSON.stringify({ encryptedBytes: sealed.length, files: Object.keys(payload.files).length, verified: true }) + '\n');
