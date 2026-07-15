const fs   = require('fs-extra');
const path = require('path');
const DB   = path.join(process.cwd(), 'database/variables.json');

const readVars = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveVars = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

module.exports = {
    name:      'metalabel',
    alias:     ['metalabel', 'securemeta', 'setmetal'],
    category: 'owner',
    desc:      'Toggle the "secured service from Meta" label on all bot messages (text and media)',
    ownerOnly: true,

    execute: async (bot, m, args) => {
        const current = bot.config.METAL_LABEL !== undefined ? bot.config.METAL_LABEL : true;
        const arg = (args[0] || '').toLowerCase();

        const isOn = (v) => v === true || v === 'true' || v === 'on' || v === 1 || v === '1';

        if (!arg) {
            return await m.reply(
                `🔐 Meta Service Label: *${isOn(current) ? 'ON ✅' : 'OFF ✘'}*\n\n` +
                `Shows "This account uses a secured service from Meta to manage this chat" on all outgoing messages (text and media).\n\n` +
                `Usage: ${bot.prefix}metalabel on|off`
            );
        }

        if (!['on', 'off', 'true', 'false', '1', '0'].includes(arg)) {
            return await m.reply(`Usage: ${bot.prefix}metalabel on|off`);
        }

        const enabled = arg === 'on' || arg === 'true' || arg === '1';

        // Persist to database/variables.json (survives restarts)...
        const vars = readVars();
        vars.METAL_LABEL = enabled;
        saveVars(vars);

        // ...and apply live, no restart needed.
        bot.config.METAL_LABEL = enabled;

        return await m.reply(
            `🔐 Meta Service Label turned *${enabled ? 'ON ✅' : 'OFF ✘'}*.\nTakes effect immediately on all outgoing messages.`
        );
    }
};
