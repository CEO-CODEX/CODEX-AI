const axios = require('axios');

module.exports = {
    name: 'yt',
    aliases: ['youtube', 'ytdl', 'youtubedownload'],
    category: 'downloader',
    description: 'Download a YouTube video.',
    usage: '.yt <url>',

    async execute(bot, m, args) {
        const url = args[0]?.trim();
        if (!url) return m.reply(`Usage: ${bot.prefix}yt <url>`);

        try {
            const { data } = await axios.get(
                `https://docs.prexzyapis.com/download/youtube-video?url=${encodeURIComponent(url)}`,
                { timeout: 30000 }
            );

            if (!data.status || !data.download_url) {
                return m.reply(`No video found for: ${url}`);
            }

            const info = data.info || {};
            const caption = `${info.title || 'YouTube Video'} · ${info.quality || ''}`.trim();

            await bot.sock.sendMessage(m.chat, {
                video: { url: data.download_url },
                caption,
                mimetype: 'video/mp4',
            }, { quoted: m });
        } catch (err) {
            await m.reply(`Error downloading video: ${err.message}`);
        }
    },
};
