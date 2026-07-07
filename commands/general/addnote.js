const fs = require('fs-extra');

module.exports = {
    name: 'addnote',
    aliases: ['savenote', 'setnote'],
    category: 'general',
    description: 'Save a note with a keyword',

    async execute(bot, m, args) {
        if (args.length < 2) return await m.reply(`Usage: ${bot.prefix}addnote <name> <text>\nExample: ${bot.prefix}addnote rules No spam!\nGet it: ${bot.prefix}getnote rules`);
        const noteName = args[0].toLowerCase();
        const noteText = args.slice(1).join(' ');
        const chatId   = m.chat;
        const dbPath   = './database/notes.json';
        let db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!db[chatId]) db[chatId] = {};
        db[chatId][noteName] = { text: noteText, savedBy: m.sender, savedAt: Date.now() };
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        await m.reply(`Note saved: ${noteName}\nGet it anytime with: ${bot.prefix}getnote ${noteName}`);
    }
};
