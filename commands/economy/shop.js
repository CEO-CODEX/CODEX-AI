const { SHOP_ITEMS, CURRENCY, fmt } = require('../../lib/economyEngine');

module.exports = {
    name: 'shop',
    aliases: ['store'],
    category: 'economy',
    description: 'View the item shop',

    async execute(bot, m, args) {
        const rows = Object.entries(SHOP_ITEMS).map(([id, item]) =>
            `🔹 *${item.name}* — *${fmt(item.price)}* ${CURRENCY}\n    ID: \`${id}\`\n    ${item.desc}`
        ).join('\n\n');

        await m.reply(
`🏪 *CODEX ITEM SHOP*

${rows}

Buy with: *.buy <item_id>*
Example: *.buy shield*`);
    }
};
