const yts   = require('yt-search');
const axios = require('axios');

module.exports = {
    name: 'play',
    aliases: ['song', 'music', 'ytmp3'],
    category: 'downloader',
    description: 'Download and send YouTube music',

    async execute(bot, m, args) {
        const query = args.join(' ').trim();
        if (!query) return await m.reply(`Usage: ${bot.prefix}play <song name>\nExample: ${bot.prefix}play Essence`);

        await bot.sock.sendMessage(m.chat, { react: { text: '🎵', key: m.key } });

        try {
            // Search YouTube
            const res  = await yts(query);
            const vid  = res?.videos?.[0];
            if (!vid) return await m.reply('❌ No results found for: ' + query);

            await m.reply(`🔍 Found: *${vid.title}*\n⏱️ Duration: ${vid.timestamp}\n⬇️ Downloading...`);

            // Try multiple download APIs
            const APIS = [
                `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(vid.url)}`,
                `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(vid.url)}`,
                `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(vid.url)}`,
            ];

            let audioBuffer = null;
            let lastErr     = '';

            for (const api of APIS) {
                try {
                    const resp = await axios.get(api, { timeout: 30000 });
                    const data = resp.data;
                    let audioUrl = data?.audio || data?.url || data?.data?.url || data?.download?.url || null;
                    if (!audioUrl && typeof data === 'string' && data.startsWith('http')) audioUrl = data;
                    if (!audioUrl) continue;
                    const audioResp = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 60000 });
                    audioBuffer = Buffer.from(audioResp.data);
                    if (audioBuffer.length > 5000) break;
                } catch (e) { lastErr = e.message; continue; }
            }

            if (!audioBuffer || audioBuffer.length < 5000) {
                await bot.sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
                return await m.reply(`❌ Download failed. Try again later.\nSong: *${vid.title}*\nURL: ${vid.url}`);
            }

            await bot.sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

            const caption = `🎵 *${vid.title}*\n👤 ${vid.author?.name || 'Unknown'}\n⏱️ ${vid.timestamp}\n👁️ ${vid.views?.toLocaleString() || '?'} views`;

            await bot.sock.sendMessage(m.chat, {
                audio:    audioBuffer,
                mimetype: 'audio/mpeg',
                ptt:      false,
                fileName: `${vid.title}.mp3`
            }, { quoted: m._raw });

            await m.reply(caption);

        } catch (e) {
            await bot.sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            await m.reply('❌ Error: ' + e.message);
        }
    }
};
