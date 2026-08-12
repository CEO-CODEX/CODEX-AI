module.exports = {
    name: 'delgdesc',
    aliases: ['deletedescription'],
    category: 'group',
    description: 'Clear the group description.',
    groupOnly: true,
    adminOnly: true,

    async execute(bot, m) {
        try {
            await bot.sock.groupUpdateDescription(m.chat, '');
            await m.reply('Group description cleared.');
        } catch (err) {
            await m.reply(`Failed: ${err.message}`);
        }
    },
};
