const fs = require('fs-extra');

module.exports = {
    name: 'antilink',
    aliases: ['antil'],
    category: 'admin',
    description: 'Configure anti-link protection',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const groupId = m.chat;
        const sub     = args[0]?.toLowerCase();
        const dbPath  = './database/antilink.json';
        let db = {};
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch { db = {}; }
        fs.ensureDirSync('./database');
        if (!db[groupId]) db[groupId] = { enabled: true, action: bot.config.antiLink?.action || 'warn', maxWarns: bot.config.antiLink?.maxWarns || 3 };
        const s    = db[groupId];
        const save = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

        if (!sub || sub === 'status') return await m.reply(
`antilink status
Status: ${s.enabled !== false ? 'ON' : 'OFF'}
Action: ${(s.action||'warn').toUpperCase()}
MaxWarns: ${s.maxWarns||3}

Usage:
${bot.prefix}antilink on/off
${bot.prefix}antilink delete
${bot.prefix}antilink kick
${bot.prefix}antilink warn [1-10]`);

        if (sub === 'on')     { s.enabled = true;  save(); return await m.reply('Anti-Link enabled.'); }
        if (sub === 'off')    { s.enabled = false; save(); return await m.reply('Anti-Link disabled.'); }
        if (sub === 'delete') { s.action = 'delete'; save(); return await m.reply('Action set to DELETE. Links deleted immediately.'); }
        if (sub === 'kick')   { s.action = 'kick';   save(); return await m.reply('Action set to KICK. User kicked immediately for links.'); }
        if (sub === 'warn') {
            const n = parseInt(args[1]);
            if (!n || n < 1 || n > 10) return await m.reply(`Usage: ${bot.prefix}antilink warn [1-10]`);
            s.action = 'warn'; s.maxWarns = n; save();
            return await m.reply(`Action set to WARN. Max ${n} warnings before kick.`);
        }
        return await m.reply(`Unknown option. Use ${bot.prefix}antilink status`);
    }
};
