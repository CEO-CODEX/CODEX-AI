module.exports = {
    name: 'exit',
    aliases: ['leavegc'],
    category: 'group',
    description: 'Leave the current group.',
    groupOnly: true,
    ownerOnly: true,

    async execute(bot, m) {
        try {
            await m.reply('Leaving group.');
            await bot.sock.groupLeave(m.chat);
        } catch (err) {
            await m.reply(`Failed to leave: ${err.message}`);
        }
    },
};
