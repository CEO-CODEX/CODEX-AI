const { loadDB, getLeaderboard, fmt, CURRENCY } = require('../../lib/economyEngine');

module.exports = {
    name: 'leaderboard',
    aliases: ['richlist', 'lb', 'top'],
    category: 'economy',
    description: 'Top 10 richest users',

    async execute(bot, m, args) {
        const db = loadDB();
        const top = getLeaderboard(db, 10);

        if (!top.length) return await m.reply('No economy data yet. Start earning with *.daily*!');

        const medals = ['🥇','🥈','🥉'];
        const rows = top.map((entry, i) => {
            const medal = medals[i] || `${i + 1}.`;
            const num = entry.jid.split('@')[0];
            return `${medal} +${num}  —  *${fmt(entry.total)}* ${CURRENCY}  ⭐ Lv.${entry.level}`;
        }).join('\n');

        await m.reply(`🏆 *RICH LIST — TOP ${top.length}*\n─────────────\n${rows}\n─────────────`);
    }
};
