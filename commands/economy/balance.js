const { loadDB, getUser, fmt, CURRENCY } = require('../../lib/economyEngine');

module.exports = {
    name: 'balance',
    aliases: ['bal', 'wallet'],
    category: 'economy',
    description: 'Check your coin balance',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const text =
`💰 *WALLET BALANCE*

👜 Wallet: *${fmt(user.wallet)}* ${CURRENCY}
🏦 Bank:   *${fmt(user.bank)}* ${CURRENCY}

💎 Total:  *${fmt(user.wallet + user.bank)}* ${CURRENCY}`;

        await m.reply(text);
    }
};
