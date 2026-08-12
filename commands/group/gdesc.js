module.exports = {
    name: 'gdesc',
    aliases: ['setdescription'],
    category: 'group',
    description: 'Set the group description.',
    usage: '.gdesc <text>',
    groupOnly: true,
    adminOnly: true,

    async execute(bot, m, args) {
        const text = args.join(' ').trim();
        if (!text) return m.reply(`Usage: ${bot.prefix}gdesc <text>`);

        try {
            await bot.sock.groupUpdateDescription(m.chat, text);
            await m.reply('Group description updated.');
        } catch (err) {
            await m.reply(`Failed: ${err.message}`);
        }
    },
};
