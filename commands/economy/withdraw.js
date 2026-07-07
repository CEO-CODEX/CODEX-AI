const { loadDB, saveDB, getUser, fmt, CURRENCY } = require('../../lib/economyEngine');

module.exports = {
    name: 'withdraw',
    aliases: ['with', 'wd'],
    category: 'economy',
    description: 'Withdraw coins from your bank. Usage: .withdraw <amount|all>',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const input = (args[0] || '').toLowerCase();
        const amount = input === 'all' ? user.bank : parseInt(input);

        if (!amount || amount < 1) return await m.reply(`Usage: *.withdraw <amount>* or *.withdraw all*`);
        if (amount > user.bank) return await m.reply(`❌ You only have *${fmt(user.bank)}* ${CURRENCY} in your bank.`);

        user.bank   -= amount;
        user.wallet += amount;
        saveDB(db);

        await m.reply(`🏦 *WITHDRAWAL SUCCESSFUL!*\n─────────────\nWithdrawn: *${fmt(amount)}* ${CURRENCY}\n👜 Wallet: *${fmt(user.wallet)}* ${CURRENCY}\n🏦 Bank:   *${fmt(user.bank)}* ${CURRENCY}`);
    }
};
