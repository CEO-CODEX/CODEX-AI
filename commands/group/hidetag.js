module.exports = {
    name: 'hidetag',
    aliases: ['htag', 'silenttag'],
    category: 'group',
    description: 'Tag everyone without listing names.',
    usage: '.hidetag <message>',
    groupOnly: true,
    adminOnly: true,

    async execute(bot, m, args) {
        try {
            const meta = await bot.sock.groupMetadata(m.chat);
            const participants = meta.participants.map(p => p.id);
            const text = args.join(' ') || 'Attention everyone';

            await bot.sendMessage(m.chat, { text, mentions: participants });
        } catch (err) {
            await m.reply(`Failed: ${err.message}`);
        }
    },
};
