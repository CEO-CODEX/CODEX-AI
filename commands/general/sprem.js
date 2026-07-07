const fs   = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { Sticker } = require('wa-sticker-formatter');
const { downloadContentFromMessage, getContentType } = require('../../lib/baileys');

module.exports = {
    name: 'sprem',
    aliases: ['stickerprem', 'spremium'],
    category: 'general',
    description: 'Reply to an image, video (1-5s), or sticker to send it as a premium 💎 sticker',

    async execute(bot, m, args) {
        // ── Resolve media source: a reply, or media sent directly with the cmd ─
        let mediaMsg  = null;
        let mediaType = null;

        const ctx       = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = ctx?.quotedMessage;

        if (quotedMsg) {
            let resolved = quotedMsg;
            for (const vt of ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']) {
                if (quotedMsg[vt]) { resolved = quotedMsg[vt]?.message || quotedMsg[vt]; break; }
            }
            mediaType = getContentType(resolved);
            mediaMsg  = resolved?.[mediaType];
        } else if (['imageMessage', 'videoMessage', 'stickerMessage'].includes(m.type)) {
            mediaType = m.type;
            mediaMsg  = m.msg;
        }

        const isSticker = mediaType === 'stickerMessage';
        const mime = mediaMsg?.mimetype || '';
        if (!mediaMsg || !(isSticker || /image|video/.test(mime))) {
            return await m.reply('⚉ Reply to an image, video, or sticker');
        }

        let input, output;

        try {
            const cat = mediaType === 'videoMessage'   ? 'video'
                      : mediaType === 'stickerMessage' ? 'sticker'
                      : 'image';

            const stream = await downloadContentFromMessage(mediaMsg, cat);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const media  = Buffer.concat(chunks);

            if (!media.length) return await m.reply('Download failed. Try again.');

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            input  = path.join(tempDir, `sprem_${Date.now()}`);
            output = input + '.webp';
            fs.writeFileSync(input, media);

            // Animated stickers need the multi-frame pipeline, same as video.
            const isAnimatedSticker = isSticker && !!mediaMsg.isAnimated;
            const useVideoPipeline  = cat === 'video' || isAnimatedSticker;

            // ================= VIDEO / ANIMATED STICKER =================
            if (useVideoPipeline) {
                if (cat === 'video') {
                    const duration = mediaMsg.seconds || 0;
                    if (duration < 1 || duration > 5) {
                        fs.unlinkSync(input);
                        return await m.reply('✘ Video must be between 1s and 5s');
                    }
                }

                const compressVideo = async (fps, quality) => {
                    const cmd = `ffmpeg -y -i "${input}" -t 5 -vf "fps=${fps},scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p" -c:v libwebp -lossless 0 -q:v ${quality} -loop 0 -an -preset default -compression_level 6 "${output}"`;
                    await new Promise((resolve, reject) => {
                        exec(cmd, (err) => err ? reject(err) : resolve());
                    });
                    return fs.statSync(output).size / 1024;
                };

                let sizeKB = await compressVideo(12, 70);
                if (sizeKB > 500) sizeKB = await compressVideo(8, 40);
                if (sizeKB > 500) {
                    fs.unlinkSync(input);
                    if (fs.existsSync(output)) fs.unlinkSync(output);
                    return await m.reply('✘ Too complex to fit WhatsApp sticker limit. Try something shorter/simpler.');
                }
            }
            // ================= STATIC IMAGE / STICKER =================
            else {
                const imageCmd = `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p" -c:v libwebp -lossless 0 -q:v 80 -an "${output}"`;
                await new Promise((resolve, reject) => {
                    exec(imageCmd, (err) => err ? reject(err) : resolve());
                });
            }

            // Read the generated WebP
            let buffer = fs.readFileSync(output);

            // Add metadata using wa-sticker-formatter
            const sticker = new Sticker(buffer, {
                pack:    bot.config.STICKER_PACKNAME || 'CODEX AI',
                author:  bot.config.STICKER_AUTHOR   || 'CODEX',
                type:    'full',
                quality: 70
            });
            buffer = await sticker.toBuffer();

            // Send as premium sticker — shows 💎 badge (crysnovax/baileys)
            await bot.sock.sendMessage(m.chat, {
                sticker: buffer,
                premium: 1
            }, { quoted: { key: m.key, message: m.message } });

            // Cleanup
            fs.unlinkSync(input);
            if (fs.existsSync(output)) fs.unlinkSync(output);

        } catch (e) {
            console.error('sprem error:', e);
            try { if (input && fs.existsSync(input)) fs.unlinkSync(input); } catch {}
            try { if (output && fs.existsSync(output)) fs.unlinkSync(output); } catch {}
            await m.reply(`✘ Failed: ${e.message}`);
        }
    }
};
