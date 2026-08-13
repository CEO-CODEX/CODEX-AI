const bankStore = require('../../lib/bankStore');

module.exports = {
    name: 'bank',
    aliases: ['aza', 'account'],
    category: 'tools',
    description: 'View the bank/account details set by the owner.',

    async execute(bot, m) {
        const details = bankStore.get();

        if (!details.accNumber) {
            return m.reply(`No account set yet. Use ${bot.prefix}setbank to add one.`);
        }

        let msg =
            `Bank: ${details.bankName}\n` +
            `Account: ${details.accNumber}\n` +
            `Name: ${details.accName}`;

        if (details.phone) msg += `\nPhone: ${details.phone}`;
        if (details.note) msg += `\nNote: ${details.note}`;

        await m.reply(msg);
    },
};
