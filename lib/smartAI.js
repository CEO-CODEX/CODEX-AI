/**
 * smartAI — dual-provider (Groq / OpenAI) chat engine with per-key
 * conversation memory. Powers .codex, .chatbot, and .chatbotdm.
 *
 * Provider + key live on bot.config (persisted to database/variables.json
 * via .aiapi — see commands/bot/aiapi.js — or set once via the GROQ_API_KEY /
 * OPENAI_API_KEY environment variables). There is NO default/embedded key
 * here — you must set one with `.aiapi groq <key>` or `.aiapi openai <key>`
 * before any of the AI features will work.
 */
const axios = require('axios');

const PROVIDERS = {
    groq: {
        url:    'https://api.groq.com/openai/v1/chat/completions',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
        prefix: 'gsk_',
        vision: 'meta-llama/llama-4-scout-17b-16e-instruct',
    },
    openai: {
        url:    'https://api.openai.com/v1/chat/completions',
        models: ['gpt-4o-mini', 'gpt-3.5-turbo'],
        prefix: 'sk-',
        vision: 'gpt-4o-mini',
    },
};

const MAX_TURNS  = 12;
const TIMEOUT_MS = 25000;

const memory = new Map();

function _hist(key) { if (!memory.has(key)) memory.set(key, []); return memory.get(key); }
function clearMemory(key) { if (key) memory.delete(key); else memory.clear(); }
function pushTurn(key, role, text) {
    if (!key || !text) return;
    const h = _hist(key);
    h.push({ role, content: String(text).slice(0, 1500) });
    while (h.length > MAX_TURNS * 2) h.shift();
}

function _providerConfig(bot) {
    const provider = (bot?.config?.AI_PROVIDER || 'groq').toLowerCase();
    const cfg = PROVIDERS[provider] || PROVIDERS.groq;
    const key = bot?.config?.AI_API_KEY
        || (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GROQ_API_KEY)
        || '';
    return { provider, key, url: cfg.url, models: cfg.models };
}

async function _callAI(url, apiKey, model, messages) {
    try {
        const { data } = await axios.post(url, {
            model,
            messages,
            temperature: 0.8,
            max_tokens: 1024,
        }, {
            timeout: TIMEOUT_MS,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            validateStatus: () => true,
        });
        const txt = data?.choices?.[0]?.message?.content;
        return (txt && String(txt).trim()) || null;
    } catch (e) {
        console.error('[smartAI]', model, e.message);
        return null;
    }
}

/**
 * ask({ bot, key, system, user, remember })
 *  - bot:    the bot instance (so this reads the live AI_PROVIDER/AI_API_KEY)
 *  - key:    conversation-memory key (e.g. 'dm:123@s.whatsapp.net') — omit for no memory
 *  - system: system prompt / persona
 *  - user:   the user's message
 */
async function ask({ bot, key, system = '', user, remember = true }) {
    if (!user || !String(user).trim()) return null;

    const { key: apiKey, url, models } = _providerConfig(bot);
    if (!apiKey) {
        console.error('[smartAI] No AI key configured — set one with .aiapi groq <key> or .aiapi openai <key>');
        return null;
    }

    const userText = String(user).trim();
    const history  = key ? _hist(key).slice() : [];
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    for (const t of history) messages.push({ role: t.role, content: t.content });
    messages.push({ role: 'user', content: userText });

    let reply = null;
    for (const model of models) {
        reply = await _callAI(url, apiKey, model, messages);
        if (reply) break;
    }

    if (reply && remember && key) {
        pushTurn(key, 'user', userText);
        pushTurn(key, 'assistant', reply);
    }
    return reply;
}

/**
 * askVision({ bot, system, user, imageBase64, mimetype })
 * One-shot multimodal call (no conversation memory) — used for image/sticker/
 * video-frame description. Both providers use the OpenAI-style
 * `image_url: { url: 'data:<mimetype>;base64,<...>' }` content block.
 */
async function askVision({ bot, system = '', user = '', imageBase64, mimetype = 'image/jpeg' }) {
    if (!imageBase64) return null;
    const { provider, key: apiKey, url } = _providerConfig(bot);
    if (!apiKey) {
        console.error('[smartAI] No AI key configured — set one with .aiapi groq <key> or .aiapi openai <key>');
        return null;
    }
    const cfg = PROVIDERS[provider] || PROVIDERS.groq;
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({
        role: 'user',
        content: [
            { type: 'text', text: user || 'Describe this image.' },
            { type: 'image_url', image_url: { url: `data:${mimetype};base64,${imageBase64}` } },
        ],
    });
    return await _callAI(url, apiKey, cfg.vision, messages);
}

/**
 * transcribeAudio(bot, buffer, mimetype)
 * Speech-to-text via the SAME Groq/OpenAI key already configured for chat —
 * no extra API key needed. Tries the raw buffer first (ogg/opus voice notes
 * are accepted by both providers' Whisper endpoints); if that's rejected,
 * falls back to an mp3 re-encode via ffmpeg-static and retries once.
 */
async function transcribeAudio(bot, buffer, mimetype = 'audio/ogg') {
    if (!buffer || !buffer.length) return null;
    const { provider, key: apiKey } = _providerConfig(bot);
    if (!apiKey) return null;

    const url   = provider === 'openai'
        ? 'https://api.openai.com/v1/audio/transcriptions'
        : 'https://api.groq.com/openai/v1/audio/transcriptions';
    const model = provider === 'openai' ? 'whisper-1' : 'whisper-large-v3';

    const FormData = require('form-data');
    const axios = require('axios');

    const attempt = async (buf, filename) => {
        const form = new FormData();
        form.append('file', buf, { filename });
        form.append('model', model);
        const { data } = await axios.post(url, form, {
            headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
            timeout: 30000,
        });
        return data?.text?.trim() || null;
    };

    try {
        return await attempt(buffer, 'voice.ogg');
    } catch (e) {
        try {
            const mp3 = await _toMp3(buffer);
            if (!mp3) return null;
            return await attempt(mp3, 'voice.mp3');
        } catch (e2) {
            console.error('[smartAI] transcribe failed:', e2.message);
            return null;
        }
    }
}

function _toMp3(buffer) {
    const fs   = require('fs-extra');
    const path = require('path');
    const { exec } = require('child_process');
    return new Promise((resolve) => {
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const input  = path.join(tempDir, `stt_${Date.now()}.ogg`);
        const output = input + '.mp3';
        fs.writeFileSync(input, buffer);
        exec(`ffmpeg -y -i "${input}" -ar 16000 -ac 1 -b:a 64k "${output}"`, (err) => {
            let result = null;
            try { if (!err && fs.existsSync(output)) result = fs.readFileSync(output); } catch {}
            try { if (fs.existsSync(input))  fs.unlinkSync(input); }  catch {}
            try { if (fs.existsSync(output)) fs.unlinkSync(output); } catch {}
            resolve(result);
        });
    });
}

function getMemoryCount(key) {
    return key && memory.has(key) ? memory.get(key).length : 0;
}

function getProviderInfo(bot) {
    return _providerConfig(bot);
}

module.exports = { ask, askVision, transcribeAudio, pushTurn, clearMemory, getMemoryCount, getProviderInfo, PROVIDERS };
