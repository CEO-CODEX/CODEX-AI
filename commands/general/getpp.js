const { getTarget } = require('../../lib/getTarget');
module.exports = {
    name: 'getpp',
    aliases: ['pp', 'profilepic'],
    category: 'general',
    description: 'Get a user profile picture and send it in this chat',

    async execute(bot, m, args) {
        let target = null;
        if (m.mentions && m.mentions.length > 0) {
            target = m.mentions[0];
        } else if (m.msg?.contextInfo?.participant) {
            target = m.msg.contextInfo.participant.replace(/:[0-9]+@/, '@');
        } else if (args[0]) {
            target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        } else {
            target = m.sender;
        }

        try {
            const ppUrl = await bot.sock.profilePictureUrl(target, 'image');
            await bot.sendMessage(m.chat, {
                image:   { url: ppUrl },
                caption: 'EXTRACTED VIA CODEX AI',
                mentions: [target]
            });
        } catch {
            await m.reply(`Could not fetch profile picture for @${target.split('@')[0]}.\nThey may have hidden it.`);
        }
    }
};
