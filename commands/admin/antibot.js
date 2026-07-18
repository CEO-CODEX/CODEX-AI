const fs = require('fs-extra');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../database/antibot.json');

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
    name: 'antibot',
    alias: ['ab'],
    desc: 'Block bot accounts from the group',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,

    execute: async (sock, m, { text, reply }) => {
        const db = loadDB();
        const groupId = m.chat;
        if (!db[groupId]) db[groupId] = { enabled: false, action: 'kick' };

        const sub = (text || '').split(' ')[0]?.toLowerCase();
        const args = (text || '').split(' ').slice(1).join(' ').trim();

        // .antibot  — show status
        if (!sub) {
            const status = db[groupId].enabled ? 'ON' : 'OFF';
            const action = db[groupId].action || 'kick';
            return reply(
                `╭─❍ *ANTI-BOT* 𓉤\n` +
                `│ Status   : *${status}*\n` +
                `│ Action   : *${action.toUpperCase()}*\n` +
                `│ Warnings : 3\n` +
                `│\n` +
                `│ Commands:\n` +
                `│ .antibot on\n` +
                `│ .antibot off\n` +
                `│ .antibot action delete|warn|kick\n` +
                `╰────────────────`
            );
        }

        // .antibot on
        if (sub === 'on') {
            db[groupId].enabled = true;
            saveDB(db);
            return reply('`—͟͟͞͞𖣘 Anti-Bot ENABLED`');
        }

        // .antibot off
        if (sub === 'off') {
            db[groupId].enabled = false;
            saveDB(db);
            return reply('`—͟͟͞͞𖣘 Anti-Bot DISABLED`');
        }

        // .antibot action delete|warn|kick
        if (sub === 'action') {
            const newAction = args.toLowerCase();
            if (!['delete', 'warn', 'kick'].includes(newAction)) {
                return reply('`✘ Action must be: delete, warn, or kick`');
            }
            db[groupId].action = newAction;
            saveDB(db);
            return reply(`\`—͟͟͞͞𖣘 Action set to: ${newAction.toUpperCase()}\``);
        }

        return reply('`✘ Invalid sub-command`');
    }
};
