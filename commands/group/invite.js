const { prepareWAMessageMedia, generateMessageIDV2 } = require('@crysnovax/baileys');

module.exports = {
    name: 'invite',
    alias: ['grouplink', 'glink'],
    category: 'Group',
    reactions: { start: '👥' },
    groupOnly: true,
    adminOnly: true,

    async execute(bot, m, args) {
        try {
            if (!m.isGroup) {
                return await bot.sock.sendMessage(m.chat, { 
                    text: '`❖ GROUP ONLY!`' 
                }, { quoted: m });
            }

            const meta = await bot.sock.groupMetadata(m.chat);
            const groupName = meta.subject;

            // ── Get invite code ───────────────────────
            let inviteCode;
            try {
                inviteCode = await bot.sock.groupInviteCode(m.chat);
            } catch (err) {
                return await bot.sock.sendMessage(m.chat, { 
                    text: '`❖ I need admin rights to generate the group link`' 
                }, { quoted: m });
            }

            const inviteLink = `https://chat.whatsapp.com/${inviteCode}?mode=gi_t`;

            // ── Get group photo URL ───────────────────
            let photoUrl = null;
            try {
                photoUrl = await bot.sock.profilePictureUrl(m.chat, 'image');
            } catch {}

            // ── Upload via mediaTypeOverride:'thumbnail-link' ──
            let hq = null;
            let smallThumb = null;
            if (photoUrl) {
                try {
                    const prepared = await prepareWAMessageMedia(
                        { image: { url: photoUrl } },
                        { upload: bot.sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
                    );
                    hq = prepared.imageMessage;
                    smallThumb = hq?.jpegThumbnail ? Buffer.from(hq.jpegThumbnail) : null;
                } catch (err) {
                    console.error('HQ THUMB UPLOAD ERROR:', err);
                }
            }

            // ── Build proto and relay directly ────────
            const message = {
                extendedTextMessage: {
                    text: inviteLink,
                    matchedText: inviteLink,
                    canonicalUrl: inviteLink,
                    title: groupName,
                    description: `${meta.participants.length} members · WhatsApp Group Invite`,
                    previewType: 5, // IMAGE
                    jpegThumbnail: smallThumb || undefined,
                    ...(hq
                        ? {
                            thumbnailDirectPath: hq.directPath,
                            mediaKey: hq.mediaKey,
                            mediaKeyTimestamp: hq.mediaKeyTimestamp,
                            thumbnailWidth: hq.width,
                            thumbnailHeight: hq.height,
                            thumbnailSha256: hq.fileSha256,
                            thumbnailEncSha256: hq.fileEncSha256
                        }
                        : {})
                }
            };

            const messageId = generateMessageIDV2(bot.sock.user.id);
            await bot.sock.relayMessage(m.chat, message, { messageId });

        } catch (e) {
            console.error('GLINK ERROR:', e);
            return await bot.sock.sendMessage(m.chat, { 
                text: `\`☒ Error: ${e.message}\`` 
            }, { quoted: m });
        }
    }
};
                  
