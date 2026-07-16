const fs   = require('fs-extra');
const path = require('path');
const DB   = path.join(process.cwd(), 'database/variables.json');

const readVars = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveVars = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

module.exports = {
    name:      'metasecure',
    alias:     ['setsecure', 'secureservice', 'metaservice'],
    category: 'owner',
    desc:      'Toggle the "secure service from Meta" label on all bot messages (always ON by default, like aibadge)',
    ownerOnly: true,

    execute: async (bot, m, args) => {
        const current = bot.config.SECURE_META_SERVICE !== undefined ? bot.config.SECURE_META_SERVICE : true;
        const arg = (args[0] || '').toLowerCase();

        const isOn = (v) => v === true || v === 'true' || v === 'on' || v === 1 || v === '1';

        if (!arg) {
            return await m.reply(
                `🔒 Meta Secure Service Label: *${isOn(current) ? 'ON ✅' : 'OFF ✘'}*\n\n` +
                `Tags all outgoing messages (text and media) with the label\n` +
                `"This business uses a secure service from Meta to manage this message".\n\n` +
                `NOTE: This is NOT an official WhatsApp Business/Cloud-API feature.\n` +
                `Unofficial (Baileys) clients may have it ignored by WhatsApp.\n\n` +
                `Usage: ${bot.prefix}metasecure on|off`
            );
        }

        if (!['on', 'off', 'true', 'false', '1', '0'].includes(arg)) {
            return await m.reply(`Usage: ${bot.prefix}metasecure on|off`);
        }

        const enabled = arg === 'on' || arg === 'true' || arg === '1';

        // Persist to database/variables.json (survives restarts)
        const vars = readVars();
        vars.SECURE_META_SERVICE = enabled;
        saveVars(vars);

        // Apply live, no restart needed
        bot.config.SECURE_META_SERVICE = enabled;

        return await m.reply(
            `🔒 Meta Secure Service Label turned *${enabled ? 'ON ✅' : 'OFF ✘'}*.\n` +
            `Takes effect immediately on all outgoing messages (text & media).`
        );
    }
};
