const { loadDB, saveDB, getUser, fmt } = require('../../lib/economyEngine');

const SELL_PRICE = { dog:800, cat:600, wolf:2000, dragon:8000, fox:1400, lion:3200, eagle:1800, bear:2400 };

module.exports = {
    name: 'petsell',
    aliases: ['sellpet'],
    category: 'economy',
    description: 'Sell your pet back for coins',

    async execute(bot, m) {
        const db   = loadDB();
        const user = getUser(db, m.sender);
        if (!user.pet) return await m.reply('❌ You have no pet to sell.');

        const p     = user.pet;
        const price = SELL_PRICE[p.type] || 500;
        user.wallet = (user.wallet || 0) + price;
        user.pet    = null;
        saveDB(db);
        return await m.reply(`✅ You sold *${p.emoji} ${p.name}* for 🪙*${fmt(price)}*\n\nBuy a new pet with *${bot.prefix}petstore*`);
    }
};
