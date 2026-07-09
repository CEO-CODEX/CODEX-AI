const { getTarget }                        = require('../../lib/getTarget');
const muteStore                            = require('../../lib/muteStore');
const { parseTime, humanize, schedule, cancelAll } = require('../../lib/mute-core');

module.exports = {
    name: 'unmutesticker', aliases: ['unstickermute'], category: 'admin',
    description: 'Unblock a user\'s stickers. .unmutesticker @user  OR  after 1h',
    adminOnly: true, groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m);
        if (!target) return m.reply(`Reply to a message or tag a user.\n${bot.prefix}unmutesticker @user [after 1h]`);

        const key    = muteStore._keyOf(target);
        const joined = args.filter(a => !a.startsWith('@')).join(' ').replace(/\bafter\b/i, '').trim();
        const ms     = joined ? parseTime(joined) : null;

        if (joined && !ms) return m.reply('⚠️ Bad duration. Use: 10m 1h 6h 1d 7d etc.');

        if (ms) {
            cancelAll({ chat: m.chat, target: key });
            schedule({ type: 'unmutesticker', chat: m.chat, target: key, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return m.reply(`⏳ @${target.split('@')[0]}'s stickers unblocked in ${humanize(ms)}.`, { mentions: [target] });
        }

        if (!muteStore.getMute(target)?.stickersOnly) return m.reply(`@${target.split('@')[0]}'s stickers aren't blocked.`, { mentions: [target] });
        muteStore.clearMute(target);
        cancelAll({ chat: m.chat, target: key });
        await bot.sendMessage(m.chat, { text: `✅ @${target.split('@')[0]}'s stickers are unblocked.`, mentions: [target] });
    }
};
