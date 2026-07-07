const { getGtaUser, saveGtaUser, getWantedLabel } = require('../../lib/gtaEngine');

const WANTED_FINE = [0, 500, 1500, 5000, 15000, 50000];

module.exports = {
    name: 'wanted',
    aliases: ['stars', 'police', 'wantedlevel'],
    category: 'gta',
    description: 'View or clear your wanted level',

    async execute(bot, m, args) {
        const gta = getGtaUser(m.sender);
        const sub = args[0]?.toLowerCase();
        const stars = gta.wantedStars || 0;

        if (!sub) {
            const label = getWantedLabel(stars);
            const msgs = [
                '✅ You\'re clean. No heat.',
                '🚔 Police are watching you.',
                '🚔🚔 Pursuit initiated! Shake them!',
                '🚨 SWAT deployed. You\'re a felon!',
                '🚨🚁 SWAT + Helicopter. Get out!',
                '🚁🚁 FBI + Military. You\'re done!',
            ];
            const responses = [
                '', 'Lay low for a while.', 'Try losing them in traffic.',
                'Get to a Pay \'N\' Spray!', 'Change your outfit NOW!', 'You\'re public enemy #1!'
            ];
            return await m.reply(
`⭐ *WANTED LEVEL*

${label}
${msgs[Math.min(stars,5)]}

${stars > 0 ? `💡 Tip: ${responses[Math.min(stars,5)]}\n\nClear heat: ${bot.prefix}wanted clear (costs 🪙${(WANTED_FINE[Math.min(stars,5)]).toLocaleString()})` : 'You have no wanted stars.'}

Kills: ${gta.kills || 0} | Deaths: ${gta.deaths || 0}`);
        }

        if (sub === 'clear') {
            if (!stars) return await m.reply('✅ You\'re already clean!');
            const fine = WANTED_FINE[Math.min(stars,5)];
            const { loadDB, saveDB, getUser, fmt } = require('../../lib/economyEngine');
            const db = loadDB(); const user = getUser(db, m.sender);
            if ((user.wallet||0) < fine) return await m.reply(`❌ Need 🪙${fine.toLocaleString()} to pay off police.\nYou have: 🪙${fmt(user.wallet||0)}`);
            user.wallet -= fine;
            saveDB(db);
            gta.wantedStars = 0;
            saveGtaUser(m.sender, gta);
            return await m.reply(`✅ Wanted level cleared!\nPaid bribe: 🪙${fine.toLocaleString()}\nYou're clean now. 🤝`);
        }
    }
};
