
/**
 * TTS helper — uses the same provider as the text AI (apis.prexzyvilla.site).
 * Returns proper ENGLISH voices (the previous Gemini-TTS endpoint only
 * rendered foreign-language audio reliably).
 *
 * Returns: { buffer, mimetype } on success, or null on failure.
 *
 * WhatsApp voice notes (PTT) MUST be OGG/Opus to render as a real voice
 * bubble. We transcode the upstream MP3 to ogg/opus with ffmpeg-static.
 *
 * voiceName mapping (kept compatible with existing callers):
 * - "Leda"   → soft female English (used for Hinatu)   → /tts/olivia
 * - "Charon" → deep male  English (used for Sukuna)    → /tts/marcus
 * Anything else falls back to /tts/tts-en (generic English).
 */
const axios = require('axios');
const { spawn } = require('child_process');

const BASE = 'https://apis.prexzyvilla.site';

// Primary voice per character + a couple of English fallbacks.
const VOICE_MAP = {
    Leda:   ['/tts/olivia',  '/tts/sophia',  '/tts/emma',   '/tts/tts-en'],
    Charon: ['/tts/marcus',  '/tts/ethan',   '/tts/jackson','/tts/tts-en'],
};

let ffmpegPath = null;
try { ffmpegPath = require('ffmpeg-static'); } catch (_) { ffmpegPath = null; }

function transcodeMp3ToOpus(mp3Buffer) {
    return new Promise((resolve) => {
        if (!ffmpegPath) return resolve(null);
        const args = [
            '-hide_banner', '-loglevel', 'error',
            '-i', 'pipe:0',
            '-vn',
            '-c:a', 'libopus',
            '-b:a', '64k',
            '-ar', '48000',
            '-ac', '1',
            '-f', 'ogg',
            'pipe:1'
        ];
        const ff = spawn(ffmpegPath, args);
        const chunks = [];
        ff.stdout.on('data', c => chunks.push(c));
        ff.on('error', () => resolve(null));
        ff.on('close', code => {
            if (code !== 0 || chunks.length === 0) return resolve(null);
            resolve(Buffer.concat(chunks));
        });
        ff.stdin.on('error', () => {});
        ff.stdin.end(mp3Buffer);
    });
}

async function fetchTtsMp3(endpoint, text) {
    try {
        const url = `${BASE}${endpoint}?text=${encodeURIComponent(text)}`;
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 35000,
            validateStatus: s => s >= 200 && s < 500,
        });
        if (res.status !== 200) return null;
        const ct = String(res.headers['content-type'] || '');
        if (!ct.includes('audio') && !ct.includes('octet-stream') && !ct.includes('mpeg')) return null;
        const buf = Buffer.from(res.data);
        if (!buf || buf.length < 1024) return null;
        return buf;
    } catch (e) {
        console.error('[TTS]', endpoint, e.message);
        return null;
    }
}

async function generateVoice(text, voiceName = 'Leda') {
    if (!text || !text.trim()) return null;
    // Keep it short — WhatsApp PTT works best under ~600 chars.
    const safeText = text.trim().slice(0, 600);

    const candidates = VOICE_MAP[voiceName] || VOICE_MAP.Leda;

    let mp3 = null;
    for (const ep of candidates) {
        mp3 = await fetchTtsMp3(ep, safeText);
        if (mp3) break;
    }
    if (!mp3) {
        console.error('[TTS] all candidate endpoints failed');
        return null;
    }

    // Transcode to ogg/opus for proper WhatsApp voice notes.
    const opus = await transcodeMp3ToOpus(mp3);
    if (opus && opus.length > 0) {
        return { buffer: opus, mimetype: 'audio/ogg; codecs=opus' };
    }
    // Fallback: raw mp3 (plays as audio file rather than voice bubble).
    return { buffer: mp3, mimetype: 'audio/mpeg' };
}

module.exports = { generateVoice };
