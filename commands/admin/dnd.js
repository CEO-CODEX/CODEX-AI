const fs = require('fs-extra');
const { parseTime, humanize, schedule, cancel } = require('../../lib/mute-core');

const RESERVED = ['on', 'off', 'delete', 'kick', 'warn', 'status', 'msg', 'message', 'after'];

module.exports = {
    name: 'dnd',
    aliases: ['donotdisturb'],
    category: 'admin',
    reactions: { start: '👀', success: '📝' },
    description: 'Do Not Disturb — deletes/kicks/warns anyone (except owner/mods) who tags the owner or the bot in this group. Now part of the anti-systems family: uses delete/kick/warn like antilink, and supports timers (.dnd 5h) and schedules (.sch -dnd 12am to 6pm daily).',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const groupId = m.chat;
        const sub     = (args[0] || '').toLowerCase();
        const dbPath  = './database/dnd.json';
        let db = {};
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch { db = {}; }
        fs.ensureDirSync('./database');
        if (!db[groupId]) db[groupId] = { enabled: false, action: 'delete', maxWarns: 3, customMsg: null };
        const s    = db[groupId];
        const save = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

        if (!sub || sub === 'status') return await m.reply(
`dnd status
Status: ${s.enabled ? 'ON' : 'OFF'}
Action: ${(s.action || 'delete').toUpperCase()}
MaxWarns: ${s.maxWarns || 3}
Custom message: ${s.customMsg || '(default)'}

Usage:
${bot.prefix}dnd on/off
${bot.prefix}dnd delete / kick / warn [1-10]
${bot.prefix}dnd msg <text>
${bot.prefix}dnd 5h              — on now, auto-off in 5h
${bot.prefix}dnd after 2h        — on in 2h
${bot.prefix}sch -dnd 12am to 6pm daily`);

        if (sub === 'on')     { s.enabled = true;  save(); return await m.reply('🔕 DND enabled — tagging the owner or the bot will now be actioned.'); }
        if (sub === 'off')    { s.enabled = false; save(); return await m.reply('🔔 DND disabled.'); }
        if (sub === 'delete') { s.action = 'delete'; save(); return await m.reply('Action set to DELETE. Tags deleted immediately.'); }
        if (sub === 'kick')   { s.action = 'kick';   save(); return await m.reply('Action set to KICK. Tagging owner/bot gets you kicked immediately.'); }
        if (sub === 'warn') {
            const n = parseInt(args[1]);
            if (!n || n < 1 || n > 10) return await m.reply(`Usage: ${bot.prefix}dnd warn [1-10]`);
            s.action = 'warn'; s.maxWarns = n; save();
            return await m.reply(`Action set to WARN. Max ${n} warnings before kick.`);
        }
        if (sub === 'msg' || sub === 'message') {
            const text = args.slice(1).join(' ').trim();
            if (!text) {
                s.customMsg = null; save();
                return await m.reply('Custom DND message cleared — back to the default message.');
            }
            s.customMsg = text; save();
            return await m.reply(`✅ Custom DND message set:\n${text}`);
        }

        // ── Timer: .dnd 5h (on now, auto-off) / .dnd after 2h (on later) ────
        const joined      = args.join(' ');
        const isAfterMode = /\bafter\b/i.test(joined);
        const timeStr     = joined.replace(/\bafter\b/i, '').trim();
        const ms          = timeStr ? parseTime(timeStr) : null;

        if (!RESERVED.includes(sub) && timeStr && !ms) {
            return await m.reply(`Unknown option. Use ${bot.prefix}dnd status`);
        }

        if (isAfterMode && ms) {
            cancel({ type: 'dndOn', chat: groupId });
            schedule({ type: 'dndOn', chat: groupId, target: null, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return await m.reply(`⏳ DND will turn ON in ${humanize(ms)}.`);
        }

        if (ms) {
            s.enabled = true;
            save();
            cancel({ type: 'dndOff', chat: groupId });
            schedule({ type: 'dndOff', chat: groupId, target: null, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return await bot.sendMessage(groupId, { text: `🔕 DND enabled for ${humanize(ms)} — auto-off when the timer ends.` });
        }

        return await m.reply(`Unknown option. Use ${bot.prefix}dnd status`);
    }
};
                               
