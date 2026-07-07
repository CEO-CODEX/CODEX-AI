const fs = require('fs-extra');

module.exports = {
    name: 'anticall',
    aliases: ['callblock'],
    category: 'bot',
    description: 'Configure anti-call mode',

    async execute(bot, m, args) {
        const sub = args[0]?.toLowerCase();

        const current = bot.config.antiCall;
        const mode = (typeof current === 'object') ? (current.mode || 'default') : (current ? 'default' : 'off');

        if (!sub) return await m.reply(
`anticall settings
Current: ${mode.toUpperCase()}

Modes:
off     - calls are allowed
default - reject call + send message
block   - reject call + block caller + send message

Usage:
${bot.prefix}anticall off
${bot.prefix}anticall default
${bot.prefix}anticall block`);

        if (!['off', 'default', 'block'].includes(sub)) return await m.reply(`Unknown mode. Use: off, default, or block`);

        if (sub === 'off') {
            bot.config.antiCall = false;
        } else {
            bot.config.antiCall = { mode: sub };
        }
        fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
        await m.reply(`Anti-call set to: ${sub.toUpperCase()}`);
    }
};
