const fs = require('fs-extra');

module.exports = {
    name: 'getnote',
    aliases: ['note', '#'],
    category: 'general',
    description: 'Retrieve a saved note by name',

    async execute(bot, m, args) {
        if (!args[0]) return await m.reply(`Usage: ${bot.prefix}getnote <name>\nSee all notes: ${bot.prefix}listnote`);
        const noteName = args[0].toLowerCase();
        const chatId   = m.chat;
        const dbPath   = './database/notes.json';
        let db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const note = db[chatId]?.[noteName];
        if (!note) return await m.reply(`Note ${noteName} not found.\nSee all notes: ${bot.prefix}listnote`);
        await m.reply(`${noteName.toUpperCase()}\n\n${note.text}`);
    }
};
