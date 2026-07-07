const { loadDB, saveDB, getUser, onCooldown, setCooldown, formatCooldown, addXP, fmt, CURRENCY } = require('../../lib/economyEngine');

const COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

module.exports = {
    name: 'daily',
    category: 'economy',
    description: 'Claim your daily reward',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const wait = onCooldown(user, 'daily', COOLDOWN);
        if (wait) return await m.reply(`⏳ You already claimed your daily reward!\nCome back in *${formatCooldown(wait)}*.`);

        const reward = Math.floor(Math.random() * 500) + 300; // 300–800
        user.wallet += reward;
        user.stats.earned = (user.stats.earned || 0) + reward;
        setCooldown(user, 'daily');
        const leveled = addXP(user, 50);
        const _now2=Date.now(),_lastD=user.lastDaily||0;
        user.streak=(_now2-_lastD)<172800000?(user.streak||0)+1:1;
        user.lastDaily=_now2;
        user.nerve=user.maxNerve||100;
        user.energy=user.maxEnergy||100;
        saveDB(db);

        let text = `🎁 *DAILY REWARD CLAIMED!*\n─────────────\n+*${fmt(reward)}* ${CURRENCY} added to your wallet!\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`;
        if (leveled) text += `\n\n🎉 *LEVEL UP!* You are now Level *${user.level}*!`;
        await m.reply(text);
    }
};
