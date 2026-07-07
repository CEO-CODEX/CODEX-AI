const { getTarget } = require('../../lib/getTarget');
const muteStore = require('../../lib/muteStore');
const scheduler = require('../../lib/scheduler');
const { extractDuration, humanizeMs } = require('../../lib/duration');

module.exports = {
    name: 'mutesticker',
    aliases: ['stickermute'],
    category: 'admin',
    description: 'Block just a user\'s stickers in this chat. Optional timer: ".mutesticker @user 10m" (auto-unblock) or "after 10m" (delayed block).',
    usage: '.mutesticker @user [duration] | .mutesticker @user after <duration>',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m);
        if (!target) return await m.reply(`Tag a user or reply to their message.\nExample: ${bot.prefix}mutesticker @user [10m]`);

        const key = muteStore._keyOf(target);
        const { isAfter, ms, rest } = extractDuration(args.filter(a => !a.startsWith('@')));

        if (rest.length && rest.some(r => /^\d/.test(r)) && ms === null) {
            return await m.reply(`⚠️ Couldn't parse that duration. Try formats like 10m, 1h, 1h30m.`);
        }

        // ── Delayed block: ".mutesticker @user after 10m" ───────────────────
        if (isAfter) {
            if (!ms) return await m.reply(`Usage: ${bot.prefix}mutesticker @user after <duration>\nExample: ${bot.prefix}mutesticker @user after 10m`);
            scheduler.cancelMatching({ type: 'mutesticker', chat: m.chat, target: key });
            scheduler.cancelMatching({ type: 'unmutesticker', chat: m.chat, target: key });
            scheduler.schedule({ type: 'mutesticker', dueAt: Date.now() + ms, chat: m.chat, target: key, issuedBy: m.sender });
            return await m.reply(`⏳ @${target.split('@')[0]}'s stickers will be blocked in ${humanizeMs(ms)}.`, { mentions: [target] });
        }

        const existing = muteStore.getMute(target);
        if (existing && !existing.stickersOnly) {
            return await m.reply(`@${target.split('@')[0]} is already fully muted — use ${bot.prefix}unmuteuser first if you want to switch to sticker-only.`, { mentions: [target] });
        }
        if (existing?.stickersOnly && !ms) {
            return await m.reply(`@${target.split('@')[0]}'s stickers are already blocked.`, { mentions: [target] });
        }

        muteStore.setMute(target, { stickersOnly: true, mutedBy: m.sender, chat: m.chat, mutedAt: Date.now() });

        // ── Timed block: ".mutesticker @user 10m" → auto-unblock after duration ──
        scheduler.cancelMatching({ type: 'unmutesticker', chat: m.chat, target: key });
        if (ms) {
            scheduler.schedule({ type: 'unmutesticker', dueAt: Date.now() + ms, chat: m.chat, target: key, issuedBy: m.sender });
            return await bot.sendMessage(m.chat, {
                text: `🚫 @${target.split('@')[0]}'s stickers are blocked for ${humanizeMs(ms)} — auto-unblocks when the timer ends.`,
                mentions: [target]
            });
        }

        await bot.sendMessage(m.chat, {
            text: `🚫 @${target.split('@')[0]}'s stickers are now blocked in this chat (text and everything else still works).`,
            mentions: [target]
        });
    }
};
