const scheduler = require('../../lib/scheduler');
const { extractDuration, humanizeMs } = require('../../lib/duration');

module.exports = {
    name: 'lock',
    aliases: ['groupclose', 'lockgroup'],
    category: 'admin',
    description: 'Lock the group (admins-only messaging). ".lock 10m" auto-unlocks after 10m. ".lock after 10m" delays the lock itself by 10m.',
    usage: '.lock [duration] | .lock after <duration>',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const jid = m.chat;
        const { isAfter, ms } = extractDuration(args);

        if (args.length && ms === null && /\d/.test(args.join(' '))) {
            return await m.reply(`⚠️ Couldn't parse that duration. Try formats like 10m, 1h, 1h30m.`);
        }

        // ── Delayed lock: ".lock after 10m" — group stays OPEN until then ───
        if (isAfter) {
            if (!ms) return await m.reply(`Usage: ${bot.prefix}lock after <duration>\nExample: ${bot.prefix}lock after 10m`);
            scheduler.cancelMatching({ type: 'lock', chat: jid });
            scheduler.cancelMatching({ type: 'unlock', chat: jid });
            scheduler.schedule({ type: 'lock', dueAt: Date.now() + ms, chat: jid, issuedBy: m.sender });
            return await m.reply(`⏳ Group will be locked in ${humanizeMs(ms)}.`);
        }

        // ── Lock now, optionally with an auto-unlock timer: ".lock 10m" ─────
        try {
            await bot.sock.groupSettingUpdate(jid, 'announcement');
        } catch (e) {
            return await m.reply(`❌ Failed to lock the group: ${e.message}\n\nMake sure the bot is an admin.`);
        }

        scheduler.cancelMatching({ type: 'unlock', chat: jid }); // clear any earlier pending auto-unlock
        if (ms) {
            scheduler.schedule({ type: 'unlock', dueAt: Date.now() + ms, chat: jid, issuedBy: m.sender });
            return await m.reply(`🔒 *Group locked* for ${humanizeMs(ms)} — only admins can send messages.\nIt'll auto-unlock when the timer ends, or use ${bot.prefix}unlock to lift it early.`);
        }

        return await m.reply('🔒 *Group locked* — only admins can send messages.');
    }
};
