const mumaker = require('mumaker');

module.exports = {
    name: 'ice',
    category: 'textmaker',
    reactions: { start: '🖌️', success: '🖼️' },
    description: 'Create an ice/frozen text effect',
    usage: '.ice <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}ice <text>\nExample: ${bot.prefix}ice CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/ice-text-effect-online-101.html', text);

            if (!result || !result.image) {
                throw new Error('No image URL received from the API');
            }

            await bot.sock.sendMessage(m.chat, {
                image: { url: result.image },
            }, { quoted: m });

        } catch (err) {
            await m.reply(`Failed to generate: ${err.message}`);
        }
    },
};
