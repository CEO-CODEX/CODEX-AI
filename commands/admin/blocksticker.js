/**
 * blocksticker — Ban a specific sticker (by content hash) from being sent
 * anywhere in this group, for everyone. Matches SUKUNA_MD's `mutesticker`
 * feature exactly, under a non-conflicting name since `mutesticker` in this
 * bot already means something different (muting a USER's ability to send
 * any sticker — see commands/admin/mutesticker.js).
 *
 * Reply to a sticker with .blocksticker to ban that exact sticker. It will
 * be auto-deleted on sight from then on — enforcement lives in
 * lib/antiSystems.js#checkAll().
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
    name: 'blocksticker',
    aliases: ['mutestickercontent', 'stickerban'],
    description: 'Ban a specific sticker (by content) from being sent in this group',
    category: 'admin',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const ctx = m.msg?.contextInfo;
        const quotedSticker = ctx?.quotedMessage?.stickerMessage;

        if (!quotedSticker) {
            return m.reply(
                `🚫 *Block Sticker*\n\n` +
                `Reply to a sticker with ${bot.prefix}blocksticker to ban it.\n\n` +
                `The sticker will be auto-deleted on sight from then on.`
            );
        }

        const hash = stickerHashOf(quotedSticker);
        if (!hash) return m.reply('❌ Could not identify that sticker.');

        const db = loadDB();
        const groupId = m.chat;
        if (!db[groupId]) db[groupId] = [];

        if (db[groupId].includes(hash)) {
            return m.reply('⚠️ This sticker is already blocked!');
        }

        db[groupId].push(hash);
        saveDB(db);

        return m.reply(
            `🚫 *Sticker Blocked!*\n\n` +
            `This sticker is now banned from this group.\n` +
            `It will be auto-deleted when sent.\n\n` +
            `Use ${bot.prefix}unblocksticker to unblock it.`
        );
    },
};
