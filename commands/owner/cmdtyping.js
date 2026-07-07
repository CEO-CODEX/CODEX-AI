const fs   = require('fs-extra');
const DB   = './database/variables.json';
const read = () => { try { return JSON.parse(fs.readFileSync(DB,'utf8')); } catch { return {}; } };
const save = (d) => { fs.ensureDirSync('./database'); fs.writeFileSync(DB, JSON.stringify(d,null,2)); };

module.exports = {
    name: 'autotyping',
    aliases: ['cmdtyping','commandtyping','autotyping','typing'],
    category: 'owner',
    ownerOnly: true,
    description: 'Toggle auto typing indicator when bot processes commands',

    async execute(bot, m, args) {
        const sub = args[0]?.toLowerCase();
        const db  = read();
        const cur = db.AUTO_TYPING === true || db.AUTO_TYPING === 'true';

        if (!sub) return await m.reply(
`╭─❍ *AUTO TYPING*
│
│ Status : *${cur ? 'ON ✓' : 'OFF ✗'}*
│
│ ${bot.prefix}autotyping on
│ ${bot.prefix}autotyping off
╰──────────────────`);

        if (sub === 'on') {
            db.AUTO_TYPING = true;
            save(db);
            return await m.reply('`✓ Auto Typing ENABLED — bot will show typing... before commands`');
        }
        if (sub === 'off') {
            db.AUTO_TYPING = false;
            save(db);
            return await m.reply('`✘ Auto Typing DISABLED`');
        }
        return await m.reply(`Usage: ${bot.prefix}autotyping on/off`);
    }
};
