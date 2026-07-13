const { getTarget, resolveTargets } = require('../../lib/getTarget');
const fs = require('fs-extra');

const DB_PATH = './database/sudo.json';

// Read sudo DB and normalise to { users: [...] }, migrating the legacy
// { 'jid': true } object format on the fly.
function readSudo() {
    let raw = {};
    try { raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch {}
    if (Array.isArray(raw.users)) return { users: raw.users.filter(Boolean) };
    const users = Object.keys(raw).filter(k => k !== 'users' && raw[k]);
    return { users };
}

function writeSudo(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: db.users }, null, 2));
}

module.exports = {
    name: 'sudo',
    category: 'bot',
    ownerOnly: true,
    description: 'Add or remove sudo users (sudo can use all commands EXCEPT owner-only ones)',

    async execute(bot, m, args) {
        const action = args[0]?.toLowerCase();

        if (!action || !['add', 'remove', 'list'].includes(action)) return await m.reply(
`sudo manager
Sudo users can use every command EXCEPT owner-only ones.

Usage:
${bot.prefix}sudo add @user
${bot.prefix}sudo remove @user
${bot.prefix}sudo list`);

        const db = readSudo();

        if (action === 'list') {
            if (db.users.length === 0) return await m.reply('No sudo users set.');
            let text = 'Sudo users:\n';
            db.users.forEach((id, i) => { text += `${i + 1}. @${id.split('@')[0]}\n`; });
            return await m.reply(text.trim(), { mentions: db.users });
        }

        // Resolve every JID form (phone + lid) so permission checks always match
        const forms = await resolveTargets(bot, m);
        const primary = getTarget(m);
        if (!forms.length) return await m.reply('Tag a user or reply to their message.');

        if (action === 'add') {
            let added = false;
            for (const jid of forms) {
                if (!db.users.includes(jid)) { db.users.push(jid); added = true; }
            }
            writeSudo(db);
            return await m.reply(
                added
                    ? `@${primary.split('@')[0]} can now use sudo commands.`
                    : `@${primary.split('@')[0]} is already a sudo user.`,
                { mentions: [primary] }
            );
        }

        if (action === 'remove') {
            const tails = forms.map(j => j.split('@')[0].replace(/[^0-9]/g, '').slice(-10));
            db.users = db.users.filter(id => {
                const t = id.split('@')[0].replace(/[^0-9]/g, '').slice(-10);
                return !tails.includes(t) && !forms.includes(id);
            });
            writeSudo(db);
            return await m.reply(`@${primary.split('@')[0]} removed from sudo.`, { mentions: [primary] });
        }
    }
};
