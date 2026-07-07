const fs = require('fs-extra');

module.exports = {
    name: 'antispam',
    aliases: ['antisp'],
    category: 'admin',
    description: 'Configure anti-spam protection',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const groupId = m.chat;
        const sub     = args[0]?.toLowerCase();
        const dbPath  = './database/antispam.json';
        let db = {};
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch { db = {}; }
        fs.ensureDirSync('./database');
        if (!db[groupId]) db[groupId] = { enabled: true, action: bot.config.antiSpam?.action || 'warn', maxWarns: bot.config.antiSpam?.maxWarns || 3, limit: bot.config.antiSpam?.limit || 5, cooldown: bot.config.antiSpam?.cooldown || 10000 };
        const s    = db[groupId];
        const save = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

        if (!sub || sub === 'status') return await m.reply(
`antispam status
Status: ${s.enabled !== false ? 'ON' : 'OFF'}
Action: ${(s.action||'warn').toUpperCase()}
Limit: ${s.limit||5} msgs
Cooldown: ${(s.cooldown||10000)/1000}s
MaxWarns: ${s.maxWarns||3}

Usage:
${bot.prefix}antispam on/off
${bot.prefix}antispam delete
${bot.prefix}antispam kick
${bot.prefix}antispam warn 3
${bot.prefix}antispam limit 5 10`);

        if (sub === 'on')     { s.enabled = true;  save(); return await m.reply('Anti-Spam enabled.'); }
        if (sub === 'off')    { s.enabled = false; save(); return await m.reply('Anti-Spam disabled.'); }
        if (sub === 'delete') { s.action = 'delete'; save(); return await m.reply('Action set to DELETE. Spam messages will be deleted.'); }
        if (sub === 'kick')   { s.action = 'kick';   save(); return await m.reply('Action set to KICK. Spammers will be removed immediately.'); }
        if (sub === 'warn') {
            const n = parseInt(args[1]);
            if (!n || n < 1 || n > 10) return await m.reply(`Usage: ${bot.prefix}antispam warn [1-10]`);
            s.action = 'warn'; s.maxWarns = n; save();
            return await m.reply(`Action set to WARN. Max ${n} warnings before kick.`);
        }
        if (sub === 'limit') {
            const msgs = parseInt(args[1]);
            const secs = parseInt(args[2]);
            if (!msgs || msgs < 1) return await m.reply(`Usage: ${bot.prefix}antispam limit <msgs> <seconds>\nExample: ${bot.prefix}antispam limit 5 10`);
            s.limit = msgs;
            if (secs && secs > 0) s.cooldown = secs * 1000;
            save();
            return await m.reply(`Spam limit updated. Trigger: ${msgs} msgs in ${s.cooldown/1000}s`);
        }
        return await m.reply(`Unknown option. Use ${bot.prefix}antispam status`);
    }
};

