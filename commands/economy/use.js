const { loadDB, saveDB, getUser, hasItem, SHOP_ITEMS, fmt, CURRENCY } = require('../../lib/economyEngine');

module.exports = {
    name: 'use',
    category: 'economy',
    description: 'Use an item from your inventory. Usage: .use <item_id>',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const itemId = (args[0] || '').toLowerCase();
        const item = SHOP_ITEMS[itemId];

        if (!itemId || !item) return await m.reply(`❌ Unknown item. Use *.inv* to see your items.`);
        if (!hasItem(user, itemId)) return await m.reply(`❌ You don't have a *${item.name}*. Buy it with *.buy ${itemId}*.`);

        // Item-specific use responses
        const useMessages = {
            shield:     `🛡️ *SHIELD EQUIPPED!*\nYour shield is now active. The next rob attempt on you will be automatically blocked.`,
            fishingrod: `🎣 *FISHING ROD EQUIPPED!*\nYour next 10 fishing trips will earn *+50%* more ${CURRENCY}!`,
            pickaxe:    `⛏️ *PICKAXE EQUIPPED!*\nYour next 10 mining trips will earn *+50%* more ${CURRENCY}!`,
            rifle:      `🔫 *RIFLE EQUIPPED!*\nYour next 10 hunting trips will earn *+50%* more ${CURRENCY}!`,
            lockpick:   `🔓 *LOCKPICK EQUIPPED!*\nYour next rob attempt has a *+20%* higher success rate!`,
            luckycharm: `🍀 *LUCKY CHARM EQUIPPED!*\nYour next 5 gambling actions have a *+10%* win rate boost!`,
        };

        saveDB(db);
        await m.reply(useMessages[itemId] || `✅ Used *${item.name}*.\n${item.desc}`);
    }
};
