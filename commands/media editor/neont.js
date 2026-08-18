const mumaker = require('mumaker');

module.exports = {
    name: 'neont',
    category: 'textmaker',
    reactions: { start: '🖌️', success: '🖼️' },
    description: 'Create a colorful neon light text effect',
    usage: '.neont <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}neont <text>\nExample: ${bot.prefix}neont CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html', text);

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
