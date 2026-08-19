const fs = require('fs-extra');

module.exports = {
  name: 'autoreactstatus',
  aliases: ['statusreact', 'autoreactonstatus'],
  category: 'owner',
  ownerOnly: true,
  reactions: { start: '💚' },
  description: 'Automatically react to WhatsApp statuses',
  async execute(bot, m, args) {
    const action = String(args[0] || '').toLowerCase();
    if (!['on', 'off', 'status'].includes(action)) return m.reply(`Usage: ${bot.prefix}autoreactstatus on|off|status`);
    bot.config.statusReact = bot.config.statusReact || { emoji: '💚' };
    if (action === 'status') return m.reply(`Auto status reaction: ${bot.config.statusReact.enabled ? 'ON' : 'OFF'}\nEmoji: ${bot.config.statusReact.emoji || '💚'}`);
    bot.config.statusReact.enabled = action === 'on';
    fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
    return m.reply(`Auto status reaction: ${action.toUpperCase()}`);
  },
};
