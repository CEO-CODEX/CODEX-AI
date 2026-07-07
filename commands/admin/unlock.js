const scheduler = require('../../lib/scheduler');
const { extractDuration, humanizeMs } = require('../../lib/duration');

module.exports = {
    name: 'unlock',
    aliases: ['groupopen', 'unlockgroup'],
    category: 'admin',
    description: 'Unlock the group. ".unlock 10m" or ".unlock after 10m" delays the unlock by 10m instead of doing it right now.',
    usage: '.unlock | .unlock after <duration>',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const jid = m.chat;
        const { ms } = extractDuration(args);

        if (args.length && ms === null && /\d/.test(args.join(' '))) {
            return await m.reply(`⚠️ Couldn't parse that duration. Try formats like 10m, 1h, 1h30m.`);
        }

        // ── Delayed unlock: ".unlock after 10m" / ".unlock 10m" — stays locked until then ──
        if (ms) {
            scheduler.cancelMatching({ type: 'unlock', chat: jid });
            scheduler.cancelMatching({ type: 'lock', chat: jid });
            scheduler.schedule({ type: 'unlock', dueAt: Date.now() + ms, chat: jid, issuedBy: m.sender });
            return await m.reply(`⏳ Group will be unlocked in ${humanizeMs(ms)}.`);
        }

        try {
            await bot.sock.groupSettingUpdate(jid, 'not_announcement');
        } catch (e) {
            return await m.reply(`❌ Failed to unlock the group: ${e.message}\n\nMake sure the bot is an admin.`);
        }

        scheduler.cancelMatching({ type: 'unlock', chat: jid }); // manual unlock cancels any pending scheduled one
        return await m.reply('🔓 *Group unlocked* — everyone can send messages again.');
    }
};
