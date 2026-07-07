const { loadDB, saveDB, getUser, addXP, hasItem, removeItem, fmt, CURRENCY } = require('../../lib/economyEngine');

module.exports = {
    name: 'flip',
    aliases: ['coinflip', 'cf'],
    category: 'economy',
    description: 'Flip a coin — bet on heads or tails. Usage: .flip <heads/tails> <amount>',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const side = (args[0] || '').toLowerCase();
        const betArg = args[1] || args[0];
        const bet = parseInt(betArg);

        if (!['heads', 'tails', 'h', 't'].includes(side)) {
            return await m.reply(`Usage: *.flip <heads/tails> <amount>*\nExample: .flip heads 500`);
        }
        if (!bet || bet < 10) return await m.reply(`❌ Minimum bet is *10* ${CURRENCY}.`);
        if (bet > user.wallet) return await m.reply(`❌ You only have *${fmt(user.wallet)}* ${CURRENCY} in your wallet.`);

        const chosen = side === 'h' ? 'heads' : side === 't' ? 'tails' : side;
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = chosen === result;

        // Lucky charm gives +10% edge (rerolled if lost)
        const hasCharm = hasItem(user, 'luckycharm');
        const finalWon = (!won && hasCharm) ? Math.random() < 0.10 : won;

        if (hasCharm) {
            user.inventory._luckycharmUses = (user.inventory._luckycharmUses || 5) - 1;
            if (user.inventory._luckycharmUses <= 0) {
                removeItem(user, 'luckycharm');
                delete user.inventory._luckycharmUses;
            }
        }

        const coinEmoji = result === 'heads' ? '🪙' : '🌑';

        if (finalWon) {
            user.wallet += bet;
            user.stats.earned = (user.stats.earned || 0) + bet;
            addXP(user, 15);
            saveDB(db);
            return await m.reply(`${coinEmoji} *COINFLIP — YOU WIN!*\n─────────────\nYou bet: *${chosen}*\nResult: *${result}*\n+*${fmt(bet)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
        }

        user.wallet -= bet;
        user.stats.lost = (user.stats.lost || 0) + bet;
        saveDB(db);
        await m.reply(`${coinEmoji} *COINFLIP — YOU LOSE!*\n─────────────\nYou bet: *${chosen}*\nResult: *${result}*\n-*${fmt(bet)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
    }
};
