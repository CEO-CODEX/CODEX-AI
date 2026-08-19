const fs = require('fs-extra');

module.exports = {
  name: 'autostatus',
  aliases: ['autostatusview', 'statusview'],
  category: 'owner',
  ownerOnly: true,
  reactions: { start: '👁️' },
  description: 'Automatically view WhatsApp statuses',
  async execute(bot, m, args) {
    const action = String(args[0] || '').toLowerCase();
    if (!['on', 'off', 'status'].includes(action)) return m.reply(`Usage: ${bot.prefix}autostatus on|off|status`);
    bot.config.statusView = bot.config.statusView || {};
    if (action === 'status') return m.reply(`Auto status view: ${bot.config.statusView.enabled ? 'ON' : 'OFF'}`);
    bot.config.statusView.enabled = action === 'on';
    fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
    return m.reply(`Auto status view: ${action.toUpperCase()}`);
  },
};
