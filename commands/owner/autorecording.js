const fs = require('fs-extra');

module.exports = {
    name: 'autorecording',
    aliases: ['recording', 'autorecord'],
    category: 'owner',
    reactions: { start: '🎙️' },
    ownerOnly: true,
    description: 'Toggle automatic recording presence',

    async execute(bot, m, args) {
        const value = String(args[0] || '').toLowerCase();
        if (!['on', 'off'].includes(value)) return m.reply(`Usage: ${bot.prefix}autorecording on/off`);
        bot.config.autoRecording = value === 'on';
        if (bot.config.autoRecording) bot.config.autoRecordTyping = false;
        fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
        return m.reply(`Auto recording: ${bot.config.autoRecording ? 'ON' : 'OFF'}`);
    },
};
