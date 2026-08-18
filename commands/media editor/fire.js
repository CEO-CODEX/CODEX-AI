const mumaker = require('mumaker');

module.exports = {
    name: 'fire',
    category: 'textmaker',
    reactions: { start: '⚙️' },
    description: 'Create a flame/fire text effect',
    usage: '.fire <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}fire <text>\nExample: ${bot.prefix}fire CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/flame-lettering-effect-372.html', text);

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
