const mumaker = require('mumaker');

module.exports = {
    name: 'leaves',
    category: 'textmaker',
    reactions: { start: '🖌️', success: '🖼️' },
    description: 'Create a green leaves/nature text effect',
    usage: '.leaves <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}leaves <text>\nExample: ${bot.prefix}leaves CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/green-brush-text-effect-typography-maker-online-153.html', text);

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
