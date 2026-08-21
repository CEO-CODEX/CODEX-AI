
const yts = require('yt-search');
const axios = require('axios');

module.exports = {
    name: 'play',
    alias: ['song', 'music', 'ytmp3'],
    desc: 'Download and send YouTube music',
    category: 'downloader',
    reactions: { start: '⏰' },

    execute: async (sock, m, { reply, args, prefix }) => {
        const query = args.join(' ').trim();
        if (!query) {
            return await reply(`_*provide a query*_\n_❡ example: ${prefix}play unstoppable_`);
        }

        try {
            // Search YouTube
            const ytsr = await yts(query);
            const ytsa = ytsr.videos[0];
            
            if (!ytsa) {
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
                    
                    if (!audioUrl && typeof data === 'string' && data.startsWith('http')) {
                        audioUrl = data;
                    }
                    if (!audioUrl) continue;
                    
                    const audioResp = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 60000 });
                    audioBuffer = Buffer.from(audioResp.data);
                    
                    if (audioBuffer.length > 5000) break;
                } catch (e) { 
                    continue; 
                }
            }

            if (!audioBuffer || audioBuffer.length < 5000) {
                return await reply(`❌ Download failed. Try again later.\nSong: *${ytsa.title}*\nURL: ${ytsa.url}`);
            }

            // Build your custom caption
            const cap = `*${ytsa.title}*\n\n00:00 ───◁ㅤ ❚❚ ㅤ▷─── ${ytsa.duration?.timestamp || ytsa.timestamp || '?'} ♡`;

            // 1. Send the thumbnail image WITH your caption
            await sock.sendMessage(m.chat, {
                image: { url: ytsa.thumbnail },
                caption: cap
            }, { quoted: m });

            // 2. Send the pure audio file right below it (no link preview)
            await sock.sendMessage(m.chat, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${ytsa.title}.mp3`
            });

        } catch (err) {
            console.error(err);
            return await reply(`an error occured: ${err.message || err}`);
        }
    }
};
