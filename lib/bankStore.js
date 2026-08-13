const fs   = require('fs-extra');
const path = require('path');

const DB = path.join(process.cwd(), 'database/bank.json');

const readDB = () => {
    try { return JSON.parse(fs.readFileSync(DB, 'utf8')); }
    catch { return {}; }
};

const saveDB = (d) => {
    fs.ensureDirSync(path.dirname(DB));
    fs.writeFileSync(DB, JSON.stringify(d, null, 2));
};

function get() {
    return readDB();
}

function set(details) {
    saveDB(details);
}

module.exports = { get, set };
