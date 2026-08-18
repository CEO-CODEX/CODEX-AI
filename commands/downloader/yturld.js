const axios = require('axios');

function quotedText(m) {
    const qm = m.msg?.contextInfo?.quotedMessage;
    return qm?.conversation || qm?.extendedTextMessage?.text || '';
}

module.exports = {
    name: 'yturld',
    aliases: ['ytaudio'],
    category: 'downloader',
    reactions: { start: '⬇️', success: '📥' },
    description: 'Download YouTube audio as MP3.',
    usage: '.yturld <url>',

    async execute(bot, m, args) {
        const url = args[0] || quotedText(m);
        if (!url) return m.reply(`Usage: ${bot.prefix}yturld <url>`);

        try {
            const apiUrl = `https://apis.prexzyvilla.site/download/ytaudio?url=${encodeURIComponent(url)}`;
            const res = await axios.get(apiUrl, { timeout: 30000 });
            const data = res.data;

            if (!data.download || !data.title) return m.reply('Failed to get audio.');

            const audioUrl = data.download;
            const title = data.title.replace(/[^\w\s]/gi, '') || 'youtube_audio';

            const mp3Res = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 60000 });
            const buffer = Buffer.from(mp3Res.data);

            await bot.sock.sendMessage(m.chat, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`,
            }, { quoted: m });
        } catch (err) {
            await m.reply(`Failed to download YouTube audio: ${err.message}`);
        }
    },
};
