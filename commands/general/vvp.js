const { getContentType, downloadContentFromMessage } = require('../../lib/baileys');

module.exports = {
    name: 'vvp',
    aliases: ['viewoncedm', 'revealdm'],
    category: 'general',
    description: 'Decrypt a view-once message and send it to owner DM',

    async execute(bot, m, args) {
        const ctx = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = ctx?.quotedMessage;

        if (!quotedMsg) {
            return await m.reply(
`VVP - View Once to DM

Reply to a view-once message with ${bot.prefix}vvp to receive it in your DM privately.`
            );
        }

        try {
            let mediaMsg = null;
            let mediaType = null;

            const voTypes = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'];
            for (const vt of voTypes) {
                if (quotedMsg[vt]) {
                    const inner = quotedMsg[vt]?.message || quotedMsg[vt];
                    mediaType   = getContentType(inner);
                    mediaMsg    = inner?.[mediaType];
                    break;
                }
            }

            if (!mediaMsg) {
                mediaType = getContentType(quotedMsg);
                mediaMsg  = quotedMsg?.[mediaType];
            }

            if (!mediaMsg) return await m.reply('Could not read the view-once message. Make sure you reply to it directly.');

            const ownerDM = bot.config.owner.number;
            const caption = 'DECRYPTED VIA CODEX AI';

            const stream = await downloadContentFromMessage(mediaMsg, mediaType.replace('Message', ''));
            let buffer = Buffer.alloc(0);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            if (mediaType === 'imageMessage') {
                await bot.sendMessage(ownerDM, { image: buffer, caption });
            } else if (mediaType === 'videoMessage') {
                await bot.sendMessage(ownerDM, { video: buffer, caption, gifPlayback: false });
            } else if (mediaType === 'audioMessage') {
                await bot.sendMessage(ownerDM, {
                    audio: buffer,
                    mimetype: mediaMsg.mimetype || 'audio/ogg; codecs=opus',
                    ptt: mediaMsg.ptt !== undefined ? mediaMsg.ptt : true,
                    caption
                });
            } else {
                return await m.reply('Unsupported media type: ' + mediaType);
            }

            await m.reply('VIEW ONCE SENT TO YOUR DM');
        } catch (err) {
            console.error('vvp error:', err);
            await m.reply('Failed: ' + err.message);
        }
    }
};
