const { loadDB, getUser, fmt, xpForLevel, CURRENCY } = require('../../lib/economyEngine');

module.exports = {
    name: 'rank',
    aliases: ['level', 'xp'],
    category: 'economy',
    description: 'Check your current level and XP',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const currentXP = user.xp;
        const level     = user.level;
        const xpNeeded  = xpForLevel(level + 1);
        const prevXP    = xpForLevel(level);
        const progress  = currentXP - prevXP;
        const total     = xpNeeded - prevXP;
        const filled    = Math.max(0, Math.min(10, Math.round((progress / total) * 10)));
        const bar       = '▓'.repeat(filled) + '░'.repeat(10 - filled);

        await m.reply(
`⭐ *RANK & LEVEL*

🏅 Level: *${level}*
📊 XP: *${fmt(currentXP)}* / *${fmt(xpNeeded)}*
Progress: [${bar}]

Need *${fmt(xpNeeded - currentXP)}* more XP to level up!
Earn XP by working, fishing, hunting, mining & gambling.`);
    }
};
