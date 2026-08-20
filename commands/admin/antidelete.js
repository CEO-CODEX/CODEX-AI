const fs = require('fs');
const path = require('path');

const DB = path.join(__dirname, '../../database/antidelete.json');

if (!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify({ enabled: false, mode: 'dm' }, null, 2));

const getDB = () => {
    try { return JSON.parse(fs.readFileSync(DB, 'utf8')); }
    catch { return { enabled: false, mode: 'dm' }; }
};
const saveDB = (data) => fs.writeFileSync(DB, JSON.stringify(data, null, 2));

// The actual recovery + forwarding (text and media) happens in app.js's
// _handleAntiDelete, wired to the messages.delete / revoke events in
// lib/connection.js. This file is only the .antidelete command itself —
// it just flips the switches that _handleAntiDelete reads.
module.exports = {
    name: 'antidelete',
    aliases: ['deletedetect'],
    category: 'tools',
    reactions: { start: '🛡️' },
    desc: 'Resend deleted messages (text + media) to your DM or back to the same chat',

    execute: async (sock, m, { args, reply }) => {
        const db   = getDB();
        const sub  = args[0]?.toLowerCase();
        const sub2 = args[1]?.toLowerCase();

        if (!sub) {
            const status = db.enabled ? 'ON' : 'OFF';
            const mode   = db.mode || 'dm';
            return reply(
                `╭─❍ *ANTI-DELETE* 𓉤\n` +
                `│ Status : *${status}*\n` +
                `│ Send to : *${mode.toUpperCase()}*\n` +
                `│\n` +
                `│ Commands:\n` +
                `│ .antidelete on\n` +
                `│ .antidelete off\n` +
                `│ .antidelete mode dm\n` +
                `│ .antidelete mode chat\n` +
                `╰────────────────`
            );
        }

        // .antidelete on  → enable everywhere (private chats AND groups)
        if (sub === 'on') {
            db.enabled = true;
            saveDB(db);
            return reply('`—͟͟͞͞𖣘 Anti-delete ENABLED for all chats`');
        }

        // .antidelete off → disable everywhere
        if (sub === 'off') {
            db.enabled = false;
            saveDB(db);
            return reply('`⟁⃝✘ Anti-delete DISABLED`');
        }

        // .antidelete mode dm | chat
        if (sub === 'mode') {
            if (!sub2 || !['dm', 'chat'].includes(sub2)) {
                return reply('_⚉ Use .antidelete mode dm or .antidelete mode chat_');
            }
            db.mode = sub2;
            saveDB(db);
            return reply(
                sub2 === 'dm'
                    ? '`—͟͟͞͞𖣘 Deleted messages → sent to your DM`'
                    : '`—͟͟͞͞𖣘 Deleted messages → sent back to the same chat`'
            );
        }

        reply('_⚉ Unknown. Use .antidelete on/off or .antidelete mode dm/chat_');
    }
};
