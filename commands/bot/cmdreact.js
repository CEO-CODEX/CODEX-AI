const fs = require('fs-extra');

module.exports = {
    name: 'cmdreact',
    aliases: ['commandreact'],
    category: 'bot',
    reactions: { start: '⚙️', success: '✅' },
    description: 'Toggle command reactions',

    async execute(bot, m, args) {
        const sub = String(args[0] || '').toLowerCase();
        if (!bot.config.cmdReact) bot.config.cmdReact = { enabled: false };
        const save = () => fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));

        if (!sub) return m.reply(`cmd reaction ${bot.config.cmdReact.enabled ? 'on' : 'off'}`);
        if (sub === 'on') {
            bot.config.cmdReact.enabled = true;
            save();
            return m.reply('cmd reaction on');
        }
        if (sub === 'off') {
            bot.config.cmdReact.enabled = false;
            save();
            return m.reply('cmd reaction off');
        }
        return m.reply('Use cmdreact on or cmdreact off');
    },
};
