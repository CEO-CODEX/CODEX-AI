const fs   = require('fs-extra');
const DB   = './database/variables.json';
const read = () => { try { return JSON.parse(fs.readFileSync(DB,'utf8')); } catch { return {}; } };
const save = (d) => { fs.ensureDirSync('./database'); fs.writeFileSync(DB, JSON.stringify(d,null,2)); };

module.exports = {
    name: 'autorecording',
    aliases: ['cmdrecording','commandrecording','autorec','recording'],
    category: 'owner',
    ownerOnly: true,
    description: 'Toggle auto recording indicator when bot processes commands',

    async execute(bot, m, args) {
        const sub = args[0]?.toLowerCase();
        const db  = read();
        const cur = db.AUTO_RECORDING === true || db.AUTO_RECORDING === 'true';

        if (!sub) return await m.reply(
`╭─❍ *AUTO RECORDING*
│
│ Status : *${cur ? 'ON ✓' : 'OFF ✗'}*
│
│ ${bot.prefix}autorecording on
│ ${bot.prefix}autorecording off
╰──────────────────`);

        if (sub === 'on') {
            db.AUTO_RECORDING = true;
            save(db);
            return await m.reply('`✓ Auto Recording ENABLED — bot will show recording... before commands`');
        }
        if (sub === 'off') {
            db.AUTO_RECORDING = false;
            save(db);
            return await m.reply('`✘ Auto Recording DISABLED`');
        }
        return await m.reply(`Usage: ${bot.prefix}autorecording on/off`);
    }
};
