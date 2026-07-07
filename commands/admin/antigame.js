const fs = require('fs-extra');

module.exports = {
    name: 'antigame',
    aliases: ['antiga'],
    category: 'admin',
    description: 'Configure anti-game message protection',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const groupId = m.chat;
        const sub     = args[0]?.toLowerCase();
        const dbPath  = './database/antigame.json';
        let db = {};
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch { db = {}; }
        fs.ensureDirSync('./database');
        if (!db[groupId]) db[groupId] = { enabled: false, action: 'warn', maxWarns: 3 };
        const s    = db[groupId];
        const save = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

        if (!sub || sub === 'status') return await m.reply(
`antigame status
Status: ${s.enabled ? 'ON' : 'OFF'}
Action: ${(s.action||'warn').toUpperCase()}
MaxWarns: ${s.maxWarns||3}

Usage:
${bot.prefix}antigame on/off
${bot.prefix}antigame delete
${bot.prefix}antigame kick
${bot.prefix}antigame warn [1-10]`);

        if (sub === 'on')     { s.enabled = true;  save(); return await m.reply('Anti-Game enabled.'); }
        if (sub === 'off')    { s.enabled = false; save(); return await m.reply('Anti-Game disabled.'); }
        if (sub === 'delete') { s.action = 'delete'; save(); return await m.reply('Action set to DELETE.'); }
        if (sub === 'kick')   { s.action = 'kick';   save(); return await m.reply('Action set to KICK.'); }
        if (sub === 'warn') {
            const n = parseInt(args[1]);
            if (!n || n < 1 || n > 10) return await m.reply(`Usage: ${bot.prefix}antigame warn [1-10]`);
            s.action = 'warn'; s.maxWarns = n; save();
            return await m.reply(`Action set to WARN. Max ${n} warnings before kick.`);
        }
        return await m.reply(`Unknown option. Use ${bot.prefix}antigame status`);
    }
};
