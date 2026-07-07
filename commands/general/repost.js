const { downloadContentFromMessage, getContentType } = require('../../lib/baileys');

module.exports = {
    name: 'repost',
    aliases: ['resend'],
    description: 'Repost a replied message to another chat/group/number',
    usage: '.repost <number|group-invite-link|wa.me link>',
    category: 'general',

    async execute(bot, m, args) {
        const ctx       = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = ctx?.quotedMessage;

        if (!quotedMsg) return await m.reply('⊘ Reply to a message first.');

        if (!args[0]) {
            return await m.reply(
                '⊘ Provide target chat!\n\n' +
                'Examples:\n' +
                `• ${bot.prefix}repost 2348xxxx@s.whatsapp.net\n` +
                `• ${bot.prefix}repost https://chat.whatsapp.com/xxxxx\n` +
                `• ${bot.prefix}repost https://wa.me/2348xxxx`
            );
        }

        let target = args[0];
        try {
            if (target.includes('chat.whatsapp.com')) {
                const code = target.split('chat.whatsapp.com/')[1].split('?')[0];
                const info = await bot.sock.groupGetInviteInfo(code);
                target = info?.id;
                if (!target) return await m.reply('⊘ Could not resolve group JID.');
            } else if (target.includes('wa.me/')) {
                const num = target.split('wa.me/')[1].split('?')[0];
                target = `${num}@s.whatsapp.net`;
            } else if (!target.includes('@')) {
                target = `${target}@s.whatsapp.net`;
            }
        } catch (e) {
            return await m.reply('⊘ Invalid link or expired invite.');
        }

        // ── Resolve the quoted message (handle the view-once wrapper too) ────
        let resolved = quotedMsg;
        for (const vt of ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']) {
            if (quotedMsg[vt]) { resolved = quotedMsg[vt]?.message || quotedMsg[vt]; break; }
        }
        const mtype    = getContentType(resolved);
        const mediaMsg = resolved?.[mtype];
        const text     = resolved?.conversation || resolved?.extendedTextMessage?.text || mediaMsg?.caption || '';

        const catMap = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio', stickerMessage: 'sticker', documentMessage: 'document' };
        const cat = catMap[mtype];

        let media = null;
        if (cat) {
            try {
                const stream = await downloadContentFromMessage(mediaMsg, cat);
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                media = Buffer.concat(chunks);
            } catch (e) {
                return await m.reply('⊘ Failed to download media.');
            }
            if (!media || !media.length) return await m.reply('⊘ Media download returned empty buffer.');
        }

        try {
            if (mtype === 'imageMessage') {
                await bot.sock.sendMessage(target, { image: media, caption: mediaMsg.caption || '' });
            } else if (mtype === 'videoMessage') {
                await bot.sock.sendMessage(target, { video: media, caption: mediaMsg.caption || '' });
            } else if (mtype === 'audioMessage') {
                await bot.sock.sendMessage(target, { audio: media, ptt: mediaMsg.ptt || false, mimetype: mediaMsg.mimetype || 'audio/ogg; codecs=opus' });
            } else if (mtype === 'stickerMessage') {
                // Auto-upgrade stickers to premium 💎 (crysnovax/baileys)
                await bot.sock.sendMessage(target, { sticker: media, premium: 1 });
            } else if (mtype === 'documentMessage') {
                await bot.sock.sendMessage(target, { document: media, mimetype: mediaMsg.mimetype || 'application/octet-stream', fileName: mediaMsg.fileName || 'repost-file' });
            } else if (text) {
                await bot.sock.sendMessage(target, { text });
            } else {
                return await m.reply('⊘ Unsupported message type.');
            }
            // (Deliberately silent on success, like the source version.)
        } catch (e) {
            console.error('REPOST ERROR:', e);
            return await m.reply(`⊘ Failed to repost: ${e.message}`);
        }
    }
};
