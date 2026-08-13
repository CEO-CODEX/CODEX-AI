const axios = require('axios');

function quotedText(m) {
    const qm = m.msg?.contextInfo?.quotedMessage;
    return qm?.conversation || qm?.extendedTextMessage?.text || '';
}

module.exports = {
    name: 'spotify',
    aliases: ['sp', 'spdl'],
    category: 'downloader',
    description: 'Download a Spotify track as MP3.',
    usage: '.spotify <track link>',

    async execute(bot, m, args) {
        const url = args[0] || quotedText(m);
        if (!url) return m.reply(`Usage: ${bot.prefix}spotify <track link>`);

        try {
            const apiUrl = `https://apis.prexzyvilla.site/download/spotify?url=${encodeURIComponent(url)}`;
            const res = await axios.get(apiUrl, { timeout: 30000 });
            const data = res.data;

            const audioUrl = data?.result?.download || data?.result?.url || data?.download || data?.url;
            const title = data?.result?.title || data?.title || 'spotify_song';
            const artist = data?.result?.artist || data?.artist || 'Unknown Artist';

            if (!audioUrl) return m.reply('Failed to fetch the song.');

            const safeTitle = title.replace(/[^\w\s-]/g, '').slice(0, 50);

            await bot.sock.sendMessage(m.chat, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
            }, { quoted: m });

            await bot.sock.sendMessage(m.chat, {
                document: { url: audioUrl },
                mimetype: 'audio/mpeg',
                fileName: `${safeTitle}.mp3`,
            }, { quoted: m });

            await m.reply(`${title} — ${artist}`);
        } catch (err) {
            await m.reply(`Failed to download Spotify track: ${err.message}`);
        }
    },
};
