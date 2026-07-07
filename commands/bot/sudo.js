const { getTarget } = require('../../lib/getTarget');
const fs = require('fs-extra');

module.exports = {
    name: 'sudo',
    category: 'bot',
    description: 'Add or remove sudo users',

    async execute(bot, m, args) {
        const action = args[0]?.toLowerCase();

        if (!action || !['add', 'remove', 'list'].includes(action)) return await m.reply(
`sudo manager
Usage:
${bot.prefix}sudo add @user
${bot.prefix}sudo remove @user
${bot.prefix}sudo list`);

        const dbPath = './database/sudo.json';
        let db = {};
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch {}

        if (action === 'list') {
            const sudoers = Object.keys(db);
            if (sudoers.length === 0) return await m.reply('No sudo users set.');
            let text = 'Sudo users:\n';
            sudoers.forEach((id, i) => { text += `${i+1}. @${id.split('@')[0]}\n`; });
            return await m.reply(text.trim(), { mentions: sudoers });
        }

        const target = getTarget(m);
        if (!target) return await m.reply('Tag a user or reply to their message.');

        if (action === 'add') {
            db[target] = true;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            await m.reply(`@${target.split('@')[0]} can now use sudo commands.`, { mentions: [target] });
        }
        if (action === 'remove') {
            delete db[target];
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            await m.reply(`@${target.split('@')[0]} removed from sudo.`, { mentions: [target] });
        }
    }
};
