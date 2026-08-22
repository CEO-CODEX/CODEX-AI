const { loadDB, saveDB, getUser } = require('../../lib/economyEngine');
const { setPin } = require('../../lib/economyPin');

module.exports = {
  name: 'setpin',
  aliases: ['economypin', 'changepin'],
  category: 'economy',
  description: 'Set or change your economy PIN.',
  async execute(bot, m, args) {
    const db = loadDB();
    const user = getUser(db, m.sender);
    if (!setPin(user, args[0])) {
      return m.reply(`Usage: ${bot.prefix}setpin <4-8 digits>`);
    }
    saveDB(db);
    return m.reply('Economy PIN saved. You will need it for pay, deposit, and withdraw.');
  },
};
