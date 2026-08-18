const axios = require('axios');

const GATEWAY_URL = process.env.GATEWAY_URL || 'https://api.crysnovax.link';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';

function quotedText(m) {
    const qm = m.msg?.contextInfo?.quotedMessage;
    return qm?.conversation || qm?.extendedTextMessage?.text
        || qm?.imageMessage?.caption || qm?.videoMessage?.caption || '';
}

function findVideoUrl(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const candidates = [
        obj?.result?.hd, obj?.result?.sd, obj?.hd, obj?.sd,
        obj?.url, obj?.video, obj?.link, obj?.download_url,
        obj?.data?.hd, obj?.data?.sd, obj?.data?.url,
        obj?.respon?.url, obj?.response?.url,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c.startsWith('http')) return c;
    }
    for (const v of Object.values(obj)) {
        if (typeof v === 'string' && v.startsWith('http') && v.includes('.mp4')) return v;
        if (v && typeof v === 'object') {
            const nested = findVideoUrl(v);
            if (nested) return nested;
        }
    }
    return null;
}

module.exports = {
    name: 'fb',
    aliases: ['facebook', 'fbdown'],
    category: 'downloader',
    reactions: { start: '⬇️', success: '📥' },
    description: 'Download a Facebook video.',
    usage: '.fb <Facebook URL> (or reply to a message containing one)',

    async execute(bot, m, args) {
        let url = args[0]?.trim();

        if (!url || !url.includes('facebook.com')) {
            const match = quotedText(m).match(/(https?:\/\/[^\s]+facebook\.com[^\s]*)/i);
            if (match) url = match[0];
        }

        if (!url || !url.includes('facebook.com')) {
            return m.reply(`Usage: ${bot.prefix}fb <Facebook URL> (or reply to a message with one)`);
        }

        await m.reply('Downloading...');

        try {
            const apiUrl = `${GATEWAY_URL}/download/facebookv2?token=${encodeURIComponent(GATEWAY_TOKEN)}&url=${encodeURIComponent(url)}`;
            const res = await axios.get(apiUrl, { timeout: 60000 });
            const data = res.data;

            let videoUrl = null;
            if (data?.data?.download_links && Array.isArray(data.data.download_links)) {
                const hd = data.data.download_links.find(l => l.quality?.includes('HD'));
                const sd = data.data.download_links.find(l => l.quality?.includes('SD'));
                videoUrl = hd?.url || sd?.url || data.data.download_links[0]?.url;
            }
            if (!videoUrl) videoUrl = findVideoUrl(data);

            const title = data?.data?.title || data?.result?.title || data?.title || 'Facebook Video';

            if (!videoUrl) return m.reply('Could not extract the video. The link may be private or invalid.');

            const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}.mp4`;

            try {
                await bot.sock.sendMessage(m.chat, {
                    video: { url: videoUrl },
                    mimetype: 'video/mp4',
                    caption: title,
                    fileName,
                }, { quoted: m });
            } catch {
                await m.reply(`Couldn't send the video directly. Download link:\n${videoUrl}`);
            }
        } catch (err) {
            await m.reply(`Download failed: ${err.message}`);
        }
    },
};
          
