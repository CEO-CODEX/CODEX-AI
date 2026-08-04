const fs   = require('fs-extra');
const path = require('path');
const { parseTime, humanize, schedule, cancel } = require('../../lib/mute-core');

// Same path/shape that lib/antiSystems.js's "Block-Sticker" enforcement
// already reads: { [groupId]: [base64Hash, base64Hash, ...] }
const DB_PATH = path.join(process.cwd(), 'database/blockedstickers.json');
const readDB  = () => { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; } };
const saveDB  = (d) => { fs.ensureDirSync(path.dirname(DB_PATH)); fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2)); };

module.exports = {
    name: 'mutesticker',
    aliases: ['stickerban', 'bansticker'],
    category: 'admin',
    description: 'Ban a specific sticker (not a user) — reply to it with .blocksticker [1h] [after 2h]. ' +
                 'It gets auto-deleted every time anyone sends it again.\n' +
                 '.blocksticker list — .blocksticker clear',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const sub = (args[0] || '').toLowerCase();
        const db  = readDB();
        if (!db[m.chat]) db[m.chat] = [];

        if (sub === 'list') {
            if (!db[m.chat].length) return m.reply('No stickers are blocked in this group.');
            return m.reply(`🚫 ${db[m.chat].length} sticker(s) currently blocked in this group.`);
        }

        if (sub === 'clear') {
            // Also drop any pending timed block/unblock jobs for this group —
            // otherwise a scheduled job could still fire later and re-add a
            // hash right after you just cleared the whole list.
            cancel({ type: 'blockSticker', chat: m.chat });
            cancel({ type: 'unblockSticker', chat: m.chat });
            db[m.chat] = [];
            saveDB(db);
            return m.reply('🧹 Cleared every blocked sticker for this group.');
        }

        const ctx = m.contextInfo || m.msg?.contextInfo || {};
        const quotedSticker = ctx.quotedMessage?.stickerMessage;
        if (!quotedSticker) {
            return m.reply(
                '🚫 *Block Sticker*\n\n' +
                `Reply to a sticker with ${bot.prefix}blocksticker [1h] [after 2h] to ban it.\n` +
                'It will be auto-deleted every time anyone sends it again.'
            );
        }

        const id = quotedSticker.fileSha256 || quotedSticker.fileEncSha256;
        if (!id) return m.reply("❌ Couldn't read that sticker's hash. Please try replying to it again.");
        const hash = Buffer.from(id).toString('base64');

        const joined      = args.join(' ');
        const isAfterMode  = /\bafter\b/i.test(joined);
        const timeStr      = joined.replace(/\bafter\b/i, '').trim();
        const ms           = timeStr ? parseTime(timeStr) : null;

        if (timeStr && !ms) return m.reply('⚠️ Bad duration. Use: 10m 1h 6h 1d 7d etc.');

        // Delayed block: don't ban it now — schedule the ban for later.
        // Uses the same timers engine (mute-core.js) as muteuser/tkick.
        if (isAfterMode && ms) {
            cancel({ type: 'blockSticker', chat: m.chat, target: hash });
            schedule({ type: 'blockSticker', chat: m.chat, target: hash, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return m.reply(`⏳ This sticker will be blocked in ${humanize(ms)}.`);
        }

        if (db[m.chat].includes(hash)) {
            return m.reply('⚠️ This sticker is already blocked!');
        }

        db[m.chat].push(hash);
        saveDB(db);

        // Timed block: ban it now, auto-unblock when the timer ends.
        if (ms) {
            cancel({ type: 'unblockSticker', chat: m.chat, target: hash });
            schedule({ type: 'unblockSticker', chat: m.chat, target: hash, expiresAt: Date.now() + ms, mutedBy: m.sender });
            return bot.sendMessage(m.chat, { text: `🚫 Sticker blocked for ${humanize(ms)} — auto-unblocks when the timer ends.` });
        }

        return m.reply(
            '🚫 *Sticker Blocked!*\n\n' +
            'This sticker is now banned from this group.\n' +
            'It will be auto-deleted when anyone sends it.\n\n' +
            `Use ${bot.prefix}unblocksticker (as a reply to it) to unblock.`
        );
    }
};
