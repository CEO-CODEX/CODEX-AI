const axios = require('axios');

function quotedText(m) {
    const qm = m.msg?.contextInfo?.quotedMessage;
    return qm?.conversation || qm?.extendedTextMessage?.text
        || qm?.imageMessage?.caption || qm?.videoMessage?.caption || '';
}

module.exports = {
    name: 'tiktok',
    aliases: ['tt', 'tiktokdl', 'ttdl'],
    category: 'downloader',
    reactions: { start: '📥' },
    description: 'Download TikTok video without watermark',

    async execute(bot, m, args) {
        let url = args[0]?.trim();
        const prefix = bot.prefix || '.';

        // Check if replying to a message with a TikTok URL
        if (!url || !url.includes('tiktok.com')) {
            const match = quotedText(m).match(/(https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/[^\s]+)/);
            if (match) url = match[0];
        }

        if (!url || !url.includes('tiktok.com')) {
            return await m.reply(
                'Provide a valid TikTok URL!\n\n' +
                'Example:\n' +
                `${prefix}tt https://www.tiktok.com/@user/video/123456789\n` +
                `${prefix}tt https://vt.tiktok.com/ZSxxxxxx/\n\n` +
                'Or reply to a message with a TikTok link.'
            );
        }

        // Send a simple plain waiting message
        await m.reply('Downloading TikTok video...');

        const apis = [
            async () => {
                const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
                    timeout: 45000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const data = res.data?.data;
                return {
                    video: data?.play,
                    music: data?.music,
                    title: data?.title,
                    author: data?.author?.unique_id,
                    likes: data?.digg_count
                };
            },
            async () => {
                const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, {
                    timeout: 45000
                });
                const data = res.data;
                return {
                    video: data?.video?.noWatermark,
                    music: data?.music?.play,
                    title: data?.title,
                    author: data?.author?.unique_id,
                    likes: data?.stats?.likeCount
                };
            },
            async () => {
                const res = await axios.get(`https://tiktokdownload.online/api/tiktok?url=${encodeURIComponent(url)}`, {
                    timeout: 45000
                });
                return {
                    video: res.data?.data?.play
                };
            }
        ];

        let result = null;

        for (const api of apis) {
            try {
                const data = await api();
                if (data?.video) {
                    result = data;
                    break;
                }
            } catch (err) {
                console.log('[TIKTOK API FAILED]', err.response?.status || err.message);
            }
        }

        if (!result || !result.video) {
            return await m.reply('All APIs failed. Try again later.');
        }

        const caption = 
            `*TikTok Downloader*\n\n` +
            `Title: ${result.title || 'Untitled'}\n` +
            `Author: @${result.author || 'Unknown'}\n` +
            `Likes: ${result.likes || 'N/A'}`;

        // Send the downloaded video
        await bot.sendMessage(m.chat, {
            video: { url: result.video },
            mimetype: 'video/mp4',
            caption: caption,
            fileName: 'tiktok.mp4'
        }, { quoted: m });

        // Send the extracted audio if available
        if (result.music) {
            await bot.sendMessage(m.chat, {
                audio: { url: result.music },
                mimetype: 'audio/mp4'
            }, { quoted: m });
        }
    }
};
                  
