const { loadDB, saveDB, getUser, addXP, fmt, CURRENCY } = require('../../lib/economyEngine');

// 0–36, alternating red/black (standard roulette layout)
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function spinWheel() {
    return Math.floor(Math.random() * 37); // 0–36
}

module.exports = {
    name: 'roulette',
    aliases: ['rl'],
    category: 'economy',
    description: 'Bet on red/black or a number. Usage: .roulette <red|black|0-36> <amount>',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const betOn = (args[0] || '').toLowerCase();
        const bet   = parseInt(args[1] || args[0]);

        if (!betOn || !bet || bet < 10) {
            return await m.reply(
`Usage: *.roulette <bet> <amount>*
Bets:
  • red / black  (x2 payout)
  • even / odd   (x2 payout)
  • 0–36         (x36 payout!)
Example: .roulette red 300
Example: .roulette 7 100`);
        }

        if (bet > user.wallet) return await m.reply(`❌ You only have *${fmt(user.wallet)}* ${CURRENCY} in your wallet.`);

        const result = spinWheel();
        const isRed   = RED_NUMBERS.has(result);
        const isBlack = result !== 0 && !isRed;
        const color   = result === 0 ? '🟢 Green' : isRed ? '🔴 Red' : '⚫ Black';

        let multiplier = 0;
        let validBet = true;

        if (betOn === 'red')   multiplier = isRed ? 2 : 0;
        else if (betOn === 'black') multiplier = isBlack ? 2 : 0;
        else if (betOn === 'even') multiplier = result !== 0 && result % 2 === 0 ? 2 : 0;
        else if (betOn === 'odd')  multiplier = result % 2 !== 0 ? 2 : 0;
        else {
            const num = parseInt(betOn);
            if (!isNaN(num) && num >= 0 && num <= 36) {
                multiplier = num === result ? 36 : 0;
            } else {
                validBet = false;
            }
        }

        if (!validBet) return await m.reply(`❌ Invalid bet. Use *red*, *black*, *even*, *odd*, or a number *0–36*.`);

        const header = `🎡 *ROULETTE*\n─────────────\nBall landed on: *${result}* ${color}\nYou bet on: *${betOn}*\n─────────────`;

        if (multiplier > 0) {
            const winnings = bet * multiplier;
            user.wallet += winnings - bet;
            user.stats.earned = (user.stats.earned || 0) + winnings;
            addXP(user, 20);
            saveDB(db);
            return await m.reply(`${header}\n🏆 *YOU WIN! x${multiplier}*\n+*${fmt(winnings)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
        }

        user.wallet -= bet;
        user.stats.lost = (user.stats.lost || 0) + bet;
        saveDB(db);
        await m.reply(`${header}\n💀 *YOU LOSE!*\n-*${fmt(bet)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
    }
};
