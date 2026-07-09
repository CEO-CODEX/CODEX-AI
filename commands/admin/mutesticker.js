const { getTarget }                        = require('../../lib/getTarget');
const muteStore                            = require('../../lib/muteStore');
const { parseTime, humanize, schedule, cancelAll } = require('../../lib/mute-core');

module.exports = {
    name: 'mutesticker', aliases: ['stickermute'], category: 'admin',
    description: 'Block a user\'s stickers. .mutesticker @user 1h  OR  .mutesticker @user after 2h',
    adminOnly: true, groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m);
        if (!target) return m.reply(`Reply to a message or tag a user.\n${bot.prefix}mutesticker @user [1h]`);

        const key     = muteStore._keyOf(target);
        const joined  = args.filter(a => !a.startsWith('@')).join(' ');
        const isAfter = /\bafter\b/i.test(joined);
        const timeStr = joined.replace(/\bafter\b/i, '').trim();
        const ms      = timeStr ? parseTime(timeStr) : null;

        if (timeStr && !ms) return m.reply('⚠️ Bad duration. Use: 10m 1h 6h 1d 7d etc.');

        if (isAfter && ms) {
            cancelAll({ chat: m.chat, target: key });
            schedule({ type: 'mutesticker', chat: m.chat, target: key, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return m.reply(`⏳ @${target.split('@')[0]}'s stickers will be blocked in ${humanize(ms)}.`, { mentions: [target] });
        }

        const existing = muteStore.getMute(target);
        if (existing && !existing.stickersOnly) return m.reply(`@${target.split('@')[0]} is fully muted — use ${bot.prefix}unmuteuser first.`, { mentions: [target] });
        if (existing?.stickersOnly && !ms) return m.reply(`@${target.split('@')[0]}'s stickers are already blocked.`, { mentions: [target] });

        muteStore.setMute(target, { stickersOnly: true, mutedBy: m.sender, chat: m.chat, mutedAt: Date.now() });

        if (ms) {
            cancelAll({ chat: m.chat, target: key });
            schedule({ type: 'unmutesticker', chat: m.chat, target: key, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return bot.sendMessage(m.chat, { text: `🚫 @${target.split('@')[0]}'s stickers blocked for ${humanize(ms)}.`, mentions: [target] });
        }
        await bot.sendMessage(m.chat, { text: `🚫 @${target.split('@')[0]}'s stickers are blocked (text still works).`, mentions: [target] });
    }
};
