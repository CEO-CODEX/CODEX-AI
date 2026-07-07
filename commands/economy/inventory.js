const { loadDB, getUser, SHOP_ITEMS, fmt, CURRENCY } = require('../../lib/economyEngine');

module.exports = {
    name: 'inventory',
    aliases: ['inv', 'items', 'bag'],
    category: 'economy',
    description: 'View your inventory',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const inv = user.inventory || {};
        // Filter out internal tracking keys (prefixed with _)
        const items = Object.entries(inv).filter(([k]) => !k.startsWith('_') && SHOP_ITEMS[k]);

        if (!items.length) {
            return await m.reply(`🎒 *YOUR INVENTORY*\n─────────────\nYour bag is empty!\nUse *.shop* to buy items.`);
        }

        const rows = items.map(([id, qty]) => {
            const item = SHOP_ITEMS[id];
            return `🔹 *${item.name}* x${qty}\n    ${item.desc}`;
        }).join('\n\n');

        await m.reply(`🎒 *YOUR INVENTORY*\n─────────────\n${rows}\n─────────────\nUse *.use <item>* to use an item.`);
    }
};
