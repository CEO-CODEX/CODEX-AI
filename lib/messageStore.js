const fs = require('fs');
const path = require('path');

const ROOT = path.join(process.cwd(), 'database');
const MESSAGE_DB = path.join(ROOT, 'message-store.json');
const MEDIA_DB = path.join(ROOT, 'media-store.json');
const MAX_ENTRIES = 3000;

function read(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}
function write(file, data) {
  fs.mkdirSync(ROOT, { recursive: true });
  const keys = Object.keys(data);
  const trimmed = keys.length > MAX_ENTRIES ? Object.fromEntries(keys.slice(-MAX_ENTRIES).map((key) => [key, data[key]])) : data;
  fs.writeFileSync(file, JSON.stringify(trimmed));
}
function keyOf(messageKey) {
  return `${messageKey?.remoteJid || ''}:${messageKey?.id || ''}`;
}
function saveMessage(message) {
  const key = keyOf(message?.key);
  if (!key || key === ':') return;
  const data = read(MESSAGE_DB);
  data[key] = message;
  write(MESSAGE_DB, data);
}
function getMessage(messageKey) { return read(MESSAGE_DB)[keyOf(messageKey)] || null; }
function saveMedia(messageKey, media) {
  const key = keyOf(messageKey);
  if (!key || key === ':') return;
  const data = read(MEDIA_DB);
  data[key] = media;
  write(MEDIA_DB, data);
}
function getMedia(messageKey) { return read(MEDIA_DB)[keyOf(messageKey)] || null; }
module.exports = { keyOf, saveMessage, getMessage, saveMedia, getMedia };
