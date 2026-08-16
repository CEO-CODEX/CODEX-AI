const fs = require('fs-extra');

module.exports = {
    name: 'settings',
    aliases: ['setting'],
    category: 'bot',
    description: 'Toggle bot settings on/off',

    async execute(bot, m, args) {
        const key = args[0]?.toLowerCase();
        const c   = bot.config;

        const toggles = {
            typing: 'autoTyping', autotyping: 'autoTyping',
            recording: 'autoRecording',
            read: 'autoRead', autoread: 'autoRead',
            online: 'alwaysOnline', alwaysonline: 'alwaysOnline',
            anticall: 'antiCall', welcome: 'welcome', goodbye: 'goodbye',
        };

        if (key && toggles[key]) {
            const field = toggles[key];
            c[field] = !c[field];
            fs.writeFileSync('./config.json', JSON.stringify(c, null, 2));
            return await m.reply(`${key.toUpperCase()} is now ${c[field] ? 'ON' : 'OFF'}`);
        }

        return await m.reply(
`settings
Usage: ${bot.prefix}settings <name>

typing       - ${c.autoTyping    ? 'ON' : 'OFF'}
recording    - ${c.autoRecording ? 'ON' : 'OFF'}
read         - ${c.autoRead      ? 'ON' : 'OFF'}
online       - ${c.alwaysOnline  ? 'ON' : 'OFF'}
anticall     - ${c.antiCall      ? 'ON' : 'OFF'}
welcome      - ${c.welcome       ? 'ON' : 'OFF'}
goodbye      - ${c.goodbye       ? 'ON' : 'OFF'}`);
    }
};
