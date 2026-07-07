const fs   = require('fs-extra');
const path = require('path');
const DB   = path.join(process.cwd(), 'database/variables.json');

const readVars = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveVars = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

module.exports = {
    name:      'aibadge',
    alias:     ['aiicon', 'setai'],
    category: 'owner',
    desc:      'Toggle the 🤖 AI badge on the bot\'s private-chat messages (crysnovax/baileys, DMs only)',
    ownerOnly: true,

    execute: async (bot, m, args) => {
        const current = bot.config.AI_BADGE !== undefined ? bot.config.AI_BADGE : true;
        const arg = (args[0] || '').toLowerCase();

        const isOn = (v) => v === true || v === 'true' || v === 'on' || v === 1 || v === '1';

        if (!arg) {
            return await m.reply(
                `🤖 AI Badge: *${isOn(current) ? 'ON ✅' : 'OFF ✘'}*\n\n` +
                `Only shows on private-chat (DM) messages — never in groups.\n\n` +
                `Usage: ${bot.prefix}aibadge on|off`
            );
        }

        if (!['on', 'off', 'true', 'false', '1', '0'].includes(arg)) {
            return await m.reply(`Usage: ${bot.prefix}aibadge on|off`);
        }

        const enabled = arg === 'on' || arg === 'true' || arg === '1';

        // Persist to database/variables.json (survives restarts)...
        const vars = readVars();
        vars.AI_BADGE = enabled;
        saveVars(vars);

        // ...and apply live, no restart needed.
        bot.config.AI_BADGE = enabled;

        return await m.reply(
            `🤖 AI Badge turned *${enabled ? 'ON ✅' : 'OFF ✘'}*.\nTakes effect immediately on private-chat messages.`
        );
    }
};
