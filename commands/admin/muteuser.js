const { getTarget }                        = require('../../lib/getTarget');
const muteStore                            = require('../../lib/muteStore');
const {
    parseTime,
    humanize,
    schedule,
    cancelAll,
    parseTimeOfDay,
    addRecurring,
} = require('../../lib/mute-core');

module.exports = {
    name: 'muteuser', aliases: ['mute -u'], category: 'admin', reactions: { start: '🛡️' },
    description: 'Mute a user. .muteuser @user 1h  OR  .muteuser @user after 2h (delayed)',
    adminOnly: true, groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m);
        if (!target) return m.reply(`Reply to a message or tag a user.\n${bot.prefix}muteuser @user [1h] [after 2h]`);

        const key    = muteStore._keyOf(target);
        const joined = args.filter(a => !a.startsWith('@')).join(' ').trim();
        const recurring = joined.match(/^(?:\.?(?:sch[\s-]+)?-?muteuser\s+)?(.+?)\s+to\s+(.+)$/i);

        if (recurring) {
            const timeFrom = parseTimeOfDay(recurring[1]);
            const timeTo = parseTimeOfDay(recurring[2]);
            if (!timeFrom || !timeTo) {
                return m.reply('⚠️ Bad schedule. Use: .sch -muteuser 2am to 6am');
            }

            addRecurring({
                chat: m.chat,
                target: key,
                mutedBy: m.sender,
                type: 'sch-muteUser',
                timeFrom,
                timeTo,
            });
            return m.reply(
                `🕒 @${target.split('@')[0]} will be muted daily from ${recurring[1]} to ${recurring[2]}.`,
                { mentions: [target] },
            );
        }

        const isAfterMode = /\bafter\b/i.test(joined);
        const timeStr     = joined.replace(/\bafter\b/i, '').trim();
        const ms          = timeStr ? parseTime(timeStr) : null;

        if (timeStr && !ms) return m.reply('⚠️ Bad duration. Use: 10m 1h 6h 1d 7d etc.');

        if (isAfterMode && ms) {
            cancelAll({ chat: m.chat, target: key });
            schedule({ type: 'muteUser', chat: m.chat, target: key, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return m.reply(`⏳ @${target.split('@')[0]} will be muted in ${humanize(ms)}.`, { mentions: [target] });
        }

        const existing = muteStore.getMute(target);
        if (existing && !existing.stickersOnly) return m.reply(`@${target.split('@')[0]} is already muted.`, { mentions: [target] });

        muteStore.setMute(target, { stickersOnly: false, mutedBy: m.sender, chat: m.chat, mutedAt: Date.now() });

        if (ms) {
            cancelAll({ chat: m.chat, target: key });
            schedule({ type: 'unmuteUser', chat: m.chat, target: key, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return bot.sendMessage(m.chat, { text: `🔇 @${target.split('@')[0]} muted for ${humanize(ms)} — auto-unmutes when timer ends.`, mentions: [target] });
        }
        await bot.sendMessage(m.chat, { text: `🔇 @${target.split('@')[0]} has been muted.`, mentions: [target] });
    }
};
