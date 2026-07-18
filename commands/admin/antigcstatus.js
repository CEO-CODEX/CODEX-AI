const fs = require('fs-extra');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../database/antigcstatus.json');

function loadDB() {
    try {
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {}
    return {};
}

function saveDB(db) {
    fs.ensureDirSync(path.dirname(DB_PATH));
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

module.exports = {
    name: 'antigcstatus',
    alias: ['agcs', 'antistatusmention'],
    desc: 'Block group status mentions from the group',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,

    execute: async (sock, m, { text, reply }) => {
        const db = loadDB();
        const groupId = m.chat;
        if (!db[groupId]) db[groupId] = { enabled: false, action: 'warn', autoDelete: true };

        const sub = (text || '').split(' ')[0]?.toLowerCase();
        const args = (text || '').split(' ').slice(1).join(' ').trim();

        // .antigcstatus  — show status
        if (!sub) {
            const status = db[groupId].enabled ? 'ON' : 'OFF';
            const action = db[groupId].action || 'warn';
            const autoDelete = db[groupId].autoDelete ? 'YES' : 'NO';
            return reply(
                `╭─❍ *ANTI-GC-STATUS* 𓉤\n` +
                `│ Status     : *${status}*\n` +
                `│ Action     : *${action.toUpperCase()}*\n` +
                `│ Auto-Delete: *${autoDelete}*\n` +
                `│ Warnings   : 3\n` +
                `│\n` +
                `│ Commands:\n` +
                `│ .antigcstatus on\n` +
                `│ .antigcstatus off\n` +
                `│ .antigcstatus action delete|warn|kick\n` +
                `│ .antigcstatus autodelete on|off\n` +
                `╰────────────────`
            );
        }

        // .antigcstatus on
        if (sub === 'on') {
            db[groupId].enabled = true;
            saveDB(db);
            return reply('`—͟͟͞͞𖣘 Anti-GC-Status ENABLED`');
        }

        // .antigcstatus off
        if (sub === 'off') {
            db[groupId].enabled = false;
            saveDB(db);
            return reply('`—͟͟͞͞𖣘 Anti-GC-Status DISABLED`');
        }

        // .antigcstatus action delete|warn|kick
        if (sub === 'action') {
            const newAction = args.toLowerCase();
            if (!['delete', 'warn', 'kick'].includes(newAction)) {
                return reply('`✘ Action must be: delete, warn, or kick`');
            }
            db[groupId].action = newAction;
            saveDB(db);
            return reply(`\`—͟͟͞͞𖣘 Action set to: ${newAction.toUpperCase()}\``);
        }

        // .antigcstatus autodelete on|off
        if (sub === 'autodelete') {
            const setting = args.toLowerCase();
            if (!['on', 'off'].includes(setting)) {
                return reply('`✘ Use: on or off`');
            }
            db[groupId].autoDelete = setting === 'on';
            saveDB(db);
            const state = setting === 'on' ? 'ENABLED' : 'DISABLED';
            return reply(`\`—͟͟͞͞𖣘 Auto-delete ${state}\``);
        }

        return reply('`✘ Invalid sub-command`');
    }
};
