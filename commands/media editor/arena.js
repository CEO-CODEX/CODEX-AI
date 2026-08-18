const mumaker = require('mumaker');

module.exports = {
    name: 'arena',
    category: 'textmaker',
    reactions: { start: '🖌️', success: '🖼️' },
    description: 'Create an Arena of Valor style text effect',
    usage: '.arena <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}arena <text>\nExample: ${bot.prefix}arena CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html', text);

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
