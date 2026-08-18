const axios = require('axios');

module.exports = {
    name: 'apk',
    aliases: ['apkdl'],
    category: 'tools',
    reactions: { start: '🧰', success: '📦' },
    description: 'Search and download an Android APK by app name.',
    usage: '.apk <app name>',

    async execute(bot, m, args) {
        const query = args.join(' ').trim();
        if (!query) return m.reply(`Usage: ${bot.prefix}apk <app name>`);

        await m.reply('Searching...');

        try {
            const searchApi = `https://api.kord.live/api/apk?q=${encodeURIComponent(query)}`;
            const searchRes = await axios.get(searchApi, { timeout: 30000 });
            const data = searchRes.data;

            if (!data || data.error) return m.reply('APK not found.');

            const appName = data.app_name || query;
            const downloadLink = data.download_url;
            if (!downloadLink) return m.reply('Download link not found.');

            await m.reply(`Found ${appName} — downloading...`);

            const fileRes = await axios.get(downloadLink, { responseType: 'arraybuffer', timeout: 120000 });
            const buffer = Buffer.from(fileRes.data);

            if (!buffer.length) return m.reply('Failed to download APK.');

            const maxSize = 250 * 1024 * 1024; // 250MB
            if (buffer.length > maxSize) return m.reply('APK too large (max 250MB).');

            await bot.sendMessage(m.chat, {
                document: buffer,
                mimetype: 'application/vnd.android.package-archive',
                fileName: `${appName}.apk`,
                caption: appName,
            }, { quoted: m });
        } catch (err) {
            await m.reply(`APK download failed: ${err.message}`);
        }
    },
};
