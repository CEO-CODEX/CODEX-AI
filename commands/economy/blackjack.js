const { loadDB, saveDB, getUser, addXP, fmt, CURRENCY } = require('../../lib/economyEngine');
const fs = require('fs-extra');

const BJ_DB = './database/blackjack_sessions.json';

const SUITS  = ['♠️','♥️','♦️','♣️'];
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function freshDeck() {
    const deck = [];
    for (const s of SUITS) for (const v of VALUES) deck.push(`${v}${s}`);
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function cardValue(card) {
    const v = card.replace(/[♠️♥️♦️♣️]/g, '').replace(/[JQKA]/g, m => m === 'A' ? '11' : '10');
    return parseInt(v);
}

function handTotal(cards) {
    let total = cards.reduce((s, c) => s + cardValue(c), 0);
    let aces = cards.filter(c => c.startsWith('A')).length;
    while (total > 21 && aces-- > 0) total -= 10;
    return total;
}

function loadSessions() {
    try { return JSON.parse(fs.readFileSync(BJ_DB, 'utf8')); } catch { return {}; }
}
function saveSessions(s) { fs.ensureDirSync('./database'); fs.writeFileSync(BJ_DB, JSON.stringify(s, null, 2)); }

module.exports = {
    name: 'blackjack',
    aliases: ['bj'],
    category: 'economy',
    description: 'Play Blackjack vs the bot. Usage: .blackjack <amount> | .bj hit | .bj stand',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);
        const sessions = loadSessions();
        const sess = sessions[m.sender];

        // ── Ongoing game ─────────────────────────────────────────────────────
        if (sess) {
            const action = (args[0] || '').toLowerCase();

            if (action === 'hit') {
                sess.playerHand.push(sess.deck.shift());
                const total = handTotal(sess.playerHand);

                if (total > 21) {
                    // Bust
                    user.wallet -= sess.bet;
                    user.stats.lost = (user.stats.lost || 0) + sess.bet;
                    delete sessions[m.sender];
                    saveSessions(sessions);
                    saveDB(db);
                    return await m.reply(`🃏 *BLACKJACK — BUST!*\n─────────────\nYour hand: ${sess.playerHand.join(' ')} = *${total}*\n\n💀 You busted! -*${fmt(sess.bet)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
                }

                saveSessions(sessions);
                return await m.reply(`🃏 *BLACKJACK — HIT*\n─────────────\nYour hand: ${sess.playerHand.join(' ')} = *${total}*\nDealer shows: ${sess.dealerHand[0]} *?*\n\nType *.bj hit* or *.bj stand*`);
            }

            if (action === 'stand') {
                // Dealer plays
                while (handTotal(sess.dealerHand) < 17) sess.dealerHand.push(sess.deck.shift());
                const pTotal = handTotal(sess.playerHand);
                const dTotal = handTotal(sess.dealerHand);

                delete sessions[m.sender];
                saveSessions(sessions);

                const header = `🃏 *BLACKJACK — RESULT*\n─────────────\nYour hand: ${sess.playerHand.join(' ')} = *${pTotal}*\nDealer hand: ${sess.dealerHand.join(' ')} = *${dTotal}*\n─────────────`;

                if (pTotal > dTotal || dTotal > 21) {
                    user.wallet += sess.bet;
                    user.stats.earned = (user.stats.earned || 0) + sess.bet;
                    addXP(user, 25);
                    saveDB(db);
                    return await m.reply(`${header}\n🏆 *YOU WIN!*\n+*${fmt(sess.bet)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
                }
                if (pTotal === dTotal) {
                    saveDB(db);
                    return await m.reply(`${header}\n🤝 *PUSH — TIE!*\nNo coins lost.\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
                }

                user.wallet -= sess.bet;
                user.stats.lost = (user.stats.lost || 0) + sess.bet;
                saveDB(db);
                return await m.reply(`${header}\n💀 *DEALER WINS!*\n-*${fmt(sess.bet)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
            }

            return await m.reply(`🃏 Active game!\nYour hand: ${sess.playerHand.join(' ')} = *${handTotal(sess.playerHand)}*\nDealer shows: ${sess.dealerHand[0]} *?*\n\nType *.bj hit* or *.bj stand*`);
        }

        // ── New game ─────────────────────────────────────────────────────────
        const bet = parseInt(args[0]);
        if (!bet || bet < 10) return await m.reply(`Usage: *.blackjack <amount>*\nThen: *.bj hit* or *.bj stand*\nExample: .bj 500`);
        if (bet > user.wallet) return await m.reply(`❌ You only have *${fmt(user.wallet)}* ${CURRENCY} in your wallet.`);

        const deck = freshDeck();
        const playerHand = [deck.shift(), deck.shift()];
        const dealerHand = [deck.shift(), deck.shift()];

        // Blackjack check
        if (handTotal(playerHand) === 21) {
            const winnings = Math.floor(bet * 1.5);
            user.wallet += winnings;
            user.stats.earned = (user.stats.earned || 0) + winnings;
            addXP(user, 30);
            saveDB(db);
            return await m.reply(`🃏 *BLACKJACK!*\n─────────────\nYour hand: ${playerHand.join(' ')} = *21*\n\n🎉 *BLACKJACK! x1.5 payout!*\n+*${fmt(winnings)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
        }

        sessions[m.sender] = { playerHand, dealerHand, deck, bet };
        saveSessions(sessions);

        await m.reply(`🃏 *BLACKJACK — NEW GAME*\n─────────────\nBet: *${fmt(bet)}* ${CURRENCY}\nYour hand: ${playerHand.join(' ')} = *${handTotal(playerHand)}*\nDealer shows: ${dealerHand[0]} *?*\n─────────────\nType *.bj hit* or *.bj stand*`);
    }
};
