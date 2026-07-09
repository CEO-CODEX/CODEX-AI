const { getTarget }                        = require('../../lib/getTarget');
const muteStore                            = require('../../lib/muteStore');
const { parseTime, humanize, schedule, cancelAll } = require('../../lib/mute-core');

module.exports = {
    name: 'unmuteuser', aliases: ['unmute'], category: 'admin',
    description: 'Unmute a user. .unmuteuser @user  OR  .unmuteuser @user after 1h (delayed)',
    adminOnly: true, groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m);
        if (!target) return m.reply(`Reply to a message or tag a user.\n${bot.prefix}unmuteuser @user [after 1h]`);

        const key    = muteStore._keyOf(target);
        const joined = args.filter(a => !a.startsWith('@')).join(' ').replace(/\bafter\b/i, '').trim();
        const ms     = joined ? parseTime(joined) : null;

        if (joined && !ms) return m.reply('⚠️ Bad duration. Use: 10m 1h 6h 1d 7d etc.');

        if (ms) {
            cancelAll({ chat: m.chat, target: key });
            schedule({ type: 'unmuteuser', chat: m.chat, target: key, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return m.reply(`⏳ @${target.split('@')[0]} will be unmuted in ${humanize(ms)}.`, { mentions: [target] });
        }

        if (!muteStore.getMute(target)) return m.reply(`@${target.split('@')[0]} isn't muted.`, { mentions: [target] });
        muteStore.clearMute(target);
        cancelAll({ chat: m.chat, target: key });
        await bot.sendMessage(m.chat, { text: `🔊 @${target.split('@')[0]} has been unmuted.`, mentions: [target] });
    }
};
