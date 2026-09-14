'use strict';

// The repository is public. Only authenticated ciphertext belongs in Git;
// FINISH_LINE_ARCHIVE_KEY lives in the server environment, never in an asset.
const crypto = require('node:crypto');
const fs = require('node:fs');
const zlib = require('node:zlib');
const MAGIC = Buffer.from('NWCA-DFL1\n');
const MAX_BYTES = 64 * 1024 * 1024;

function archiveKey(value) {
    if (!/^[a-f\d]{64}$/i.test(String(value || ''))) throw new Error('Finish Line key is not configured');
    return Buffer.from(value, 'hex');
}

function sealArchive(payload, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', archiveKey(key), iv);
    cipher.setAAD(MAGIC);
    const body = zlib.gzipSync(Buffer.from(JSON.stringify(payload)));
    const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
    return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
}

function openArchive(bytes, key) {
    if (!Buffer.isBuffer(bytes) || bytes.length < MAGIC.length + 29 || !bytes.subarray(0, MAGIC.length).equals(MAGIC)) {
        throw new Error('Invalid Finish Line archive');
    }
    const offset = MAGIC.length;
    const decipher = crypto.createDecipheriv('aes-256-gcm', archiveKey(key), bytes.subarray(offset, offset + 12));
    decipher.setAAD(MAGIC);
    decipher.setAuthTag(bytes.subarray(offset + 12, offset + 28));
    const decrypted = Buffer.concat([decipher.update(bytes.subarray(offset + 28)), decipher.final()]);
    const payload = JSON.parse(zlib.gunzipSync(decrypted, { maxOutputLength: MAX_BYTES }).toString('utf8'));
    if (payload.version !== 1 || !payload.files || !payload.primary || !payload.files[payload.primary]) {
        throw new Error('Incomplete Finish Line archive');
    }
    return payload;
}

function safeFileKey(value) {
    return typeof value === 'string' && value.length > 0 && value.length < 700
        && !value.includes('\\') && ![...value].some(char => char.charCodeAt(0) < 32)
        && !value.split('/').some(part => !part || part === '.' || part === '..');
}

function createArchiveStore({ archivePath, key }) {
    let archive;
    function load() {
        if (!archive) archive = openArchive(fs.readFileSync(archivePath), key);
        return archive;
    }
    return {
        catalog() { return load().catalog; },
        file(name) {
            if (!safeFileKey(name)) return null;
            const payload = load();
            const resolved = Object.hasOwn(payload.aliases || {}, name) ? payload.aliases[name] : name;
            if (!Object.hasOwn(payload.files, resolved)) return null;
            const file = payload.files[resolved];
            return { ...file, canonical: resolved, body: Buffer.from(file.body, 'base64') };
        },
    };
}

module.exports = { sealArchive, openArchive, safeFileKey, createArchiveStore };
