const fs   = require('fs-extra');
const path = require('path');

const DB    = path.join(process.cwd(), 'database/variables.json');
const readV = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveV = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

module.exports = {
    name: 'alwaysonline',
    aliases: ['setonline', 'online', 'offline'],
    category: 'owner',
    description: 'Toggle always-online presence for the bot',
    ownerOnly: true,

    async execute(bot, m, args) {
        const sub = (args[0] || '').toLowerCase();

        // derive intent from alias used
        const via = (m.cmd || '').toLowerCase();
        const forceOn  = via === 'online';
        const forceOff = via === 'offline';

        const current = bot.config.alwaysOnline || false;
        const enable  = forceOn ? true : forceOff ? false
            : (sub === 'on' || sub === 'true' || sub === '1') ? true
            : (sub === 'off' || sub === 'false' || sub === '0') ? false
            : !current; // toggle if no arg

        const vars = readV();
        vars.alwaysOnline = enable;
        saveV(vars);
        bot.config.alwaysOnline = enable;

        if (enable) {
            await bot.sock.sendPresenceUpdate('available').catch(() => {});
        } else {
            await bot.sock.sendPresenceUpdate('unavailable').catch(() => {});
        }

        await m.reply(enable
            ? '🟢 *Always Online ENABLED* — bot now appears permanently online.'
            : '⚫ *Always Online DISABLED* — bot presence follows normal activity.');
    }
};
