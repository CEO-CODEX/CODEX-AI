const fs   = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { PROVIDERS, clearMemory } = require('../../lib/smartAI');

const DB = path.join(process.cwd(), 'database/variables.json');
const readVars = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveVars = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

function mask(key) {
    if (!key || key.length < 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
}

async function testKey(provider, key) {
    const cfg = PROVIDERS[provider];
    try {
        const { status, data } = await axios.post(cfg.url, {
            model: cfg.models[cfg.models.length - 1],
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
        }, {
            timeout: 15000,
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            validateStatus: () => true,
        });
        if (status >= 200 && status < 300) return { ok: true };
        return { ok: false, error: data?.error?.message || `HTTP ${status}` };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

module.exports = {
    name: 'aiapi',
    alias: ['chatbotapi', 'setai', 'aikey'],
    category: 'owner',
    description: 'Set or check the CODEX AI key (Groq or OpenAI) used by .codex / .chatbot / .chatbotdm',
    ownerOnly: true,

    execute: async (bot, m, args) => {
        const sub = (args[0] || '').toLowerCase();

        if (!sub || sub === 'status' || sub === 'help') {
            const provider = bot.config.AI_PROVIDER || 'groq';
            const key = bot.config.AI_API_KEY
                || (provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.GROQ_API_KEY)
                || '';
            return await m.reply(
                `🔑 *CODEX AI — API*\n\n` +
                `Provider: *${provider}*\n` +
                `Key:      \`${key ? mask(key) : 'NOT SET'}\`\n\n` +
                `*Usage:*\n` +
                `• ${bot.prefix}aiapi groq <key>   — set a Groq key (gsk_...)\n` +
                `• ${bot.prefix}aiapi openai <key> — set an OpenAI key (sk-...)\n` +
                `• ${bot.prefix}aiapi status        — show active provider + masked key\n\n` +
                `_Switch providers any time one gets rate-limited or revoked — no restart needed._`
            );
        }

        if (sub === 'groq' || sub === 'openai') {
            const provider = sub;
            const key = (args[1] || '').trim();
            if (!key) return await m.reply(`Usage: ${bot.prefix}aiapi ${provider} <key>`);

            const cfg = PROVIDERS[provider];
            if (!key.startsWith(cfg.prefix)) {
                return await m.reply(`That doesn't look like a ${provider.toUpperCase()} key (should start with \`${cfg.prefix}\`).`);
            }
            if (key.length < 20) return await m.reply('Key looks too short.');

            await m.reply(`🔍 Testing ${provider.toUpperCase()} key \`${mask(key)}\`...`);
            const test = await testKey(provider, key);
            if (!test.ok) return await m.reply(`❌ Key rejected by ${provider.toUpperCase()}:\n_${test.error}_`);

            const vars = readVars();
            vars.AI_PROVIDER = provider;
            vars.AI_API_KEY  = key;
            saveVars(vars);
            bot.config.AI_PROVIDER = provider;
            bot.config.AI_API_KEY  = key;
            clearMemory(); // fresh start on the new key/provider

            return await m.reply(
                `✅ *CODEX AI key updated!*\n\n` +
                `Provider: *${provider}*\n` +
                `Key:      \`${mask(key)}\`\n\n` +
                `Takes effect immediately — no restart needed.`
            );
        }

        return await m.reply(`Unknown sub-command. Try ${bot.prefix}aiapi status.`);
    }
};
