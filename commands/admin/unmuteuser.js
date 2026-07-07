const { getTarget } = require('../../lib/getTarget');
const muteStore = require('../../lib/muteStore');
const scheduler = require('../../lib/scheduler');
const { extractDuration, humanizeMs } = require('../../lib/duration');

module.exports = {
    name: 'unmuteuser',
    aliases: ['unmute'],
    category: 'admin',
    description: 'Unmute a user. Optional delay: ".unmuteuser @user after 10m" unmutes them in 10 minutes instead of right now.',
    usage: '.unmuteuser @user | .unmuteuser @user after <duration>',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m);
        if (!target) return await m.reply(`Tag a user or reply to their message.\nExample: ${bot.prefix}unmuteuser @user`);

        const key = muteStore._keyOf(target);
        const { isAfter, ms } = extractDuration(args.filter(a => !a.startsWith('@')));

        // ── Delayed unmute: ".unmuteuser @user after 10m" / ".unmuteuser @user 10m" ──
        if (ms) {
            scheduler.cancelMatching({ type: 'unmuteuser', chat: m.chat, target: key });
            scheduler.schedule({ type: 'unmuteuser', dueAt: Date.now() + ms, chat: m.chat, target: key, issuedBy: m.sender });
            return await m.reply(`⏳ @${target.split('@')[0]} will be unmuted in ${humanizeMs(ms)}.`, { mentions: [target] });
        }

        const existing = muteStore.getMute(target);
        if (!existing) {
            return await m.reply(`@${target.split('@')[0]} isn't muted.`, { mentions: [target] });
        }

        muteStore.clearMute(target);
        scheduler.cancelMatching({ type: 'unmuteuser', chat: m.chat, target: key }); // a manual unmute cancels any pending scheduled one

        await bot.sendMessage(m.chat, {
            text: `🔊 @${target.split('@')[0]} has been unmuted.`,
            mentions: [target]
        });
    }
};
