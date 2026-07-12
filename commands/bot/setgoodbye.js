const fs   = require('fs-extra');
const path = require('path');

const DB     = path.join(process.cwd(), 'database/groupEvents.json');
const readDB = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveDB = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

// ONLY read/write goodbye fields — never touch welcome fields
function getGoodbyeCfg(db, jid) {
    const entry = db[jid] || {};
    return {
        goodbyeEnabled: entry.goodbyeEnabled,  // undefined = not set (uses global default)
        goodbye:        entry.goodbye || null,
    };
}

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
        const cfg  = getGoodbyeCfg(db, jid);
        const P    = bot.prefix;

        const save = (fields) => {
            // Merge ONLY — never replace the full entry (preserves welcome settings)
            db[jid] = Object.assign({}, db[jid] || {}, fields);
            saveDB(db);
        };

        if (!a0 || a0 === 'status') {
            return m.reply(
`👋 *Goodbye Message Settings*

Status: \`${cfg.goodbyeEnabled === true ? '✅ ON' : cfg.goodbyeEnabled === false ? '❌ OFF' : '⚙️ Global default'}\`
Message: ${cfg.goodbye ? '_Custom set_' : '_Default CODEX design_'}

*Commands:*
${P}setgoodbye on / off
${P}setgoodbye set <message>
${P}setgoodbye reset
${P}setgoodbye view

*Variables:*
\`@user\` — mentions the leaving member
\`{group}\` — group name
\`{count}\` — remaining members

✐ Usage: _${P}setgoodbye set Your goodbye text here_
_Use @user for member name_`
            );
        }

        if (a0 === 'on')  { save({ goodbyeEnabled: true  }); return m.reply('✅ Goodbye message *ENABLED* for this group.'); }
        if (a0 === 'off') { save({ goodbyeEnabled: false }); return m.reply('❌ Goodbye message *DISABLED* for this group.'); }

        if (a0 === 'set') {
            const text = args.slice(1).join(' ').trim();
            if (!text) return m.reply(`Usage: ${P}setgoodbye set <your message>\n\nVariables: @user {group} {count}`);
            save({ goodbye: text, goodbyeEnabled: true });
            return m.reply(`✅ *Goodbye message updated and enabled!*`);
        }

        if (a0 === 'reset') {
            save({ goodbye: null });
            return m.reply('🔄 Goodbye message reset to default CODEX design.');
        }

        if (a0 === 'view') {
            if (!cfg.goodbye) return m.reply('No custom goodbye set — using default CODEX design.');
            return m.reply(`*Current goodbye message:*\n\n${cfg.goodbye}`);
        }

        return m.reply(`Unknown option. Try ${P}setgoodbye status`);
    }
};
