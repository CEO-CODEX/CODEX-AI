/**
 * .imagine <prompt> — AI image generation
 * Aliases: .generate, .gen, .img, .aiimage, .genimage, .create
 *
 * Uses shizoapi (prompt auto-enhanced with quality keywords) as primary,
 * with the prexzyvilla dalle/realistic pair as a fallback if it's down or
 * rate-limited — same pipeline the chatbot's auto image-gen uses
 * (lib/chatbotImageGen.js), so .imagine and "generate an image of..." in
 * chat both benefit from the same reliability.
 */
const { generateImageBuffer } = require('../../lib/chatbotImageGen');

module.exports = {
    name: 'imagine',
    aliases: ['generate', 'gen', 'img', 'aiimage', 'genimage', 'create'],
    description: 'Generate an AI image from text',
    usage: '.imagine <description>',
    category: 'ai',

    async execute(bot, m, args) {
        const prompt = args.join(' ').trim();
        if (!prompt) {
            return await m.reply(
                `🎨 *AI Image Generator*\n\n` +
                `Usage: ${bot.prefix}imagine <description>\n` +
                `Example: ${bot.prefix}imagine a cat wearing a spacesuit on the moon`
            );
        }

        await m.reply('🎨 Generating your image... please wait.');

        const out = await generateImageBuffer(prompt);
        if (!out) {
            return await m.reply('❌ Failed to generate image. Please try again later.');
        }

        try {
            await bot.sock.sendMessage(m.chat, {
                image: out.buffer,
                caption: `🎨 Generated image for prompt: "${prompt}"`
            }, { quoted: { key: m.key, message: m.message } });
        } catch (err) {
            await m.reply(`❌ Failed to send image: ${err.message}`);
        }
    }
};
