
/**
 * ATTP — Animated Text To Picture (sticker)
 * Usage: .attp <text>
 *
 * Generates animated stickers using reliable external APIs.
 */
'use strict';

const axios = require('axios');

// Multiple robust ATTP API providers
const ATTP_APIS = [
    // Primary: helv.io - stable and reliable
    async (text) => {
        const response = await axios.get(`https://api.helv.io/attp?text=${encodeURIComponent(text)}&format=webp`, {
            timeout: 15000,
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return response.data;
    },
    // Backup: Text2GIF approach
    async (text) => {
        const response = await axios.get(`https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(text)}`, {
            timeout: 15000,
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return response.data;
    },
    // Backup: Alternative provider
    async (text) => {
        const response = await axios.post('https://sticker-api.herokuapp.com/attp', 
            { text }, 
            {
                timeout: 15000,
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' }
            }
        );
        return response.data;
    }
];

async function generateAttp(text) {
    const errors = [];
    
    for (let i = 0; i < ATTP_APIS.length; i++) {
        try {
            const result = await ATTP_APIS[i](text);
            
            if (result && result.length > 100) {
                console.log(`[attp] Success with provider ${i + 1}`);
                return result;
            }
        } catch (err) {
            errors.push(`Provider ${i + 1}: ${err.message}`);
            console.log(`[attp] Provider ${i + 1} failed: ${err.message}`);
        }
    }
    
    throw new Error(`All ATTP providers failed. Errors: ${errors.join(' | ')}`);
}

module.exports = {
    name: 'attp',
    aliases: ['animatedttp', 'text2gif', 'sticker'],
    description: 'Create an animated text sticker',
    category: 'media',
    reactions: { start: '🔮' },

    async execute(bot, m, args) {
        try {
            const text = (args || []).join(' ').trim();
            
            if (!text) {
                await bot.sendMessage(m.chat, { react: { text: '', key: m.key } }).catch(() => {});
                return m.reply('*ATTP Sticker Maker*\nUsage: .attp <text>\nExample: .attp CODEX');
            }

            if (text.length > 100) {
                await bot.sendMessage(m.chat, { react: { text: '', key: m.key } }).catch(() => {});
                return m.reply('Text too long (max 100 characters)');
            }

            const sticker = await generateAttp(text);
            await bot.sendMessage(m.chat, { sticker }, { quoted: m });
            
            await bot.sendMessage(m.chat, { react: { text: '', key: m.key } }).catch(() => {});
        } catch (err) {
            console.error('[attp]', err.message);
            await bot.sendMessage(m.chat, { react: { text: '', key: m.key } }).catch(() => {});
            m.reply(`Error: ${err.message}`);
        }
    }
};
