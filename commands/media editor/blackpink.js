const mumaker = require('mumaker');

module.exports = {
    name: 'blackpink',
    category: 'textmaker',
    reactions: { start: '⚙️' },
    description: 'Create a Blackpink style logo text effect',
    usage: '.blackpink <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}blackpink <text>\nExample: ${bot.prefix}blackpink CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/create-a-blackpink-style-logo-with-members-signatures-810.html', text);

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
