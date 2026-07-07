const { loadDB, saveDB, getUser, addItem, SHOP_ITEMS, fmt, CURRENCY } = require('../../lib/economyEngine');

module.exports = {
    name: 'buy',
    category: 'economy',
    description: 'Buy an item from the shop. Usage: .buy <item_id>',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const itemId = (args[0] || '').toLowerCase();
        const item = SHOP_ITEMS[itemId];

        if (!itemId || !item) {
            const ids = Object.keys(SHOP_ITEMS).join(', ');
            return await m.reply(`❌ Unknown item.\nAvailable items: *${ids}*\nUse *.shop* to see details.`);
        }

        if (user.wallet < item.price) {
            return await m.reply(`❌ Not enough coins!\nYou need *${fmt(item.price)}* ${CURRENCY} but only have *${fmt(user.wallet)}* ${CURRENCY}.`);
        }

        user.wallet -= item.price;
        user.stats.spent = (user.stats.spent || 0) + item.price;
        addItem(user, itemId);
        saveDB(db);

        await m.reply(`✅ *PURCHASE SUCCESSFUL!*\n─────────────\nBought: *${item.name}*\nCost: -*${fmt(item.price)}* ${CURRENCY}\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}\n\n${item.desc}`);
    }
};
