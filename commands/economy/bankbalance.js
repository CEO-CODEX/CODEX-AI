const { loadDB, getUser, fmt, CURRENCY } = require('../../lib/economyEngine');

module.exports = {
    name: 'bankbalance',
    aliases: ['bank', 'bb'],
    category: 'economy',
    description: 'Check your bank balance',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        await m.reply(
`🏦 *BANK BALANCE*

👜 Wallet: *${fmt(user.wallet)}* ${CURRENCY}
🏦 Bank:   *${fmt(user.bank)}* ${CURRENCY}

💡 Bank coins are safe from *.rob*
Use *.deposit* / *.withdraw* to manage.`);
    }
};
