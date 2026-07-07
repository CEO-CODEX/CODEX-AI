const { loadDB, saveDB, getUser, addXP, hasItem, removeItem, fmt, CURRENCY } = require('../../lib/economyEngine');

const REELS = ['🍒','🍋','🍊','🍇','💎','🎰','⭐','7️⃣'];

// Multipliers: [3-of-a-kind multiplier, 2-of-a-kind multiplier or 0]
const MULTIPLIERS = {
    '7️⃣': { three: 10, two: 0 },
    '💎': { three: 7,  two: 2 },
    '🎰': { three: 5,  two: 0 },
    '⭐': { three: 4,  two: 0 },
    '🍇': { three: 3,  two: 0 },
    '🍊': { three: 2,  two: 0 },
    '🍋': { three: 2,  two: 0 },
    '🍒': { three: 1.5, two: 0.5 },
};

function spin() {
    return REELS[Math.floor(Math.random() * REELS.length)];
}

module.exports = {
    name: 'slots',
    aliases: ['slot'],
    category: 'economy',
    description: 'Play the slot machine. Usage: .slots <amount>',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const bet = parseInt(args[0]);
        if (!bet || bet < 10) return await m.reply(`Usage: *.slots <amount>*\nMinimum bet: *10* ${CURRENCY}\nExample: .slots 200`);
        if (bet > user.wallet) return await m.reply(`❌ You only have *${fmt(user.wallet)}* ${CURRENCY} in your wallet.`);

        const r1 = spin(), r2 = spin(), r3 = spin();

        let multiplier = 0;
        let resultMsg = '';

        if (r1 === r2 && r2 === r3) {
            multiplier = MULTIPLIERS[r1]?.three || 1.5;
            resultMsg = `🎉 *JACKPOT! THREE OF A KIND!*`;
        } else if (r1 === r2 || r2 === r3 || r1 === r3) {
            const match = r1 === r2 ? r1 : r2 === r3 ? r2 : r1;
            multiplier = MULTIPLIERS[match]?.two || 0;
            resultMsg = multiplier > 0 ? `✨ *TWO OF A KIND!*` : `❌ *NO WIN*`;
        } else {
            resultMsg = `❌ *NO WIN*`;
        }

        const slotDisplay = `\n  ${r1}  ${r2}  ${r3}  \n`;

        if (multiplier > 0) {
            const winnings = Math.floor(bet * multiplier);
            user.wallet += winnings - bet; // net gain
            user.stats.earned = (user.stats.earned || 0) + winnings;
            addXP(user, 20);
            saveDB(db);
            return await m.reply(`🎰 *SLOT MACHINE*\n${slotDisplay}\n\n${resultMsg}\nMultiplier: *x${multiplier}*\n+*${fmt(winnings)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
        }

        user.wallet -= bet;
        user.stats.lost = (user.stats.lost || 0) + bet;
        saveDB(db);
        await m.reply(`🎰 *SLOT MACHINE*\n${slotDisplay}\n\n${resultMsg}\n-*${fmt(bet)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
    }
};
