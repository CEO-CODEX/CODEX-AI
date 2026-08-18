
const axios = require('axios');
const FormData = require('form-data');

module.exports = {
    name: 'scan',
    aliases: ['ocr', 'read'],
    category: 'documents',
    reactions: { start: '📄', success: '✅' },
    description: 'Extract text from an image (OCR).',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        const quoted = m.quoted;

        // Check if the user is replying to an image
        const isImage = quoted && (
            quoted.mtype === 'imageMessage' ||
            quoted.type === 'image' ||
            quoted.mimetype?.startsWith('image/')
        );

        if (!isImage) {
            return await m.reply(`❌ Please reply to an image.\nUsage: Reply to photo with *${prefix}scan*`);
        }

        try {
            await m.reply('🔍 Scanning image for text...');

            const buffer = await quoted.download();
            if (!buffer) return await m.reply('❌ Failed to download the image.');

            // Build form data for the OCR.space API
            const form = new FormData();
            form.append('apikey', 'K82707468388957'); 
            form.append('language', 'eng');
            form.append('isOverlayRequired', 'false');
            form.append('file', buffer, { filename: 'scan.jpg' });

            const res = await axios.post(
                'https://api.ocr.space/parse/image',
                form,
                { headers: form.getHeaders(), timeout: 120000 }
            );

            const data = res.data;

            if (!data?.ParsedResults?.[0]?.ParsedText) {
                return await m.reply('❌ No text detected in the image.');
            }

            const text = data.ParsedResults[0].ParsedText.trim();

            if (!text) return await m.reply('❌ No readable text found.');

            // Send the extracted text
            await bot.sendMessage(
                m.chat,
                {
                    text: `*🔍 OCR RESULT*\n\n${text}`
                },
                { quoted: m }
            );

        } catch (err) {
            console.error('[SCAN ERROR]', err.message);
            await m.reply('❌ OCR scan failed. The API might be down or the image file size might be too large.');
        }
    }
};
