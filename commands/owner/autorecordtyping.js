const fs = require('fs-extra');

module.exports = {
    name: 'autorecordtyping',
    aliases: ['recordtyping', 'art'],
    category: 'owner',
    reactions: { start: '🎙️' },
    ownerOnly: true,
    description: 'Toggle automatic recording then typing presence',

    async execute(bot, m, args) {
        const value = String(args[0] || '').toLowerCase();
        if (!['on', 'off'].includes(value)) return m.reply(`Usage: ${bot.prefix}autorecordtyping on/off`);
        bot.config.autoRecordTyping = value === 'on';
        if (bot.config.autoRecordTyping) {
            bot.config.autoTyping = false;
            bot.config.autoRecording = false;
        }
        fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
        return m.reply(`Auto record typing: ${bot.config.autoRecordTyping ? 'ON' : 'OFF'}`);
    },
};
