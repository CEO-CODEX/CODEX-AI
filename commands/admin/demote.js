const { getTarget } = require('../../lib/getTarget');

module.exports = {
    name: 'demote',
    aliases: ['unadmin', 'removeadmin'],
    category: 'admin',
    description: 'Demote an admin to member. Tag them or reply to their message.',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m);
        if (!target) return await m.reply(`Tag a user or reply to their message.\nExample: ${bot.prefix}demote @user`);

        try {
            await bot.sock.groupParticipantsUpdate(m.chat, [target], 'demote');
            await bot.sendMessage(m.chat, {
                text: `✅ @${target.split('@')[0]} has been demoted to member.`,
                mentions: [target]
            });
        } catch (err) {
            await m.reply(`❌ Failed to demote: ${err.message}`);
        }
    }
};
