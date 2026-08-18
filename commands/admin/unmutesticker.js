const fs   = require('fs-extra');
const path = require('path');
const { parseTime, humanize, schedule, cancel } = require('../../lib/mute-core');

const DB_PATH = path.join(process.cwd(), 'database/blockedstickers.json');
const readDB  = () => { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; } };
const saveDB  = (d) => { fs.ensureDirSync(path.dirname(DB_PATH)); fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2)); };

module.exports = {
    name: 'unmutesticker',
    aliases: ['unstickerban', 'unbansticker'],
    category: 'admin',
    reactions: { start: '👀', success: '📝' },
    description: 'Unban a previously blocked sticker — reply to it with .unblocksticker [1h] [after 2h].',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const ctx = m.contextInfo || m.msg?.contextInfo || {};
        const quotedSticker = ctx.quotedMessage?.stickerMessage;
        if (!quotedSticker) {
            return m.reply(`Reply to a previously-blocked sticker with ${bot.prefix}unblocksticker [1h] [after 2h] to unban it.`);
        }

        const id = quotedSticker.fileSha256 || quotedSticker.fileEncSha256;
        if (!id) return m.reply("❌ Couldn't read that sticker's hash. Please try replying to it again.");
        const hash = Buffer.from(id).toString('base64');

        const joined     = args.join(' ');
        const isAfterMode = /\bafter\b/i.test(joined);
        const timeStr     = joined.replace(/\bafter\b/i, '').trim();
        const ms          = timeStr ? parseTime(timeStr) : null;

        if (timeStr && !ms) return m.reply('⚠️ Bad duration. Use: 10m 1h 6h 1d 7d etc.');

        // Delayed unblock: keep it banned now, schedule the unban for later.
        if (isAfterMode && ms) {
            cancel({ type: 'unblockSticker', chat: m.chat, target: hash });
            schedule({ type: 'unblockSticker', chat: m.chat, target: hash, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return m.reply(`⏳ This sticker will be unblocked in ${humanize(ms)}.`);
        }

        const db   = readDB();
        const list = db[m.chat] || [];
        const before = list.length;
        db[m.chat] = list.filter(h => h !== hash);
        saveDB(db);

        if (db[m.chat].length === before) return m.reply("That sticker isn't on the blocked list.");

        // Unblocking now — clear any pending scheduled block/unblock for
        // this exact sticker so a stale timer can't undo this unexpectedly.
        cancel({ type: 'unblockSticker', chat: m.chat, target: hash });
        cancel({ type: 'blockSticker', chat: m.chat, target: hash });

        // Timed unblock: unban it now, auto re-block ("blockSticker" job)
        // when the timer ends — mirrors how .blocksticker 1h / .muteuser 1h
        // work in the opposite direction.
        if (ms) {
            schedule({ type: 'blockSticker', chat: m.chat, target: hash, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return bot.sendMessage(m.chat, { text: `✅ Sticker unbanned for ${humanize(ms)} — it will be auto re-blocked when the timer ends.` });
        }

        return m.reply('✅ Sticker unbanned — it can be sent again.');
    }
};
