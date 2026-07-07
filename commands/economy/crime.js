const { loadDB, saveDB, getUser, onCooldown, setCooldown, formatCooldown, addXP, fmt, CURRENCY } = require('../../lib/economyEngine');

const COOLDOWN = 60 * 60 * 1000; // 1 hour

const CRIMES = [
    { action: 'robbed a bank', reward: [800, 2000], fine: [200, 600] },
    { action: 'pickpocketed a tourist', reward: [200, 600], fine: [100, 300] },
    { action: 'hacked a system', reward: [500, 1500], fine: [300, 800] },
    { action: 'hijacked a delivery truck', reward: [600, 1800], fine: [250, 700] },
    { action: 'counterfeited currency', reward: [400, 1200], fine: [200, 500] },
];

module.exports = {
    name: 'crime',
    category: 'economy',
    description: 'Commit a crime — high reward, risk of fine (1h cooldown)',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const wait = onCooldown(user, 'crime', COOLDOWN);
        if (wait) return await m.reply(`⏳ Lay low for now!\nTry again in *${formatCooldown(wait)}*.`);

        setCooldown(user, 'crime');

        const crime = CRIMES[Math.floor(Math.random() * CRIMES.length)];
        const caught = Math.random() < 0.40; // 40% chance caught

        if (caught) {
            const fine = Math.floor(Math.random() * (crime.fine[1] - crime.fine[0])) + crime.fine[0];
            const actual = Math.min(fine, user.wallet);
            user.wallet = Math.max(0, user.wallet - actual);
            user.stats.lost = (user.stats.lost || 0) + actual;
            user.nerve = Math.max(0,(user.nerve??100)-10);
        saveDB(db);
            return await m.reply(`🚨 *BUSTED!*\n─────────────\nYou tried to ${crime.action} but got caught!\nFine: -*${fmt(actual)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
        }

        const reward = Math.floor(Math.random() * (crime.reward[1] - crime.reward[0])) + crime.reward[0];
        user.wallet += reward;
        user.stats.earned = (user.stats.earned || 0) + reward;
        addXP(user, 40);
        saveDB(db);

        await m.reply(`🦹 *CRIME SUCCESSFUL!*\n─────────────\nYou ${crime.action} and got away!\n+*${fmt(reward)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
    }
};
