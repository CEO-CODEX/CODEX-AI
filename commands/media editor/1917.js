const mumaker = require('mumaker');

module.exports = {
    name: '1917',
    category: 'textmaker',
    reactions: { start: '🖌️', success: '🖼️' },
    description: 'Create a 1917 style text effect on an image',
    usage: '.1917 <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}1917 <text>\nExample: ${bot.prefix}1917 CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/1917-style-text-effect-523.html', text);

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
