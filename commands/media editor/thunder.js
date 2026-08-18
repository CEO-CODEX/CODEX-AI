const mumaker = require('mumaker');

module.exports = {
    name: 'thunder',
    category: 'textmaker',
    reactions: { start: '⚙️' },
    description: 'Create a thunder/lightning text effect',
    usage: '.thunder <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}thunder <text>\nExample: ${bot.prefix}thunder CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/thunder-text-effect-online-97.html', text);

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
