const fs = require('fs-extra');

module.exports = {
    name: 'delcmd',
    aliases: [],
    category: 'bot',
    description: 'Reply a sticker with .delcmd to remove its linked command',

    async execute(bot, m, args) {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage || m.msg?.contextInfo?.quotedMessage;
        if (!quoted?.stickerMessage) return await m.reply(`Reply to a sticker to unlink it.\nUsage: reply a sticker then type ${bot.prefix}delcmd`);

        const sha256 = quoted.stickerMessage.fileSha256;
        if (!sha256) return await m.reply('Could not read sticker ID.');
        const stickerId = Buffer.from(sha256).toString('base64');

        const dbPath = './database/stickercmds.json';
        let db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!db[stickerId]) return await m.reply('This sticker has no command linked to it.');

        const removed = db[stickerId].command;
        delete db[stickerId];
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        await m.reply(`Sticker unlinked from ${bot.prefix}${removed}.`);
    }
};
