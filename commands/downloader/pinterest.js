const axios = require('axios');

function quotedText(m) {
    const qm = m.msg?.contextInfo?.quotedMessage;
    return qm?.conversation || qm?.extendedTextMessage?.text || '';
}

module.exports = {
    name: 'pinterest',
    aliases: ['pint', 'pindl'],
    category: 'downloader',
    reactions: { start: '⬇️', success: '📥' },
    description: 'Download a Pinterest image or video.',
    usage: '.pinterest <link>',

    async execute(bot, m, args) {
        const url = args[0] || quotedText(m);
        if (!url) return m.reply(`Usage: ${bot.prefix}pinterest <link>`);

        try {
            const apiUrl = `https://apis.prexzyvilla.site/download/pinterest?url=${encodeURIComponent(url)}`;
            const res = await axios.get(apiUrl, { timeout: 30000 });
            const data = res.data;

            const media = data?.result?.video || data?.result?.image || data?.result?.url || data?.url;
            if (!media) return m.reply('Failed to fetch the media.');

            const isVideo = media.includes('.mp4');

            if (isVideo) {
                await bot.sock.sendMessage(m.chat, { video: { url: media } }, { quoted: m });
            } else {
                await bot.sock.sendMessage(m.chat, { image: { url: media } }, { quoted: m });
            }
        } catch (err) {
            await m.reply(`Failed to download Pinterest media: ${err.message}`);
        }
    },
};
