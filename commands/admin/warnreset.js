const fs = require('fs-extra');
const { getTarget } = require('../../lib/getTarget');

const WARN_PATH = './database/warnings.json';

function loadDB() {
    try { return JSON.parse(fs.readFileSync(WARN_PATH, 'utf8')); } catch { return {}; }
}
function saveDB(db) {
    fs.ensureDirSync('./database');
    fs.writeFileSync(WARN_PATH, JSON.stringify(db, null, 2));
}

module.exports = {
    name: 'warnreset',
    aliases: ['clearwarn', 'resetwarn', 'unwarn'],
    category: 'admin',
    description: 'Clear all warnings for a user. Tag or reply to their message.',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m);
        if (!target) return await m.reply(`Tag a user or reply to their message.\nExample: ${bot.prefix}warnreset @user`);

        const db  = loadDB();
        const key = `${m.chat}_${target}`;

        const rec = db[key];
        const hasWarns = rec && (
            (typeof rec === 'number' && rec > 0) ||
            (typeof rec === 'object' && rec.count > 0)
        );

        if (!hasWarns) {
            return await bot.sendMessage(m.chat, {
                text: `ℹ️ @${target.split('@')[0]} has no warnings to clear.`,
                mentions: [target]
            });
        }

        const prevCount = typeof rec === 'number' ? rec : (rec.count || 0);

        // Fully delete the key — so .warns shows clean slate
        delete db[key];
        saveDB(db);

        await bot.sendMessage(m.chat, {
            text: `✅ *Warning history cleared.*\n👤 User: @${target.split('@')[0]}\n🗑 Removed: ${prevCount} warning(s)\n\nThis user now has a clean record.`,
            mentions: [target]
        });
    }
};
