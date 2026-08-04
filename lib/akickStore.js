const fs   = require('fs-extra');
const path = require('path');

const DB = path.join(process.cwd(), 'database/autokick.json');
const readDB = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveDB = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

/** Mirrors muteStore.js's _keyOf exactly — digits-only + @s.whatsapp.net. */
function _keyOf(jid) {
    if (!jid) return '';
    const digits = String(jid).replace(/:[0-9]+@/, '@').split('@')[0].replace(/[^0-9]/g, '');
    return digits ? digits + '@s.whatsapp.net' : '';
}

function add(groupId, target) {
    const db = readDB();
    if (!db[groupId]) db[groupId] = [];
    const key = _keyOf(target);
    if (!db[groupId].includes(key)) db[groupId].push(key);
    saveDB(db);
}

function remove(groupId, target) {
    const db = readDB();
    if (!db[groupId]) return false;
    const key = _keyOf(target);
    const before = db[groupId].length;
    db[groupId] = db[groupId].filter(j => j !== key);
    saveDB(db);
    return db[groupId].length !== before;
}

function clear(groupId) {
    const db = readDB();
    delete db[groupId];
    saveDB(db);
}

function list(groupId) {
    const db = readDB();
    return db[groupId] || [];
}

function isListed(groupId, target) {
    const db = readDB();
    return (db[groupId] || []).includes(_keyOf(target));
}

module.exports = { add, remove, clear, list, isListed, _keyOf };
      
