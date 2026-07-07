/**
 * lyrics — song search via the lyrics.ovh /suggest endpoint (Deezer-backed).
 *
 * IMPORTANT: This deliberately does NOT call lyrics.ovh's /v1/<artist>/<title>
 * endpoint, which returns the complete copyrighted lyrics text. Sending full
 * song lyrics on request — to anyone who asks, repeatedly, at scale, in a
 * group chat — is mass-distributing copyrighted creative work, which isn't
 * getting wired up regardless of how the request is framed.
 *
 * What this DOES do instead, all of it copyright-safe:
 *   - title/artist/album metadata (facts, not creative content)
 *   - official Deezer cover art (promotional use, standard practice)
 *   - official Deezer 30-second preview clip (a licensed preview meant for
 *     exactly this kind of sharing — not the full song)
 *   - a short AI-written description of the song's vibe/theme, explicitly
 *     instructed not to quote any actual lyrics
 *   - a link to a real source to read the full lyrics legitimately
 */
const axios = require('axios');

async function searchSong(query) {
    if (!query || !query.trim()) return [];
    try {
        const { data } = await axios.get(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query.trim())}`, {
            timeout: 15000,
        });
        const list = data?.data || [];
        return list.slice(0, 5).map(t => ({
            title:    t.title || null,
            artist:   t.artist?.name || null,
            album:    t.album?.title || null,
            cover:    t.album?.cover_big || t.album?.cover_medium || t.album?.cover || null,
            preview:  t.preview || null, // official 30s Deezer preview clip (mp3 url)
            duration: t.duration || null,
        }));
    } catch (e) {
        console.error('[lyrics] search failed:', e.message);
        return [];
    }
}

function geniusSearchUrl(title, artist) {
    const q = encodeURIComponent([artist, title].filter(Boolean).join(' '));
    return `https://genius.com/search?q=${q}`;
}

/** Asks the configured AI for a short, lyrics-free description of the song's vibe/theme. */
async function describeVibe(bot, title, artist) {
    try {
        const smartAI = require('./smartAI');
        const reply = await smartAI.ask({
            bot,
            user: `In 1-2 short sentences, describe the overall mood/vibe/theme of the song ` +
                  `"${title}"${artist ? ` by ${artist}` : ''}. Speak generally about the feeling and ` +
                  `subject matter in your own words. Do NOT quote any actual lyrics or specific lines ` +
                  `from the song.`,
            system: 'You are a concise music critic. Never quote song lyrics verbatim, even briefly — describe in your own words only.',
        });
        return reply || null;
    } catch {
        return null;
    }
}

const LYRICS_TRIGGERS = [
    /lyrics?\s+(?:of|for|to)\s+(.+)/i,
    /(?:full\s+)?lyrics?\s*[:\-]?\s*(.+)/i,
];

function detectLyricsRequest(text) {
    if (!text || typeof text !== 'string') return null;
    const t = text.trim();
    if (!/lyric/i.test(t)) return null;
    for (const re of LYRICS_TRIGGERS) {
        const m = t.match(re);
        if (m && m[1] && m[1].trim().length >= 2) return m[1].trim();
    }
    return null;
}

/**
 * If `text` looks like a lyrics request: find the song, send its cover art +
 * metadata + an AI-written (lyrics-free) vibe description + the official 30s
 * preview clip, then a link to read the full lyrics legitimately.
 * Returns true when handled.
 */
async function maybeSendLyricsInfo({ bot, jid, m, text }) {
    const query = detectLyricsRequest(text);
    if (!query) return false;

    const quoted = { quoted: { key: m.key, message: m.message } };
    const results = await searchSong(query);

    if (!results.length) {
        await bot.sendMessage(jid, { text: `🎵 Couldn't find a song matching "${query}".` }, quoted);
        return true;
    }

    const top  = results[0];
    const link = geniusSearchUrl(top.title, top.artist);
    const vibe = await describeVibe(bot, top.title, top.artist);

    const caption =
        `🎵 *${top.title}*${top.artist ? ` — ${top.artist}` : ''}${top.album ? `\n💿 ${top.album}` : ''}\n` +
        (vibe ? `\n${vibe}\n` : '\n') +
        `\nI can't send the full lyrics (copyright), but here's where to read them legitimately:\n${link}`;

    if (top.cover) {
        await bot.sendMessage(jid, { image: { url: top.cover }, caption }, quoted).catch(async () => {
            await bot.sendMessage(jid, { text: caption }, quoted);
        });
    } else {
        await bot.sendMessage(jid, { text: caption }, quoted);
    }

    if (top.preview) {
        try {
            const { data } = await axios.get(top.preview, { responseType: 'arraybuffer', timeout: 20000 });
            await bot.sendMessage(jid, { audio: Buffer.from(data), mimetype: 'audio/mpeg' }, quoted);
        } catch { /* preview is a nice-to-have, skip silently on failure */ }
    }

    return true;
}

module.exports = { searchSong, geniusSearchUrl, describeVibe, detectLyricsRequest, maybeSendLyricsInfo };
