const { loadDB, saveDB, getUser, removeItem, hasItem, SHOP_ITEMS, fmt, CURRENCY } = require('../../lib/economyEngine');

module.exports = {
    name: 'sell',
    category: 'economy',
    description: 'Sell an item back for 50% of its price. Usage: .sell <item_id>',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const itemId = (args[0] || '').toLowerCase();
        const item = SHOP_ITEMS[itemId];

        if (!itemId || !item) return await m.reply(`❌ Unknown item. Use *.shop* to see available items.`);
        if (!hasItem(user, itemId)) return await m.reply(`❌ You don't have a *${item.name}* in your inventory.`);

        const refund = Math.floor(item.price * 0.5);
        removeItem(user, itemId);
        user.wallet += refund;
        user.stats.earned = (user.stats.earned || 0) + refund;
        saveDB(db);

        await m.reply(`💸 *ITEM SOLD!*\n─────────────\nSold: *${item.name}*\nRefund: +*${fmt(refund)}* ${CURRENCY} (50% back)\n💼 Balance: *${fmt(user.wallet)}* ${CURRENCY}`);
    }
};
