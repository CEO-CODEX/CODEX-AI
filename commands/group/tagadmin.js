module.exports = {
    name: 'tagadmin',
    aliases: ['admins'],
    category: 'group',
    reactions: { start: '👥', success: '📋' },
    description: 'Tag all group admins.',
    usage: '.tagadmin <message>',
    groupOnly: true,

    async execute(bot, m, args) {
        try {
            const meta = await bot.sock.groupMetadata(m.chat);
            const admins = meta.participants.filter(p => p.admin).map(p => p.id);
            const text = args.join(' ') || 'Calling all admins';

            const message = text + '\n' + admins.map(a => `@${a.split('@')[0]}`).join(' ');
            await bot.sendMessage(m.chat, { text: message, mentions: admins });
        } catch (err) {
            await m.reply(`Failed: ${err.message}`);
        }
    },
};
