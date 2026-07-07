const fs = require('fs-extra');

module.exports = {
    name: 'delnote',
    aliases: ['deletenote', 'removenote'],
    category: 'general',
    description: 'Delete a saved note',
    adminOnly: true,

    async execute(bot, m, args) {
        if (!args[0]) return await m.reply(`Usage: ${bot.prefix}delnote <name>\nExample: ${bot.prefix}delnote rules`);
        const noteName = args[0].toLowerCase();
        const chatId   = m.chat;
        const dbPath   = './database/notes.json';
        let db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!db[chatId]?.[noteName]) return await m.reply(`Note ${noteName} not found.`);
        delete db[chatId][noteName];
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        await m.reply(`Note ${noteName} deleted.`);
    }
};
