const { downloadContentFromMessage, getContentType } = require('../../lib/baileys');
const { getQuoted } = require('../../lib/getQuoted');

module.exports = {
    name: 'setgpp',
    aliases: ['setgrouppp', 'setppgroup'],
    category: 'group',
    description: 'Set the group profile picture (reply to an image).',
    groupOnly: true,
    adminOnly: true,

    async execute(bot, m) {
        const quoted = getQuoted(bot, m);
        const type = quoted ? getContentType(quoted.message) : null;
        if (!quoted || type !== 'imageMessage') {
            return m.reply(`Reply to an image.\nUsage: ${bot.prefix}setgpp`);
        }

        try {
            const stream = await downloadContentFromMessage(quoted.message[type], 'image');
            let buffer = Buffer.alloc(0);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            await bot.sock.updateProfilePicture(m.chat, buffer);
            await m.reply('Group profile picture updated.');
        } catch (err) {
            await m.reply(`Failed: ${err.message}`);
        }
    },
};
