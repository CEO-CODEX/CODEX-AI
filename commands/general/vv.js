const { getContentType, downloadContentFromMessage } = require('../../lib/baileys');

module.exports = {
    name: 'vv',
    aliases: ['viewonce', 'reveal'],
    category: 'general',
    description: 'Decrypt a view-once message and send it in this chat',

    async execute(bot, m, args) {
        // Get the quoted message context
        const ctx = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = ctx?.quotedMessage;

        if (!quotedMsg) {
            return await m.reply(
`VV - View Once Decryptor

Reply to a view-once message with ${bot.prefix}vv to decrypt it here.
Use ${bot.prefix}vvp to send to your DM instead.`
            );
        }

        try {
            // Unwrap view-once from quoted message
            let mediaMsg = null;
            let mediaType = null;

            // All view-once variants
            const voTypes = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'];
            for (const vt of voTypes) {
                if (quotedMsg[vt]) {
                    const inner = quotedMsg[vt]?.message || quotedMsg[vt];
                    mediaType   = getContentType(inner);
                    mediaMsg    = inner?.[mediaType];
                    break;
                }
            }

            // Also handle if the message itself is a direct media (non-view-once reply)
            if (!mediaMsg) {
                mediaType = getContentType(quotedMsg);
                mediaMsg  = quotedMsg?.[mediaType];
            }

            if (!mediaMsg) return await m.reply('Could not read the view-once message. Make sure you reply to it directly.');

            const caption = 'DECRYPTED VIA CODEX AI';

            // Download and re-upload
            const stream = await downloadContentFromMessage(mediaMsg, mediaType.replace('Message', ''));
            let buffer = Buffer.alloc(0);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            if (mediaType === 'imageMessage') {
                await bot.sendMessage(m.chat, { image: buffer, caption });
            } else if (mediaType === 'videoMessage') {
                await bot.sendMessage(m.chat, { video: buffer, caption, gifPlayback: false });
            } else if (mediaType === 'audioMessage') {
                await bot.sendMessage(m.chat, {
                    audio: buffer,
                    mimetype: mediaMsg.mimetype || 'audio/ogg; codecs=opus',
                    ptt: mediaMsg.ptt !== undefined ? mediaMsg.ptt : true,
                    caption
                });
            } else {
                await m.reply('Unsupported media type: ' + mediaType);
            }

        } catch (err) {
            console.error('vv error:', err);
            await m.reply('Failed to decrypt view-once: ' + err.message);
        }
    }
};
