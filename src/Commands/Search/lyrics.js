module.exports = {
    name: 'lyrics',
    alias: ['lyric'],
    desc: 'Search song lyrics',
    category: 'Search',
    reactions: { start: '♪', success: '♫' },

    execute: async (sock, m, { text, reply }) => {
        if (!text) return reply(
            `☛ Usage: .lyrics <song name>\n` +
            `❡ Example: .lyrics Bohemian Rhapsody`
        );

        // Start reaction
        await sock.sendMessage(m.chat, { react: { text: '♪', key: m.key } });

        try {
            const axios = require('axios');
            const q     = encodeURIComponent(text);
            const res   = await axios.get('https://api.lyrics.ovh/suggest/' + q, { timeout: 8000 });
            const data  = res.data?.data;

            if (!data?.length) {
                await sock.sendMessage(m.chat, { react: { text: '✘', key: m.key } });
                return reply('☛ No results for: ' + text);
            }

            const song   = data[0];
            const artist = song.artist?.name || 'Unknown';
            const title  = song.title || text;

            const lyricsRes = await axios.get(
                'https://api.lyrics.ovh/v1/' + encodeURIComponent(artist) + '/' + encodeURIComponent(title),
                { timeout: 10000 }
            );
            const lyrics = lyricsRes.data?.lyrics;

            if (!lyrics) {
                await sock.sendMessage(m.chat, { react: { text: '✘', key: m.key } });
                return reply('☛ Lyrics not found for ' + title + ' by ' + artist);
            }

            const trimmed = lyrics.length > 3500
                ? lyrics.slice(0, 3500) + '\n... (truncated)'
                : lyrics;

            // Success reaction
            await sock.sendMessage(m.chat, { react: { text: '♫', key: m.key } });

            await reply(
                `☯︎ *${title.toUpperCase()}* ◈\n` +
                `𓂃✍︎ Artist: ${artist}\n\n` +
                `─ · · · · · · · · · · · · · · · · · · ─\n\n` +
                `${trimmed}\n\n` +
                `─ · · · · · · · · · · · · · · · · · · ─\n` +
                `  𓂃✍︎ Source: C☯︎DEX`
            );

        } catch {
            await sock.sendMessage(m.chat, { react: { text: '✘', key: m.key } });
            await reply('◈ Could not fetch lyrics for: ' + text);
        }
    }
};
