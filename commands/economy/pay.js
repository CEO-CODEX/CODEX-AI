const { getTarget } = require('../../lib/getTarget');
const { loadDB, saveDB, getUser, fmt, CURRENCY } = require('../../lib/economyEngine');

module.exports = {
    name: 'pay',
    aliases: ['transfer', 'send'],
    category: 'economy',
    description: 'Send coins to another user. Usage: .pay @user <amount>',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const targetJid = getTarget(m);
        const amount    = parseInt(args[1] || args[0]);

        if (!targetJid) return await m.reply(`Usage: *.pay @user <amount>*\nExample: .pay @john 500`);
        if (targetJid === m.sender.replace(/:[0-9]+@/, '@')) return await m.reply(`❌ You can't pay yourself!`);
        if (!amount || amount < 1) return await m.reply(`❌ Enter a valid amount.`);
        if (amount > user.wallet) return await m.reply(`❌ Insufficient funds. You have *${fmt(user.wallet)}* ${CURRENCY}.`);

        const target = getUser(db, targetJid);
        user.wallet   -= amount;
        target.wallet += amount;
        saveDB(db);

        await m.reply(`💸 *TRANSFER SUCCESSFUL!*\n─────────────\nSent *${fmt(amount)}* ${CURRENCY} to @${targetJid.split('@')[0]}\n💼 Your Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
    }
};
