const fs = require('fs-extra');
const { getTarget } = require('../../lib/getTarget');

const WARN_PATH = './database/warnings.json';

function loadDB() {
    try { return JSON.parse(fs.readFileSync(WARN_PATH, 'utf8')); } catch { return {}; }
}

const MAX_WARNS = 5;

module.exports = {
    name: 'warns',
    aliases: ['checkwarn', 'warnlist'],
    category: 'admin',
    description: 'Check warnings for a user. Tag or reply to their message.',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const target = getTarget(m) || m.sender.replace(/:[0-9]+@/, '@');

        const db  = loadDB();
        const key = `${m.chat}_${target}`;
        const rec = db[key];

        if (!rec || rec.count === 0) {
            return await bot.sendMessage(m.chat, {
                text: `✅ @${target.split('@')[0]} has no warnings.`,
                mentions: [target]
            });
        }

        const count   = rec.count || 0;
        const history = rec.history || [];

        let historyText = '';
        history.forEach((h, i) => {
            historyText += `\n${i + 1}. 📝 ${h.reason}\n   🛡 By: ${h.issuerName || h.issuer?.split('@')[0] || 'Unknown'}\n   🕐 ${h.time}`;
        });

        await bot.sendMessage(m.chat, {
            text:
`⚠️ *WARN RECORD*
👤 User: @${target.split('@')[0]}
📊 Warnings: ${count}/${MAX_WARNS}
${historyText}`,
            mentions: [target]
        });
    }
};
