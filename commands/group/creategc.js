module.exports = {
    name: 'creategc',
    aliases: ['creategroup', 'newgc', 'newgroup'],
    category: 'group',
    reactions: { start: '👥', success: '📋' },
    description: 'Create a new WhatsApp group.',
    usage: '.creategc <name>',
    ownerOnly: true,

    async execute(bot, m, args) {
        const groupName = args.join(' ').trim();
        if (!groupName) return m.reply(`Usage: ${bot.prefix}creategc <group name>`);

        try {
            const result = await bot.sock.groupCreate(groupName, []);
            const groupJid = result.id || result.gid;

            let link = null;
            try {
                const code = await bot.sock.groupInviteCode(groupJid);
                link = `https://chat.whatsapp.com/${code}`;
            } catch {}

            await m.reply(`Group "${result.subject}" created.${link ? `\n${link}` : ''}`);
        } catch (err) {
            await m.reply(`Failed to create group: ${err.message}`);
        }
    },
};
