const fs   = require('fs-extra');
const path = require('path');

const DB    = path.join(process.cwd(), 'database/groupEvents.json');
const readDB = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveDB = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

module.exports = {
    name: 'setgoodbye',
    aliases: ['goodbye', 'farewell'],
    category: 'bot',
    description: 'Set up the group goodbye message',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const jid  = m.chat;
        const a0   = (args[0] || '').toLowerCase();
        const db   = readDB();
        const cfg  = db[jid] || { welcomeEnabled: false, welcome: null, goodbyeEnabled: false, goodbye: null };
        const P    = bot.prefix;

        if (!a0 || a0 === 'status') {
            return m.reply(
`👋 *Goodbye Message Settings*

Status: \`${cfg.goodbyeEnabled ? '✅ ON' : '❌ OFF'}\`
Message: ${cfg.goodbye ? '_Custom set_' : '_Default_'}

*Commands:*
${P}setgoodbye on / off
${P}setgoodbye set <message>
${P}setgoodbye reset
${P}setgoodbye view

*Variables:*
\`{user}\` — @mention the leaving member
\`{group}\` — group name
\`{count}\` — remaining members`
            );
        }

        if (a0 === 'on' || a0 === 'off') {
            db[jid] = { ...cfg, goodbyeEnabled: a0 === 'on' };
            saveDB(db);
            return m.reply(a0 === 'on'
                ? '✅ Goodbye message *ENABLED* for this group.'
                : '❌ Goodbye message *DISABLED* for this group.');
        }

        if (a0 === 'set') {
            const text = args.slice(1).join(' ').trim();
            if (!text) return m.reply(`Usage: ${P}setgoodbye set <message>\n\nVariables: {user} {group} {count}`);
            db[jid] = { ...cfg, goodbye: text, goodbyeEnabled: true };
            saveDB(db);
            return m.reply(`✅ *Goodbye message set and enabled!*\n\nPreview:\n${text.replace(/{user}/gi, '@You').replace(/{group}/gi, 'Group Name').replace(/{count}/gi, '49')}`);
        }

        if (a0 === 'reset') {
            db[jid] = { ...cfg, goodbye: null };
            saveDB(db);
            return m.reply('🔄 Goodbye message reset to default.');
        }

        if (a0 === 'view') {
            if (!cfg.goodbye) return m.reply('No custom goodbye message set. Using default.');
            return m.reply(`*Current goodbye message:*\n\n${cfg.goodbye}`);
        }

        return m.reply(`Unknown option. Try ${P}setgoodbye status`);
    }
};
