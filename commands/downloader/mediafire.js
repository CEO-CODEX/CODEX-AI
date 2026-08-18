const axios = require('axios');

function quotedText(m) {
    const qm = m.msg?.contextInfo?.quotedMessage;
    return qm?.conversation || qm?.extendedTextMessage?.text || '';
}

module.exports = {
    name: 'mediafire',
    aliases: ['mf', 'mfdown'],
    category: 'downloader',
    reactions: { start: '📥' },
    description: 'Download a file from a MediaFire link.',
    usage: '.mediafire <link>',

    async execute(bot, m, args) {
        const url = args[0] || quotedText(m);
        if (!url) return m.reply(`Usage: ${bot.prefix}mediafire <link>`);

        try {
            const apiUrl = `https://apis.prexzyvilla.site/download/mediafire?url=${encodeURIComponent(url)}`;
            const res = await axios.get(apiUrl, { timeout: 30000 });
            const data = res.data;

            const fileUrl = data?.result?.download || data?.result?.url || data?.download || data?.url;
            const fileName = data?.result?.filename || data?.filename || 'mediafire_file';

            if (!fileUrl) return m.reply('Failed to fetch the file.');

            await bot.sock.sendMessage(m.chat, {
                document: { url: fileUrl },
                fileName,
            }, { quoted: m });
        } catch (err) {
            await m.reply(`Failed to download MediaFire file: ${err.message}`);
        }
    },
};
