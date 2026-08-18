const axios = require('axios');

module.exports = {
    name: 'gppp',
    aliases: ['groupppp', 'groupppic'],
    category: 'group',
    reactions: { start: '📸' },
    description: "Send this group's profile picture to your DM.",
    groupOnly: true,

    async execute(bot, m) {
        try {
            const meta = await bot.sock.groupMetadata(m.chat);
            const url = await bot.sock.profilePictureUrl(m.chat, 'image');
            const res = await axios.get(url, { responseType: 'arraybuffer' });
            await bot.sendMessage(m.sender, {
                image: Buffer.from(res.data),
                caption: meta.subject || 'Group',
            });
            await m.reply('Sent to your DM.');
        } catch {
            await m.reply('This group has no profile picture.');
        }
    },
};
