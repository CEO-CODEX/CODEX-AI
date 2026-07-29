/**
 * unblocksticker — Unban a sticker previously blocked with .blocksticker.
 * Reply to the blocked sticker with .unblocksticker to lift the ban.
 */
const fs = require('fs-extra');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../database/blockedstickers.json');

function loadDB() {
    try {
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {}
    return {};
}

function saveDB(db) {
    fs.ensureDirSync(path.dirname(DB_PATH));
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function stickerHashOf(stickerMsg) {
    const id = stickerMsg?.fileSha256 || stickerMsg?.fileEncSha256;
    if (!id) return null;
    return Buffer.from(id).toString('base64');
}

module.exports = {
    name: 'unblocksticker',
    aliases: ['unmutestickercontent', 'stickerunban'],
    description: 'Unban a previously blocked sticker',
    category: 'admin',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const ctx = m.msg?.contextInfo;
        const quotedSticker = ctx?.quotedMessage?.stickerMessage;

        if (!quotedSticker) {
            return m.reply(
                `✅ *Unblock Sticker*\n\n` +
                `Reply to a blocked sticker with ${bot.prefix}unblocksticker to unban it.`
            );
        }

        const hash = stickerHashOf(quotedSticker);
        if (!hash) return m.reply('❌ Could not identify that sticker.');

        const db = loadDB();
        const groupId = m.chat;
        const list = db[groupId] || [];

        if (!list.includes(hash)) {
            return m.reply('❌ This sticker is not blocked!');
        }

        db[groupId] = list.filter(h => h !== hash);
        saveDB(db);

        return m.reply('✅ *Sticker Unblocked*\n\nIt can now be sent normally.');
    },
};
