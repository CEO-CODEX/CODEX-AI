const { loadDB, getUser, fmt, xpForLevel } = require('../../lib/economyEngine');

module.exports = {
    name: 'levelup',
    aliases: ['lvlup', 'nextlevel'],
    category: 'economy',
    description: 'Check XP requirements for next level',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const rows = [];
        for (let i = user.level; i <= user.level + 5; i++) {
            const xp = xpForLevel(i + 1);
            const marker = i === user.level ? ' ← *you are here*' : '';
            rows.push(`Level *${i}* → *${i + 1}*: *${fmt(xp)}* XP needed${marker}`);
        }

        await m.reply(`📈 *LEVEL REQUIREMENTS*\n─────────────\n${rows.join('\n')}\n─────────────\nYour XP: *${fmt(user.xp)}*`);
    }
};
