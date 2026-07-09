/**
 * chatbotImageGen — detects "generate me an image of..." style requests
 * inside a chatbot conversation and sends a generated image instead of a
 * text reply. No API key required for any of these.
 *
 * Tries shizoapi first (direct image bytes, prompt auto-enhanced with quality
 * keywords), then falls back to the prexzyvilla dalle/realistic pair if that
 * fails — gives the best shot at actually getting an image back instead of
 * depending on a single provider.
 */
const axios = require('axios');

const SHIZO_URL  = 'https://shizoapi.onrender.com/api/ai/imagine';
const PRIMARY    = 'https://apis.prexzyvilla.site/ai/dalle';
const FALLBACK   = 'https://apis.prexzyvilla.site/ai/realistic';

const TRIGGERS = [
    /(?:generate|create|make|draw|design|render|produce|give\s*me)\s+(?:an?\s+|me\s+(?:an?\s+)?)?(?:image|picture|pic|photo|art|drawing|illustration|painting)\s+(?:of|about|showing|with|for)\s+(.+)/i,
    /(?:image|picture|pic|photo)\s+of\s+(.+)/i,
    /(?:draw|paint|sketch)\s+(?:me\s+)?(.+)/i,
];

function detectImagePrompt(text) {
    if (!text || typeof text !== 'string') return null;
    const t = text.trim();
    for (const re of TRIGGERS) {
        const m = t.match(re);
        if (m && m[1]) {
            const p = m[1].trim().replace(/[.!?]+$/, '');
            if (p.length >= 2 && p.length <= 400) return p;
        }
    }
    return null;
}

const QUALITY_ENHANCERS = [
    'high quality', 'detailed', 'masterpiece', 'best quality', 'ultra realistic',
    '4k', 'highly detailed', 'professional photography', 'cinematic lighting', 'sharp focus',
];

function enhancePrompt(prompt) {
    const n = Math.floor(Math.random() * 2) + 3; // 3-4 random enhancers
    const picks = QUALITY_ENHANCERS.slice().sort(() => Math.random() - 0.5).slice(0, n);
    return `${prompt}, ${picks.join(', ')}`;
}

/** shizoapi returns the image bytes directly (no JSON wrapper). */
async function _fetchShizoBuffer(prompt) {
    try {
        const res = await axios.get(SHIZO_URL, {
            params: { apikey: 'shizo', query: enhancePrompt(prompt) },
            responseType: 'arraybuffer',
            timeout: 60000,
        });
        const buf = Buffer.from(res.data);
        if (!buf || buf.length < 1024) return null;
        return buf;
    } catch (e) {
        console.error('[chatbotImageGen] shizoapi failed:', e.message);
        return null;
    }
}

async function _fetchImageUrl(endpoint, prompt) {
    try {
        const { data } = await axios.get(endpoint, { params: { prompt }, timeout: 60000 });
        if (!data || data.status !== true) return null;
        const arr = data.image_url || data.images || data.result;
        if (Array.isArray(arr) && arr.length) {
            const first = arr[0];
            return first?.image?.url || first?.url || (typeof first === 'string' ? first : null);
        }
        if (typeof data.result === 'string') return data.result;
        if (typeof data.url === 'string') return data.url;
        return null;
    } catch { return null; }
}

async function generateImageBuffer(prompt) {
    // 1. shizoapi — direct bytes, try first
    const shizoBuf = await _fetchShizoBuffer(prompt);
    if (shizoBuf) return { buffer: shizoBuf, model: 'Shizo Imagine' };

    // 2. prexzyvilla dalle, then realistic — JSON + url, needs a second fetch
    let url = await _fetchImageUrl(PRIMARY, prompt);
    let model = 'DALL·E 3 XL';
    if (!url) { url = await _fetchImageUrl(FALLBACK, prompt); model = 'Realistic'; }
    if (!url) return null;

    try {
        const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
        const buf = Buffer.from(r.data);
        if (!buf || buf.length < 1024) return null;
        return { buffer: buf, model };
    } catch { return null; }
}

/**
 * If `text` looks like an image-gen request, generate and send it.
 * Returns true when handled (caller should skip the normal AI text reply).
 */
async function maybeSendGeneratedImage({ bot, jid, m, text }) {
    const prompt = detectImagePrompt(text);
    if (!prompt) return false;
    const quoted = { quoted: { key: m.key, message: m.message } };
    try {
        const out = await generateImageBuffer(prompt);
        if (!out) {
            await bot.sendMessage(jid, { text: '🎨 I tried to draw that but the image servers refused. Try rewording it?' }, quoted);
            return true;
        }
        await bot.sendMessage(jid, { image: out.buffer, caption: `🎨 Here you go — _${prompt}_` }, quoted);
        return true;
    } catch {
        return false;
    }
}

module.exports = { detectImagePrompt, generateImageBuffer, maybeSendGeneratedImage, enhancePrompt };
                          
