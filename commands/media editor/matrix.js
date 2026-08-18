const mumaker = require('mumaker');

module.exports = {
    name: 'matrix',
    category: 'textmaker',
    reactions: { start: '⚙️' },
    description: 'Create a matrix text effect on an image',
    usage: '.matrix <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}matrix <text>\nExample: ${bot.prefix}matrix CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/matrix-text-effect-154.html', text);

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
