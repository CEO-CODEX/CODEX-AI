const fs = require('fs-extra');

module.exports = {
    name: 'delvar',
    aliases: ['removevar', 'unsetvar'],
    category: 'bot',
    description: 'Delete a stored variable. Usage: .delvar KEY',

    async execute(bot, m, args) {
        const key = args[0]?.trim();
        if (!key) return await m.reply(`Usage: ${bot.prefix}delvar KEY\nSee all variables: ${bot.prefix}listvar`);

        const dbPath = './database/variables.json';
        let db = {};
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch {}

        if (!Object.prototype.hasOwnProperty.call(db, key)) {
            return await m.reply(`Variable "${key}" not found.`);
        }

        delete db[key];
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        await m.reply(`Variable "${key}" deleted.`);
    }
};
