const fs = require('fs-extra');

module.exports = {
    name: 'autotyping',
    aliases: ['typing', 'autotype'],
    category: 'owner',
    reactions: { start: '⌨️' },
    ownerOnly: true,
    description: 'Toggle automatic typing presence',

    async execute(bot, m, args) {
        const value = String(args[0] || '').toLowerCase();
        if (!['on', 'off'].includes(value)) return m.reply(`Usage: ${bot.prefix}autotyping on/off`);
        bot.config.autoTyping = value === 'on';
        if (bot.config.autoTyping) bot.config.autoRecordTyping = false;
        fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
        return m.reply(`Auto typing: ${bot.config.autoTyping ? 'ON' : 'OFF'}`);
    },
};
