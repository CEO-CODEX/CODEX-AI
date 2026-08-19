
/**
 * .tts <text> — text-to-speech
 *
 * Fix: the previous version assumed prexzyapis.com/tts/tts-en always
 * returns JSON with a nested audio URL. Elsewhere in this codebase
 * (utils/ttsHelper.js, commands/general/speak.js) the SAME family of TTS
 * endpoints is treated as returning raw audio bytes directly — and that
 * assumption is what's proven to work. The mismatch is the likely cause
 * of '.tts' silently failing.
 *
 * New behaviour:
 * 1. Try prexzyapis.com/tts/tts-en directly, sniffing the response —
 * if it's audio bytes, use them; if it's JSON, walk it for a URL (covers
 * either possible response shape without guessing wrong).
 * 2. Fall back to utils/ttsHelper.js's generateVoice() — already used
 * elsewhere in this bot and known to work, tries several prexzyvilla
 * voice endpoints and transcodes to a real WhatsApp voice note.
 * 3. Fall back to Google Translate TTS (same approach as .speak) — a
 * dependable last resort with no API key needed.
 */
'use strict';
const axios = require('axios');
const { generateVoice } = require('../../utils/ttsHelper');

const AUDIO_RE = /\.(mp3|ogg|m4a|wav|aac|opus)(\?|$)/i;
const URL_RE = /^https?:\/\//i;

function walkAudioUrls(node, out) {
    if (!node) return;
    if (typeof node === 'string') {
        if (URL_RE.test(node) && AUDIO_RE.test(node)) out.push(node);
        return;
    }
    if (Array.isArray(node)) { for (const v of node) walkAudioUrls(v, out); return; }
    if (typeof node === 'object') { for (const v of Object.values(node)) walkAudioUrls(v, out); }
}

// ─── Step 1: try prexzyvilla directly, accepting EITHER response shape ──────
async function tryPrexzyvillaDirect(text) {
    try {
        const url = `https://prexzyapis.com/tts/tts-en?text=${encodeURIComponent(text)}`;
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (SUKUNA-MD)' },
            validateStatus: () => true,
        });
        if (res.status >= 400) return null;

        const contentType = String(res.headers['content-type'] || '');

        // Shape A: raw audio bytes
        if (contentType.includes('audio') || contentType.includes('octet-stream') || contentType.includes('mpeg')) {
            const buf = Buffer.from(res.data);
            if (buf && buf.length > 1024) return { buffer: buf, mimetype: 'audio/mpeg' };
            return null;
        }

        // Shape B: JSON with a nested audio URL somewhere
        if (contentType.includes('json')) {
            let parsed;
            try { parsed = JSON.parse(Buffer.from(res.data).toString('utf8')); } catch { return null; }
            const urls = [];
            walkAudioUrls(parsed, urls);
            if (!urls.length) return null;
            const audioRes = await axios.get(urls[0], { responseType: 'arraybuffer', timeout: 30000 });
            const buf = Buffer.from(audioRes.data);
            if (buf && buf.length > 1024) return { buffer: buf, mimetype: 'audio/mpeg' };
        }
        return null;
    } catch (e) {
        console.error('[tts] prexzyvilla direct failed:', e.message);
        return null;
    }
}

// ─── Step 3: Google Translate TTS — dependable, no key needed ───────────────
async function tryGoogleTranslateTts(text) {
    try {
        const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' +
            encodeURIComponent(text) + '&tl=en&client=tw-ob';
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const buf = Buffer.from(res.data);
        if (buf && buf.length > 512) return { buffer: buf, mimetype: 'audio/mpeg' };
        return null;
    } catch (e) {
        console.error('[tts] Google Translate TTS failed:', e.message);
        return null;
    }
}

module.exports = {
    name: 'tts',
    aliases: ['say', 'voice'],
    description: 'Convert text to speech (English)',
    category: 'media',
    reactions: { start: '⏳' },

    async execute(bot, m, args) {
        if (!args.length) {
            await bot.sendMessage(m.chat, { react: { text: '', key: m.key } }).catch(() => {});
            return m.reply(
                `*Text to Speech*\n\n` +
                `Usage: .tts <text>\n` +
                `Example: .tts hello world`
            );
        }
        
        const text = args.join(' ').trim().slice(0, 600);
        
        if (!text) {
            await bot.sendMessage(m.chat, { react: { text: '', key: m.key } }).catch(() => {});
            return m.reply('Please provide some text.');
        }

        try {
            let result = await tryPrexzyvillaDirect(text);
            if (!result) result = await generateVoice(text, 'Leda').catch(() => null);
            if (!result) result = await tryGoogleTranslateTts(text);

            if (!result || !result.buffer || result.buffer.length < 512) {
                await bot.sendMessage(m.chat, { react: { text: '', key: m.key } }).catch(() => {});
                return m.reply('TTS failed — all providers are currently unavailable. Try again shortly.');
            }

            try {
                await bot.sendMessage(m.chat, {
                    audio: result.buffer,
                    mimetype: result.mimetype || 'audio/mpeg',
                    ptt: result.mimetype?.includes('opus') || false,
                }, { quoted: m });
            } catch (e) {
                console.error('[tts] audio send failed:', e.message);
                await bot.sendMessage(m.chat, { react: { text: '', key: m.key } }).catch(() => {});
                return m.reply('Generated audio but failed to send it. Try again.');
            }
            
            // Unreact on success
            await bot.sendMessage(m.chat, { react: { text: '', key: m.key } }).catch(() => {});
            
        } catch (err) {
            console.error('[tts] error:', err.message);
            await bot.sendMessage(m.chat, { react: { text: '', key: m.key } }).catch(() => {});
            m.reply('TTS failed. Try again later.');
        }
    },
};
  
