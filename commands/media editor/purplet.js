const mumaker = require('mumaker');

module.exports = {
    name: 'purplet',
    category: 'textmaker',
    reactions: { start: '🖌️', success: '🖼️' },
    description: 'Create a purple text effect',
    usage: '.purplet <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}purplet <text>\nExample: ${bot.prefix}purplet CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/purple-text-effect-online-100.html', text);

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
