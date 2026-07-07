const { loadDB, saveDB, getUser } = require('../../lib/economyEngine');
const COOLDOWN = 4 * 60 * 60 * 1000; // 4 hours

module.exports = {
    name: 'petfeed',
    aliases: ['feedpet', 'carepet'],
    category: 'economy',
    description: 'Feed and care for your pet',

    async execute(bot, m) {
        const db   = loadDB();
        const user = getUser(db, m.sender);
        if (!user.pet) return await m.reply(`❌ You have no pet!\nBuy one with *${bot.prefix}petstore buy <type>*`);

        const p    = user.pet;
        const now  = Date.now();
        const last = p.lastFed || 0;
        const wait = COOLDOWN - (now - last);

        if (wait > 0 && last > 0) {
            const h = Math.floor(wait/3600000), mn = Math.floor((wait%3600000)/60000);
            return await m.reply(`⏳ *${p.name}* is not hungry yet!\nFeed again in *${h}h ${mn}m*`);
        }

        p.health    = Math.min(100, (p.health    || 0) + 20);
        p.happiness = Math.min(100, (p.happiness || 0) + 15);
        p.score     = Math.min(100, (p.score     || 0) + 5);
        p.cares     = (p.cares || 0) + 1;
        p.lastFed   = now;
        saveDB(db);

        return await m.reply(
`${p.emoji} You fed *${p.name}*!

❤️ Health: *${p.health}%*
😊 Happiness: *${p.happiness}%*
⭐ Score: *${p.score}/100*
🏅 Total cares: *${p.cares}*`);
    }
};
