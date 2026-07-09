const fs   = require('fs-extra');
const path = require('path');

const DB    = path.join(process.cwd(), 'database/groupEvents.json');
const readDB = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveDB = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

module.exports = {
    name: 'setwelcome',
    aliases: ['welcome'],
    category: 'bot',
    description: 'Set up the group welcome message',
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
`👋 *Welcome Message Settings*

Status: \`${cfg.welcomeEnabled ? '✅ ON' : '❌ OFF'}\`
Message: ${cfg.welcome ? '_Custom set_' : '_Default_'}

*Commands:*
${P}setwelcome on / off
${P}setwelcome set <message>  — set a custom message
${P}setwelcome reset          — go back to default message
${P}setwelcome view           — see your current custom message

*Variables you can use:*
\`{user}\` — @mention the new member
\`{group}\` — group name
\`{count}\` — total members`
            );
        }

        if (a0 === 'on' || a0 === 'off') {
            db[jid] = { ...cfg, welcomeEnabled: a0 === 'on' };
            saveDB(db);
            return m.reply(a0 === 'on'
                ? '✅ Welcome message *ENABLED* for this group.'
                : '❌ Welcome message *DISABLED* for this group.');
        }

        if (a0 === 'set') {
            const text = args.slice(1).join(' ').trim();
            if (!text) return m.reply(`Usage: ${P}setwelcome set <message>\n\nVariables: {user} {group} {count}`);
            db[jid] = { ...cfg, welcome: text, welcomeEnabled: true };
            saveDB(db);
            return m.reply(`✅ *Welcome message set and enabled!*\n\nPreview:\n${text.replace(/{user}/gi, '@You').replace(/{group}/gi, 'Group Name').replace(/{count}/gi, '50')}`);
        }

        if (a0 === 'reset') {
            db[jid] = { ...cfg, welcome: null };
            saveDB(db);
            return m.reply('🔄 Welcome message reset to default.');
        }

        if (a0 === 'view') {
            if (!cfg.welcome) return m.reply('No custom welcome message set. Using default.');
            return m.reply(`*Current welcome message:*\n\n${cfg.welcome}`);
        }

        return m.reply(`Unknown option. Try ${P}setwelcome status`);
    }
};
