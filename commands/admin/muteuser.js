const { getTarget }                        = require('../../lib/getTarget');
const muteStore                            = require('../../lib/muteStore');
const { parseTime, humanize, schedule, cancelAll } = require('../../lib/mute-core');

module.exports = {
    name: 'muteuser', aliases: ['mute'], category: 'admin',
    description: 'Mute a user. .muteuser @user 1h  OR  .muteuser @user after 2h (delayed)',
    adminOnly: true, groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m);
        if (!target) return m.reply(`Reply to a message or tag a user.\n${bot.prefix}muteuser @user [1h] [after 2h]`);

        const key    = muteStore._keyOf(target);
        const joined = args.filter(a => !a.startsWith('@')).join(' ');
        const isAfterMode = /\bafter\b/i.test(joined);
        const timeStr     = joined.replace(/\bafter\b/i, '').trim();
        const ms          = timeStr ? parseTime(timeStr) : null;

        if (timeStr && !ms) return m.reply('⚠️ Bad duration. Use: 10m 1h 6h 1d 7d etc.');

        if (isAfterMode && ms) {
            cancelAll({ chat: m.chat, target: key });
            schedule({ type: 'muteuser', chat: m.chat, target: key, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return m.reply(`⏳ @${target.split('@')[0]} will be muted in ${humanize(ms)}.`, { mentions: [target] });
        }

        const existing = muteStore.getMute(target);
        if (existing && !existing.stickersOnly) return m.reply(`@${target.split('@')[0]} is already muted.`, { mentions: [target] });

        muteStore.setMute(target, { stickersOnly: false, mutedBy: m.sender, chat: m.chat, mutedAt: Date.now() });

        if (ms) {
            cancelAll({ chat: m.chat, target: key });
            schedule({ type: 'unmuteuser', chat: m.chat, target: key, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return bot.sendMessage(m.chat, { text: `🔇 @${target.split('@')[0]} muted for ${humanize(ms)} — auto-unmutes when timer ends.`, mentions: [target] });
        }
        await bot.sendMessage(m.chat, { text: `🔇 @${target.split('@')[0]} has been muted.`, mentions: [target] });
    }
};
