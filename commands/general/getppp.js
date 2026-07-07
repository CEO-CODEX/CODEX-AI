const { getTarget } = require('../../lib/getTarget');
module.exports = {
    name: 'getppp',
    aliases: ['ppdm', 'profilepicdm'],
    category: 'general',
    description: 'Get a user profile picture and send it to owner DM',

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
            const ppUrl   = await bot.sock.profilePictureUrl(target, 'image');
            const ownerDM = bot.config.owner.number;
            await bot.sendMessage(ownerDM, {
                image:   { url: ppUrl },
                caption: `EXTRACTED VIA CODEX AI\n\nUser: @${target.split('@')[0]}`,
                mentions: [target]
            });
            await m.reply('PROFILE PICTURE SENT TO YOUR DM');
        } catch {
            await m.reply(`Could not fetch profile picture for @${target.split('@')[0]}.\nThey may have hidden it.`);
        }
    }
};
