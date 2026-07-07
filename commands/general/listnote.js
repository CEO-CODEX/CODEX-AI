const fs = require('fs-extra');

module.exports = {
    name: 'listnote',
    aliases: ['notes', 'allnotes'],
    category: 'general',
    description: 'List all saved notes in this chat',

    async execute(bot, m, args) {
        const chatId = m.chat;
        const dbPath = './database/notes.json';
        let db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const chatNotes = db[chatId];
        if (!chatNotes || Object.keys(chatNotes).length === 0) return await m.reply(`No notes saved here yet.\nAdd one: ${bot.prefix}addnote <name> <text>`);
        const entries = Object.entries(chatNotes);
        let text = `Notes (${entries.length}):\n`;
        entries.forEach(([name, data], i) => {
            const preview = data.text.length > 40 ? data.text.slice(0, 40) + '...' : data.text;
            text += `${i+1}. ${name} - ${preview}\n`;
        });
        text += `\nGet a note: ${bot.prefix}getnote <name>\nAdd a note: ${bot.prefix}addnote <name> <text>`;
        await m.reply(text);
    }
};
