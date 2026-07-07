const fs   = require('fs-extra');
const path = require('path');

const DB = path.join(process.cwd(), 'database/muteusers.json');
const readDB = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveDB = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

/** Mirrors Permission._clean()'s normalization exactly (digits-only + @s.whatsapp.net), without needing a live bot instance. */
function _keyOf(jid) {
    if (!jid) return '';
    const digits = String(jid).replace(/:[0-9]+@/, '@').split('@')[0].replace(/[^0-9]/g, '');
    return digits ? digits + '@s.whatsapp.net' : '';
}

function getMute(target) {
    const db = readDB();
    return db[_keyOf(target)] || null;
}

function setMute(target, data) {
    const db = readDB();
    db[_keyOf(target)] = data;
    saveDB(db);
}

function clearMute(target) {
    const db = readDB();
    delete db[_keyOf(target)];
    saveDB(db);
}

module.exports = { getMute, setMute, clearMute, _keyOf, readDB, saveDB };
