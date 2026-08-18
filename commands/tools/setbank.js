const bankStore = require('../../lib/bankStore');

module.exports = {
    name: 'setbank',
    aliases: ['setaza', 'sendaza'],
    category: 'tools',
    reactions: { start: '🛡️' },
    description: 'Set the bank/account details shown by .bank. Owner only.',
    usage: '.setbank <Bank> <AccNumber> <AccName> [Phone] [Note]',
    ownerOnly: true,

    async execute(bot, m, args) {
        if (args.length < 3) {
            return m.reply(
                `Usage: ${bot.prefix}setbank Bank AccNumber AccName [Phone] [Note]\n` +
                `Example: ${bot.prefix}setbank Opay 8123456789 John Doe 08012345678 Donation`
            );
        }

        const bankName = args[0];
        const accNumber = args[1];
        const remaining = args.slice(2);

        const accName = remaining.slice(0, remaining.length - (remaining.length > 2 ? 2 : 0)).join(' ');
        const phone = remaining.length > 2 ? remaining[remaining.length - 2] : '';
        const note = remaining.length > 2 ? remaining[remaining.length - 1] : '';

        bankStore.set({
            bankName,
            accNumber,
            accName,
            phone,
            note,
            setBy: m.sender.split('@')[0],
        });

        let msg =
            `Account updated.\n` +
            `Bank: ${bankName}\n` +
            `Account: ${accNumber}\n` +
            `Name: ${accName}`;

        if (phone) msg += `\nPhone: ${phone}`;
        if (note) msg += `\nNote: ${note}`;

        await m.reply(msg);
    },
};
