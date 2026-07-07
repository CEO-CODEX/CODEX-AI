const { getTarget } = require('../../lib/getTarget');
const { loadDB, saveDB, getUser, hasItem, removeItem, addItem, SHOP_ITEMS } = require('../../lib/economyEngine');

module.exports = {
    name: 'gift',
    category: 'economy',
    description: 'Gift an item to someone. Usage: .gift @user <item_id>',

    async execute(bot, m, args) {
        const db = loadDB();
        const user = getUser(db, m.sender);

        const targetJid = getTarget(m);
        const itemId    = (args[1] || args[0] || '').toLowerCase();
        const item      = SHOP_ITEMS[itemId];

        if (!targetJid) return await m.reply(`Usage: *.gift @user <item_id>*\nExample: .gift @john shield`);
        if (targetJid === m.sender) return await m.reply(`❌ You can't gift yourself!`);
        if (!item) return await m.reply(`❌ Unknown item. Use *.shop* to see available items.`);
        if (!hasItem(user, itemId)) return await m.reply(`❌ You don't have a *${item.name}* to gift.`);

        const target = getUser(db, targetJid);
        removeItem(user, itemId);
        addItem(target, itemId);
        saveDB(db);

        await m.reply(`🎁 *GIFT SENT!*\n─────────────\nYou gifted *${item.name}* to @${targetJid.split('@')[0]}!`);
    }
};
