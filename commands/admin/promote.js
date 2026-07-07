const { getTarget } = require('../../lib/getTarget');

module.exports = {
    name: 'promote',
    aliases: ['admin', 'makeadmin'],
    category: 'admin',
    description: 'Promote a user to admin. Tag them or reply to their message.',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m);
        if (!target) return await m.reply(`Tag a user or reply to their message.\nExample: ${bot.prefix}promote @user`);

        try {
            await bot.sock.groupParticipantsUpdate(m.chat, [target], 'promote');
            await bot.sendMessage(m.chat, {
                text: `✅ @${target.split('@')[0]} is now an admin.`,
                mentions: [target]
            });
        } catch (err) {
            await m.reply(`❌ Failed to promote: ${err.message}`);
        }
    }
};
