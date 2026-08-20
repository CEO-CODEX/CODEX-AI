const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, '..', 'database');
const readJson = (name, fallback = {}) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8')); } catch { return fallback; } };
const writeJson = (name, value) => { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(path.join(dataDir, name), JSON.stringify(value, null, 2)); };
const ensure = (sock, method) => { if (typeof sock[method] !== 'function') throw new Error(`WhatsApp Business method ${method} is unavailable`); };
module.exports = { readJson, writeJson, ensure };
