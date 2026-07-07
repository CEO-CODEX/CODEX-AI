const fs = require('fs-extra');

module.exports = {
    name: 'antitag',
    aliases: ['antit'],
    category: 'admin',
    description: 'Configure anti-tag (mass mention) protection',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const groupId = m.chat;
        const sub     = args[0]?.toLowerCase();
        const dbPath  = './database/antitag.json';
        let db = {};
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch { db = {}; }
        fs.ensureDirSync('./database');
        if (!db[groupId]) db[groupId] = { enabled: true, action: bot.config.antiTag?.action || 'warn', maxWarns: bot.config.antiTag?.maxWarns || 3 };
        const s    = db[groupId];
        const save = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

        if (!sub || sub === 'status') return await m.reply(
`antitag status
Status: ${s.enabled !== false ? 'ON' : 'OFF'}
Action: ${(s.action||'warn').toUpperCase()}
MaxWarns: ${s.maxWarns||3}

Usage:
${bot.prefix}antitag on/off
${bot.prefix}antitag delete
${bot.prefix}antitag kick
${bot.prefix}antitag warn [1-10]`);

        if (sub === 'on')     { s.enabled = true;  save(); return await m.reply('Anti-Tag enabled.'); }
        if (sub === 'off')    { s.enabled = false; save(); return await m.reply('Anti-Tag disabled.'); }
        if (sub === 'delete') { s.action = 'delete'; save(); return await m.reply('Action set to DELETE.'); }
        if (sub === 'kick')   { s.action = 'kick';   save(); return await m.reply('Action set to KICK.'); }
        if (sub === 'warn') {
            const n = parseInt(args[1]);
            if (!n || n < 1 || n > 10) return await m.reply(`Usage: ${bot.prefix}antitag warn [1-10]`);
            s.action = 'warn'; s.maxWarns = n; save();
            return await m.reply(`Action set to WARN. Max ${n} warnings before kick.`);
        }
        return await m.reply(`Unknown option. Use ${bot.prefix}antitag status`);
    }
};
