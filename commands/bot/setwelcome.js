const fs   = require('fs-extra');
const path = require('path');

const DB     = path.join(process.cwd(), 'database/groupEvents.json');
const readDB = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveDB = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

// ONLY read/write welcome fields — never touch goodbye fields
function getWelcomeCfg(db, jid) {
    const entry = db[jid] || {};
    return {
        welcomeEnabled: entry.welcomeEnabled,   // undefined = not set (uses global default)
        welcome:        entry.welcome || null,
    };
}

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
        const cfg  = getWelcomeCfg(db, jid);
        const P    = bot.prefix;

        const save = (fields) => {
            // Merge ONLY — never replace the full entry (preserves goodbye settings)
            db[jid] = Object.assign({}, db[jid] || {}, fields);
            saveDB(db);
        };

        if (!a0 || a0 === 'status') {
            return m.reply(
`👋 *Welcome Message Settings*

Status: \`${cfg.welcomeEnabled === true ? '✅ ON' : cfg.welcomeEnabled === false ? '❌ OFF' : '⚙️ Global default'}\`
Message: ${cfg.welcome ? '_Custom set_' : '_Default CODEX design_'}

*Commands:*
${P}setwelcome on / off
${P}setwelcome set <message>
${P}setwelcome reset
${P}setwelcome view

*Variables:*
\`@user\` — mentions the new member
\`{group}\` — group name
\`{count}\` — total members

✐ Usage: _${P}setwelcome set Your welcome text here_
_Use @user for member name_`
            );
        }

        if (a0 === 'on')  { save({ welcomeEnabled: true  }); return m.reply('✅ Welcome message *ENABLED* for this group.'); }
        if (a0 === 'off') { save({ welcomeEnabled: false }); return m.reply('❌ Welcome message *DISABLED* for this group.'); }

        if (a0 === 'set') {
            const text = args.slice(1).join(' ').trim();
            if (!text) return m.reply(`Usage: ${P}setwelcome set <your message>\n\nVariables: @user {group} {count}`);
            save({ welcome: text, welcomeEnabled: true });
            return m.reply(`✅ *Welcome message updated and enabled!*`);
        }

        if (a0 === 'reset') {
            save({ welcome: null });
            return m.reply('🔄 Welcome message reset to default CODEX design.');
        }

        if (a0 === 'view') {
            if (!cfg.welcome) return m.reply('No custom welcome set — using default CODEX design.');
            return m.reply(`*Current welcome message:*\n\n${cfg.welcome}`);
        }

        return m.reply(`Unknown option. Try ${P}setwelcome status`);
    }
};

