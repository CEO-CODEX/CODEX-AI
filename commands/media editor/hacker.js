const mumaker = require('mumaker');

module.exports = {
    name: 'hacker',
    category: 'textmaker',
    description: 'Create an anonymous hacker cyan neon text effect',
    usage: '.hacker <text>',

    async execute(bot, m, args) {
        const text = args.join(' ');

        if (!text) {
            return m.reply(`Usage: ${bot.prefix}hacker <text>\nExample: ${bot.prefix}hacker CODEX`);
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html', text);

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
