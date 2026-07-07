const { loadDB, saveDB, getUser, fmt, CURRENCY } = require('../../lib/economyEngine');

module.exports = {
    name: 'deposit',
    aliases: ['dep'],
    category: 'economy',
    description: 'Deposit coins into your bank. Usage: .deposit <amount|all>',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const input = (args[0] || '').toLowerCase();
        const amount = input === 'all' ? user.wallet : parseInt(input);

        if (!amount || amount < 1) return await m.reply(`Usage: *.deposit <amount>* or *.deposit all*`);
        if (amount > user.wallet) return await m.reply(`❌ You only have *${fmt(user.wallet)}* ${CURRENCY} in your wallet.`);

        user.wallet -= amount;
        user.bank   += amount;
        saveDB(db);

        await m.reply(`🏦 *DEPOSIT SUCCESSFUL!*\n─────────────\nDeposited: *${fmt(amount)}* ${CURRENCY}\n👜 Wallet: *${fmt(user.wallet)}* ${CURRENCY}\n🏦 Bank:   *${fmt(user.bank)}* ${CURRENCY}`);
    }
};
