

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const sharp = require('sharp');
const { downloadContentFromMessage } = require('@codexverified/baileys');

module.exports = {
    name: 'togif',
    aliases: ['sticker2gif', 'stktogif'],
    category: 'Media',
    description: 'Convert sticker to GIF with watermark',
    reactions: { start: '⏳' }, // <-- Right here at the top!

    async execute(bot, m, args) {
        try {
            const ctx =
                m.message?.extendedTextMessage?.contextInfo ||
                m.message?.imageMessage?.contextInfo ||
                m.message?.videoMessage?.contextInfo ||
                m.message?.stickerMessage?.contextInfo ||
                m.message?.documentMessage?.contextInfo ||
                m.message?.audioMessage?.contextInfo || null;

            const quotedMessage = ctx?.quotedMessage;

            if (!quotedMessage) {
                return m.reply('❌ Reply to a sticker, image, or video');
            }

            const hasSticker = quotedMessage.stickerMessage;
            const hasImage = quotedMessage.imageMessage;
            const hasVideo = quotedMessage.videoMessage;

            if (!hasSticker && !hasImage && !hasVideo) {
                return m.reply('❌ Reply to a sticker, image, or video');
            }

            await m.reply('⏳ Converting to GIF...');

            let mediaBuffer = null;
            try {
                if (hasImage) {
                    const stream = await downloadContentFromMessage(quotedMessage.imageMessage, 'image');
                    const chunks = [];
                    for await (const chunk of stream) chunks.push(chunk);
                    mediaBuffer = Buffer.concat(chunks);
                } else if (hasVideo) {
                    const stream = await downloadContentFromMessage(quotedMessage.videoMessage, 'video');
                    const chunks = [];
                    for await (const chunk of stream) chunks.push(chunk);
                    mediaBuffer = Buffer.concat(chunks);
                } else if (hasSticker) {
                    const stream = await downloadContentFromMessage(quotedMessage.stickerMessage, 'sticker');
                    const chunks = [];
                    for await (const chunk of stream) chunks.push(chunk);
                    mediaBuffer = Buffer.concat(chunks);
                }

                if (!mediaBuffer || mediaBuffer.length === 0) {
                    await bot.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
                    return m.reply('❌ Cannot download media');
                }
            } catch (err) {
                console.error('[media download]', err.message);
                await bot.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
                return m.reply('❌ Failed to download media');
            }

            const isVideo = hasVideo;
            let metadata = null;
            let isAnimated = false;
            
            try {
                metadata = await sharp(mediaBuffer).metadata();
                isAnimated = (metadata.pages && metadata.pages > 1) || isVideo;
            } catch (err) {
                console.error('[metadata]', err.message);
                isAnimated = isVideo;
                metadata = { pages: 1, delay: [100] };
            }
            
            const tempDir = path.join(process.cwd(), 'temp');

            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            if (isAnimated) {
                try {
                    const frameDir = path.join(tempDir, `frames_${Date.now()}`);
                    const outputPath = path.join(tempDir, `gif_${Date.now()}.mp4`);

                    fs.mkdirSync(frameDir, { recursive: true });

                    const frames = [];
                    for (let i = 0; i < (metadata.pages || 1); i++) {
                        const frameFile = path.join(frameDir, `frame_${String(i).padStart(4, '0')}.png`);
                        frames.push(
                            sharp(mediaBuffer, { page: i })
                                .resize(512, 512, { fit: 'cover' })
                                .png()
                                .toFile(frameFile)
                        );
                    }

                    await Promise.all(frames);

                    const delay = metadata.delay?.[0] || 100;
                    const fps = Math.max(10, Math.min(30, Math.round(1000 / delay)));

                    const cmd = `ffmpeg -y -framerate ${fps} -i "${frameDir}/frame_%04d.png" -vf "scale=512:-1:flags=lanczos,drawtext=text='CODEX':x=(w-text_w)/2:y=(h-text_h)-20:fontsize=20:fontcolor=white@0.7:borderw=1:bordercolor=black@0.8" -loop 0 -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "${outputPath}"`;

                    await new Promise((resolve, reject) => {
                        exec(cmd, (err) => {
                            if (err) {
                                console.error('[ffmpeg]', err.message);
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });

                    const buffer = fs.readFileSync(outputPath);
                    await bot.sendMessage(m.chat, {
                        video: buffer,
                        gifPlayback: true,
                        caption: '✅ CODEX GIF Generated'
                    }, { quoted: m });

                    // Success reaction 
                    await bot.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});

                    fs.rmSync(frameDir, { recursive: true, force: true });
                    fs.unlinkSync(outputPath);

                } catch (err) {
                    console.error('[animated conversion]', err.message);
                    await bot.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
                    return m.reply('❌ Failed to convert animated sticker');
                }

            } else {
                try {
                    const img = await sharp(mediaBuffer)
                        .resize(512, 512, { fit: 'cover' })
                        .png()
                        .toBuffer();

                    await bot.sendMessage(m.chat, {
                        image: img,
                        caption: '✅ Sticker converted to Image'
                    }, { quoted: m });

                    // Success reaction 
                    await bot.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});

                } catch (err) {
                    console.error('[static conversion]', err.message);
                    await bot.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
                    return m.reply('❌ Failed to convert static sticker');
                }
            }

        } catch (err) {
            console.error('[togif]', err.message);
            await bot.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
            m.reply('❌ Conversion failed');
        }
    }
};
