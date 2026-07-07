const { getTarget } = require('../../lib/getTarget');

module.exports = {
    name: 'kick',
    aliases: ['remove', 'k'],
    category: 'admin',
    description: 'Kick a user. Tag them or reply to their message.',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m);
        if (!target) return await m.reply(`Tag a user or reply to their message.\nExample: ${bot.prefix}kick @user`);

        try {
            await bot.sock.groupParticipantsUpdate(m.chat, [target], 'remove');
            await bot.sendMessage(m.chat, {
                text: `✅ @${target.split('@')[0]} has been removed from the group.`,
                mentions: [target]
            });
        } catch (err) {
            await m.reply(`❌ Failed to kick: ${err.message}`);
        }
    }
};
