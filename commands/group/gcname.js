module.exports = {
    name: 'gcname',
    aliases: ['setgcname'],
    category: 'group',
    description: 'Set the group name.',
    usage: '.gcname <new name>',
    groupOnly: true,
    adminOnly: true,

    async execute(bot, m, args) {
        const newName = args.join(' ').trim();
        if (!newName) return m.reply(`Usage: ${bot.prefix}gcname <new name>`);

        try {
            await bot.sock.groupUpdateSubject(m.chat, newName);
            await m.reply('Group name updated.');
        } catch (err) {
            await m.reply(`Failed: ${err.message}`);
        }
    },
};
