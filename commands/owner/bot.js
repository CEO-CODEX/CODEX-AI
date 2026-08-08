const fs = require('fs-extra');

const DB_PATH = './database/botToggle.json';
const readDB  = () => { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; } };
const saveDB  = (d) => { fs.ensureDirSync('./database'); fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2)); };

module.exports = {
    name: 'bot',
    aliases: ['botswitch', 'gcbot'],
    category: 'owner',
    description: 'Turn the bot completely on/off for this group. When off, nothing works here — no commands, no moderation, nothing — except .bot on.',
    ownerOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const groupId = m.chat;
        const sub     = (args[0] || '').toLowerCase();
        const db      = readDB();
        if (!db[groupId]) db[groupId] = { enabled: true };
        const s = db[groupId];

        if (!sub || sub === 'status') {
            return m.reply(`🤖 Bot is currently *${s.enabled !== false ? 'ON' : 'OFF'}* for this group.\n\n${bot.prefix}bot on\n${bot.prefix}bot off`);
        }

        if (sub === 'on') {
            s.enabled = true;
            saveDB(db);
            return m.reply('✅ Bot enabled for this group — everything is back to normal.');
        }

        if (sub === 'off') {
            s.enabled = false;
            saveDB(db);
            return m.reply(`🛑 Bot disabled for this group. Nothing will work here — no commands, no moderation, nothing — until ${bot.prefix}bot on is used.`);
        }

        return m.reply(`Usage:\n${bot.prefix}bot on\n${bot.prefix}bot off\n${bot.prefix}bot status`);
    }
};
