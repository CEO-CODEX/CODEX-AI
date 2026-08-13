const mumaker = require('mumaker');

module.exports = {
    name: 'devil',
    category: 'textmaker',
    description: 'Create a neon devil wings text effect',
    usage: '.devil <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}devil <text>\nExample: ${bot.prefix}devil CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html', text);

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
