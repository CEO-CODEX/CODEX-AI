const { loadDB, saveDB, getUser, addXP, fmt, CURRENCY } = require('../../lib/economyEngine');

const DICE_EMOJI = ['','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'];

module.exports = {
    name: 'dice',
    aliases: ['roll'],
    category: 'economy',
    description: 'Roll dice vs the bot. Higher roll wins. Usage: .dice <amount>',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const bet = parseInt(args[0]);
        if (!bet || bet < 10) return await m.reply(`Usage: *.dice <amount>*\nHighest roll wins!\nExample: .dice 300`);
        if (bet > user.wallet) return await m.reply(`❌ You only have *${fmt(user.wallet)}* ${CURRENCY} in your wallet.`);

        const playerRoll = Math.floor(Math.random() * 6) + 1;
        const botRoll    = Math.floor(Math.random() * 6) + 1;

        const pEmoji = DICE_EMOJI[playerRoll];
        const bEmoji = DICE_EMOJI[botRoll];

        if (playerRoll > botRoll) {
            user.wallet += bet;
            user.stats.earned = (user.stats.earned || 0) + bet;
            addXP(user, 15);
            saveDB(db);
            return await m.reply(`🎲 *DICE ROLL*\n─────────────\nYou: ${pEmoji} *${playerRoll}*  vs  Bot: ${bEmoji} *${botRoll}*\n\n🏆 *YOU WIN!*\n+*${fmt(bet)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
        }

        if (playerRoll === botRoll) {
            saveDB(db);
            return await m.reply(`🎲 *DICE ROLL*\n─────────────\nYou: ${pEmoji} *${playerRoll}*  vs  Bot: ${bEmoji} *${botRoll}*\n\n🤝 *TIE! No coins lost.*\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
        }

        user.wallet -= bet;
        user.stats.lost = (user.stats.lost || 0) + bet;
        saveDB(db);
        await m.reply(`🎲 *DICE ROLL*\n─────────────\nYou: ${pEmoji} *${playerRoll}*  vs  Bot: ${bEmoji} *${botRoll}*\n\n💀 *YOU LOSE!*\n-*${fmt(bet)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
    }
};
