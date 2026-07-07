const { loadDB, saveDB, getUser, onCooldown, setCooldown, formatCooldown, addXP, fmt, CURRENCY } = require('../../lib/economyEngine');

const COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 days

module.exports = {
    name: 'weekly',
    category: 'economy',
    description: 'Claim your weekly reward',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const wait = onCooldown(user, 'weekly', COOLDOWN);
        if (wait) return await m.reply(`⏳ Weekly reward already claimed!\nCome back in *${formatCooldown(wait)}*.`);

        const reward = Math.floor(Math.random() * 3000) + 2000; // 2000–5000
        user.wallet += reward;
        user.stats.earned = (user.stats.earned || 0) + reward;
        setCooldown(user, 'weekly');
        const leveled = addXP(user, 200);
        saveDB(db);

        let text = `🎁 *WEEKLY REWARD CLAIMED!*\n─────────────\n+*${fmt(reward)}* ${CURRENCY} added to your wallet!\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`;
        if (leveled) text += `\n\n🎉 *LEVEL UP!* You are now Level *${user.level}*!`;
        await m.reply(text);
    }
};
