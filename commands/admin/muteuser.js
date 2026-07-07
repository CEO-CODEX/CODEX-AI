const { getTarget } = require('../../lib/getTarget');
const muteStore = require('../../lib/muteStore');
const scheduler = require('../../lib/scheduler');
const { extractDuration, humanizeMs } = require('../../lib/duration');

module.exports = {
    name: 'muteuser',
    aliases: ['mute'],
    category: 'admin',
    description: 'Mute a user — blocks all their messages in this chat. Optional timer: ".muteuser @user 10m" (auto-unmute) or ".muteuser @user after 10m" (delayed mute).',
    usage: '.muteuser @user [duration] | .muteuser @user after <duration>',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m);
        if (!target) return await m.reply(`Tag a user or reply to their message.\nExample: ${bot.prefix}muteuser @user [10m]`);

        const key = muteStore._keyOf(target);
        const { isAfter, ms, rest } = extractDuration(args.filter(a => !a.startsWith('@')));

        if (rest.length && rest.some(r => /^\d/.test(r)) && ms === null) {
            return await m.reply(`⚠️ Couldn't parse that duration. Try formats like 10m, 1h, 1h30m.`);
        }

        // ── Delayed mute: ".muteuser @user after 10m" ───────────────────────
        if (isAfter) {
            if (!ms) return await m.reply(`Usage: ${bot.prefix}muteuser @user after <duration>\nExample: ${bot.prefix}muteuser @user after 10m`);
            scheduler.cancelMatching({ type: 'muteuser', chat: m.chat, target: key });
            scheduler.cancelMatching({ type: 'unmuteuser', chat: m.chat, target: key });
            scheduler.schedule({ type: 'muteuser', dueAt: Date.now() + ms, chat: m.chat, target: key, issuedBy: m.sender });
            return await m.reply(`⏳ @${target.split('@')[0]} will be muted in ${humanizeMs(ms)}.`, { mentions: [target] });
        }

        const existing = muteStore.getMute(target);
        if (existing && !existing.stickersOnly) {
            return await m.reply(`@${target.split('@')[0]} is already muted.`, { mentions: [target] });
        }

        muteStore.setMute(target, { stickersOnly: false, mutedBy: m.sender, chat: m.chat, mutedAt: Date.now() });

        // ── Timed mute: ".muteuser @user 10m" → auto-unmute after duration ──
        scheduler.cancelMatching({ type: 'unmuteuser', chat: m.chat, target: key }); // clear any earlier pending auto-unmute
        if (ms) {
            scheduler.schedule({ type: 'unmuteuser', dueAt: Date.now() + ms, chat: m.chat, target: key, issuedBy: m.sender });
            return await bot.sendMessage(m.chat, {
                text: `🔇 @${target.split('@')[0]} has been muted for ${humanizeMs(ms)} — auto-unmutes when the timer ends.`,
                mentions: [target]
            });
        }

        await bot.sendMessage(m.chat, {
            text: `🔇 @${target.split('@')[0]} has been muted — their messages won't go through here until unmuted.`,
            mentions: [target]
        });
    }
};
