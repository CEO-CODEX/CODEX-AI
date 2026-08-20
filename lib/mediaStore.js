// lib/mediaStore.js
//
// A real file-backed store for recoverable media.
//
// Why this exists: the old anti-delete media recovery only kept the
// message's mediaKey/URL metadata and tried to re-download the file
// from WhatsApp's CDN at the moment of deletion. In practice that
// download very often fails, because WhatsApp frequently invalidates
// a media URL as soon as (or shortly after) the message is revoked —
// so by the time anti-delete tries to fetch it, it's already gone.
//
// This store instead downloads the actual decrypted bytes as soon as
// the media is received (while it's still guaranteed to be available)
// and writes them to disk under database/media-store/. When a message
// is later deleted, anti-delete can just read the file straight off
// disk — no dependency on the media still being reachable on WhatsApp's
// servers.
const fs = require('fs');
const path = require('path');

const DIR = path.join(process.cwd(), 'database', 'media-store');
const INDEX_FILE = path.join(process.cwd(), 'database', 'media-store-index.json');

// Cap how many files we keep on disk so this can't grow unbounded.
// Oldest entries are pruned first.
const MAX_FILES = 300;

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

function readIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeIndex(idx) {
  ensureDir();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(idx));
}

function keyOf(msgKey) {
  return `${msgKey?.remoteJid || ''}:${msgKey?.id || ''}`;
}

function safeFileName(key, mimetype) {
  const clean = key.replace(/[^a-zA-Z0-9:_-]/g, '_');
  const part = (mimetype || '').split(';')[0].split('/')[1];
  const ext = (part || 'bin').replace(/[^a-z0-9]/gi, '') || 'bin';
  return `${clean}.${ext}`;
}

function prune(idx) {
  const keys = Object.keys(idx);
  if (keys.length <= MAX_FILES) return;
  const sorted = keys.sort((a, b) => (idx[a].ts || 0) - (idx[b].ts || 0));
  const toRemove = sorted.slice(0, keys.length - MAX_FILES);
  for (const k of toRemove) {
    try { fs.unlinkSync(path.join(DIR, idx[k].file)); } catch {}
    delete idx[k];
  }
}

// Save a decrypted media buffer, keyed by the message's own key.
// meta: { type, mimetype, fileName, ptt }
function save(msgKey, buffer, meta = {}) {
  const key = keyOf(msgKey);
  if (!key || key === ':' || !buffer || !buffer.length) return null;
  ensureDir();
  const file = safeFileName(key, meta.mimetype);
  const filePath = path.join(DIR, file);
  try {
    fs.writeFileSync(filePath, buffer);
  } catch (e) {
    console.error('[MEDIA-STORE] write error:', e.message);
    return null;
  }

  const idx = readIndex();
  idx[key] = { file, type: meta.type, mimetype: meta.mimetype, fileName: meta.fileName, ptt: !!meta.ptt, ts: Date.now() };
  prune(idx);
  writeIndex(idx);
  return filePath;
}

// Read back a stored media buffer for a message key. Returns
// { buffer, type, mimetype, fileName, ptt } or null if nothing is stored.
function get(msgKey) {
  const key = keyOf(msgKey);
  if (!key || key === ':') return null;
  const idx = readIndex();
  const entry = idx[key];
  if (!entry) return null;
  try {
    const buffer = fs.readFileSync(path.join(DIR, entry.file));
    return { buffer, type: entry.type, mimetype: entry.mimetype, fileName: entry.fileName, ptt: entry.ptt };
  } catch {
    return null;
  }
}

function remove(msgKey) {
  const key = keyOf(msgKey);
  if (!key || key === ':') return;
  const idx = readIndex();
  const entry = idx[key];
  if (!entry) return;
  try { fs.unlinkSync(path.join(DIR, entry.file)); } catch {}
  delete idx[key];
  writeIndex(idx);
}

module.exports = { save, get, remove, keyOf };
  
