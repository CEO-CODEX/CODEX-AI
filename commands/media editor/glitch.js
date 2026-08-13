const mumaker = require('mumaker');

module.exports = {
    name: 'glitch',
    category: 'textmaker',
    description: 'Create a digital glitch text effect',
    usage: '.glitch <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}glitch <text>\nExample: ${bot.prefix}glitch CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/create-digital-glitch-text-effects-online-767.html', text);

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
