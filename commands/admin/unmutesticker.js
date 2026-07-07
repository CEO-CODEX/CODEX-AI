const { getTarget } = require('../../lib/getTarget');
const muteStore = require('../../lib/muteStore');
const scheduler = require('../../lib/scheduler');
const { extractDuration, humanizeMs } = require('../../lib/duration');

module.exports = {
    name: 'unmutesticker',
    aliases: ['unstickermute'],
    category: 'admin',
    description: 'Lift a sticker-only mute. Optional delay: ".unmutesticker @user after 10m" unblocks them in 10 minutes instead of right now.',
    usage: '.unmutesticker @user | .unmutesticker @user after <duration>',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m);
        if (!target) return await m.reply(`Tag a user or reply to their message.\nExample: ${bot.prefix}unmutesticker @user`);

        const key = muteStore._keyOf(target);
        const { ms } = extractDuration(args.filter(a => !a.startsWith('@')));

        // ── Delayed unblock: ".unmutesticker @user after 10m" / "... 10m" ───
        if (ms) {
            scheduler.cancelMatching({ type: 'unmutesticker', chat: m.chat, target: key });
            scheduler.schedule({ type: 'unmutesticker', dueAt: Date.now() + ms, chat: m.chat, target: key, issuedBy: m.sender });
            return await m.reply(`⏳ @${target.split('@')[0]}'s stickers will be unblocked in ${humanizeMs(ms)}.`, { mentions: [target] });
        }

        const existing = muteStore.getMute(target);
        if (!existing?.stickersOnly) {
            return await m.reply(`@${target.split('@')[0]}'s stickers aren't blocked.`, { mentions: [target] });
        }

        muteStore.clearMute(target);
        scheduler.cancelMatching({ type: 'unmutesticker', chat: m.chat, target: key });

        await bot.sendMessage(m.chat, {
            text: `✅ @${target.split('@')[0]}'s stickers are unblocked.`,
            mentions: [target]
        });
    }
};
