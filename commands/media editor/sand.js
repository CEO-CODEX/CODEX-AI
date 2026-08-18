const mumaker = require('mumaker');

module.exports = {
    name: 'sand',
    category: 'textmaker',
    reactions: { start: '⚙️' },
    description: 'Create a sand/beach writing text effect',
    usage: '.sand <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}sand <text>\nExample: ${bot.prefix}sand CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html', text);

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
