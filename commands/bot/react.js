const fs = require('fs-extra');

module.exports = {
    name: 'react',
    aliases: ['autoreact', 'mentionreact'],
    category: 'bot',
    description: 'Configure auto-react and mention-react',

    async execute(bot, m, args) {
        const sub  = args[0]?.toLowerCase();
        const save = () => fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));

        if (!bot.config.autoReact)    bot.config.autoReact    = { enabled: false, emoji: '❤️' };
        if (!bot.config.mentionReact) bot.config.mentionReact = { enabled: false, emoji: '❤️' };

        if (!sub) return await m.reply(
`react settings
Auto React (every message): ${bot.config.autoReact.enabled ? 'ON' : 'OFF'} | emoji: ${bot.config.autoReact.emoji}
Mention React (when tagged): ${bot.config.mentionReact.enabled ? 'ON' : 'OFF'} | emoji: ${bot.config.mentionReact.emoji}

Usage:
${bot.prefix}react auto on/off
${bot.prefix}react auto emoji 😍
${bot.prefix}react mention on/off
${bot.prefix}react mention emoji 🔥`);

        if (sub === 'auto') {
            const a = args[1]?.toLowerCase();
            if (a === 'on' || a === 'off') { bot.config.autoReact.enabled = (a === 'on'); save(); return await m.reply(`Auto React is now ${a.toUpperCase()}.`); }
            if (a === 'emoji' && args[2])  { bot.config.autoReact.emoji = args[2]; save(); return await m.reply(`Auto React emoji set to ${args[2]}`); }
        }
        if (sub === 'mention') {
            const a = args[1]?.toLowerCase();
            if (a === 'on' || a === 'off') { bot.config.mentionReact.enabled = (a === 'on'); save(); return await m.reply(`Mention React is now ${a.toUpperCase()}.`); }
            if (a === 'emoji' && args[2])  { bot.config.mentionReact.emoji = args[2]; save(); return await m.reply(`Mention React emoji set to ${args[2]}`); }
        }
        return await m.reply(`Unknown option. Try: ${bot.prefix}react auto on or ${bot.prefix}react mention on`);
    }
};
