const { downloadContentFromMessage, getContentType } = require('../../lib/baileys');

let sharp = null;
try { sharp = require('sharp'); } catch {}

module.exports = {
    name: 'sticker',
    aliases: ['s', 'take', 'steal'],
    category: 'general',
    description: 'Convert image/video/GIF to sticker or steal a sticker pack info',

    async execute(bot, m, args) {
        const packname = bot.config.STICKER_PACKNAME || 'CODEX AI';
        const author   = bot.config.STICKER_AUTHOR   || 'CODEX';

        // ── Resolve media source ─────────────────────────────────────────────
        let mediaMsg  = null;
        let mediaType = null;

        const ctx       = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = ctx?.quotedMessage;

        if (quotedMsg) {
            let resolved = quotedMsg;
            for (const vt of ['viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension']) {
                if (quotedMsg[vt]) { resolved = quotedMsg[vt]?.message || quotedMsg[vt]; break; }
            }
            mediaType = getContentType(resolved);
            mediaMsg  = resolved?.[mediaType];
        } else if (['imageMessage','videoMessage','stickerMessage'].includes(m.type)) {
            mediaType = m.type;
            mediaMsg  = m.msg;
        }

        if (!mediaMsg || !mediaType) {
            return await m.reply(
`STICKER MAKER

Send or reply to an image, video, GIF or sticker with ${bot.prefix}sticker

Pack: ${packname}
Author: ${author}

Change:
${bot.prefix}setvar STICKER_PACKNAME=your pack name
${bot.prefix}setvar STICKER_AUTHOR=your name`
            );
        }

        try {
            const cat = mediaType === 'imageMessage'   ? 'image'
                      : mediaType === 'videoMessage'   ? 'video'
                      : mediaType === 'stickerMessage' ? 'sticker'
                      : 'image';

            const stream = await downloadContentFromMessage(mediaMsg, cat);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);

            if (!buffer.length) return await m.reply('Download failed. Try again.');

            let stickerBuf;

            if (mediaType === 'stickerMessage') {
                // Re-pack existing sticker with our metadata
                stickerBuf = injectStickerExif(buffer, packname, author);
            } else if (mediaType === 'imageMessage' && sharp) {
                const webp = await sharp(buffer)
                    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .webp({ quality: 90 })
                    .toBuffer();
                stickerBuf = injectStickerExif(webp, packname, author);
            } else {
                // No sharp / video: send raw, WhatsApp handles basic formats
                stickerBuf = buffer;
            }

            await bot.sock.sendMessage(m.chat, { sticker: stickerBuf });

        } catch (err) {
            console.error('sticker error:', err);
            await m.reply('Failed: ' + err.message);
        }
    }
};

/**
 * Inject WhatsApp sticker EXIF metadata (packname + author).
 * Uses the correct EXIF structure that WhatsApp actually reads.
 */
function injectStickerExif(webpBuf, packname, author) {
    // Validate WebP
    if (!webpBuf || webpBuf.length < 12) return webpBuf;
    if (webpBuf.slice(0, 4).toString('ascii') !== 'RIFF') return webpBuf;
    if (webpBuf.slice(8, 12).toString('ascii') !== 'WEBP') return webpBuf;

    // Build the JSON payload
    const json = JSON.stringify({
        'sticker-pack-id':        `com.codexai.${Date.now()}`,
        'sticker-pack-name':      packname,
        'sticker-pack-publisher': author,
        'android-app-store-link': '',
        'ios-app-store-link':     '',
        'emojis':                 ['🤖'],
        'is-avatar-sticker':      0
    });
    const jsonBuf = Buffer.from(json, 'utf8');

    // Build proper EXIF/IFD structure for WhatsApp sticker metadata
    // IFD entry: tag 0x8741 (UserComment), type UNDEFINED (7), value = JSON bytes
    const ifdEntryCount  = 1;
    const ifdEntrySize   = 12; // each IFD entry = 12 bytes
    const ifdOffset      = 8;  // TIFF header = 8 bytes
    const valueOffset    = ifdOffset + 2 + (ifdEntryCount * ifdEntrySize) + 4; // after IFD + next-IFD ptr

    const tiffHeader = Buffer.alloc(8);
    tiffHeader.writeUInt16LE(0x4949, 0); // "II" = little-endian
    tiffHeader.writeUInt16LE(0x002A, 2); // TIFF magic
    tiffHeader.writeUInt32LE(ifdOffset, 4); // offset to first IFD

    const ifdCountBuf = Buffer.alloc(2);
    ifdCountBuf.writeUInt16LE(ifdEntryCount, 0);

    const ifdEntry = Buffer.alloc(12);
    ifdEntry.writeUInt16LE(0x8741, 0);           // tag: UserComment (WhatsApp sticker tag)
    ifdEntry.writeUInt16LE(7,      2);           // type: UNDEFINED
    ifdEntry.writeUInt32LE(jsonBuf.length, 4);   // count: byte length
    ifdEntry.writeUInt32LE(valueOffset, 8);      // value offset

    const nextIFD = Buffer.alloc(4); // 0x00000000 = no next IFD

    const exifData = Buffer.concat([tiffHeader, ifdCountBuf, ifdEntry, nextIFD, jsonBuf]);

    // Pad to even length (WebP chunk size must be even)
    const paddedExif = exifData.length % 2 === 0
        ? exifData
        : Buffer.concat([exifData, Buffer.alloc(1)]);

    // Build EXIF chunk: "EXIF" + 4-byte size LE + data
    const chunkId   = Buffer.from('EXIF');
    const chunkSize = Buffer.alloc(4);
    chunkSize.writeUInt32LE(exifData.length, 0); // actual size (not padded)
    const exifChunk = Buffer.concat([chunkId, chunkSize, paddedExif]);

    // Update RIFF file size
    const origRiffSize = webpBuf.readUInt32LE(4);
    const newSizeBuf   = Buffer.alloc(4);
    newSizeBuf.writeUInt32LE(origRiffSize + exifChunk.length, 0);

    return Buffer.concat([
        webpBuf.slice(0, 4),   // "RIFF"
        newSizeBuf,             // updated file size
        webpBuf.slice(8),       // "WEBP" + original chunks
        exifChunk               // appended EXIF chunk
    ]);
}
