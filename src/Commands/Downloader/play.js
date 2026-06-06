const yts   = require('yt-search');
const axios = require('axios');

module.exports = {
    name: 'play',
    alias: ['song', 'music', 'ytmp3'],
    desc: 'Download and send YouTube music',
    category: 'downloader',
    reactions: { start: '⏰', success: '' },

    execute: async (sock, m, { reply, args, prefix }) => {
        const query = args.join(' ').trim();
        if (!query) return await reply(`_*provide a query*_\n_❡ example: ${prefix}play unstoppable_`);

        // React with clock
        await sock.sendMessage(m.chat, { react: { text: '⏰', key: m.key } });

        try {
            // Search YouTube
            const ytsr = await yts(query);
            const ytsa = ytsr.videos[0];
            if (!ytsa) {
                await sock.sendMessage(m.chat, { react: { text: '', key: m.key } });
                return await reply('❌ No results found for: ' + query);
            }

            // Try multiple download APIs
            const APIS = [
                `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(ytsa.url)}`,
                `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(ytsa.url)}`,
                `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(ytsa.url)}`,
            ];

            let audioBuffer = null;

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
                } catch (e) { continue; }
            }

            if (!audioBuffer || audioBuffer.length < 5000) {
                await sock.sendMessage(m.chat, { react: { text: '', key: m.key } });
                return await reply(`❌ Download failed. Try again later.\nSong: *${ytsa.title}*\nURL: ${ytsa.url}`);
            }

            // Unreact (clear reaction)
            await sock.sendMessage(m.chat, { react: { text: '', key: m.key } });

            // Build caption
            const cap = `00:00 ───◁ㅤ ❚❚ ㅤ▷─── ${ytsa.duration?.timestamp || ytsa.timestamp || '?'} ♡`;

            // Send audio with SMALL link preview (thumbnail + title + caption)
            await sock.sendMessage(m.chat, {
                audio:    audioBuffer,
                ptt:      false,
                mimetype: 'audio/mpeg',
                fileName: `${ytsa.title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: ytsa.title,
                        body: cap,
                        mediaType: 1,
                        thumbnailUrl: ytsa.thumbnail,
                        sourceUrl: ytsa.url,
                        renderLargerThumbnail: false  // ← SMALL thumbnail
                    }
                }
            }, { quoted: m });

        } catch (err) {
            await sock.sendMessage(m.chat, { react: { text: '', key: m.key } });
            console.error(err);
            return await reply(`an error occured: ${err.message || err}`);
        }
    }
};
