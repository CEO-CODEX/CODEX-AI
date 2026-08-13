const mumaker = require('mumaker');

module.exports = {
    name: 'metallic',
    category: 'textmaker',
    description: 'Create a decorative 3D metal text effect',
    usage: '.metallic <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}metallic <text>\nExample: ${bot.prefix}metallic CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/impressive-decorative-3d-metal-text-effect-798.html', text);

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
