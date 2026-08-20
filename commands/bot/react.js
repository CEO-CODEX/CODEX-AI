const fs = require('fs-extra');

module.exports = {
    name: 'react',
    aliases: ['autoreact'],
    category: 'bot',
    reactions: { start: '⚙️' },
    description: 'Configure auto-react',

    async execute(bot, m, args) {
        const sub  = args[0]?.toLowerCase();
        const save = () => fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));

        if (!bot.config.autoReact) bot.config.autoReact = { enabled: false, emoji: '❤️' };

        if (!sub) return await m.reply(
`react settings
Auto React (every message): ${bot.config.autoReact.enabled ? 'ON' : 'OFF'} | emoji: ${bot.config.autoReact.emoji}
Usage:
${bot.prefix}react auto on/off
${bot.prefix}react auto emoji 😍`);

        if (sub === 'auto') {
            const a = args[1]?.toLowerCase();
            if (a === 'on' || a === 'off') { bot.config.autoReact.enabled = (a === 'on'); save(); return await m.reply(`Auto React is now ${a.toUpperCase()}.`); }
            if (a === 'emoji' && args[2])  { bot.config.autoReact.emoji = args[2]; save(); return await m.reply(`Auto React emoji set to ${args[2]}`); }
        }
        return await m.reply(`Unknown option. Try: ${bot.prefix}react auto on`);
    }
};
