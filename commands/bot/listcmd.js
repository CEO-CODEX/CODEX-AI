const fs = require('fs-extra');

module.exports = {
    name: 'listcmd',
    aliases: ['stickerlist'],
    category: 'bot',
    description: 'List all sticker-linked commands',

    async execute(bot, m, args) {
        const dbPath = './database/stickercmds.json';
        let db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        const entries = Object.entries(db);
        if (entries.length === 0) return await m.reply(`No sticker commands set yet.\nAdd one: reply a sticker then type ${bot.prefix}setcmd <command>`);
        let text = 'Sticker commands:\n';
        entries.forEach(([id, data], i) => { text += `${i+1}. ${bot.prefix}${data.command}\n`; });
        text += `\nTotal: ${entries.length}\nRemove: reply sticker then type ${bot.prefix}delcmd`;
        await m.reply(text);
    }
};
