const fs   = require('fs-extra');
const DB   = './database/variables.json';
const read = () => { try { return JSON.parse(fs.readFileSync(DB,'utf8')); } catch { return {}; } };
const save = (d) => { fs.ensureDirSync('./database'); fs.writeFileSync(DB, JSON.stringify(d,null,2)); };

module.exports = {
    name: 'autotyping',
    aliases: ['cmdtyping','commandtyping','autotyping','typing'],
    category: 'owner',
    ownerOnly: true,
    description: 'Toggle auto typing indicator (on incoming messages or commands)',

    async execute(bot, m, { args, reply, prefix }) {
        const sub = args[0]?.toLowerCase();
        const sub2 = args[1]?.toLowerCase();
        const db  = read();
        
        // AUTO_TYPING = shows typing when receiving messages
        // CMD_TYPING = shows typing when executing commands
        const autoTypingStatus = db.AUTO_TYPING === true || db.AUTO_TYPING === 'true';
        const cmdTypingStatus = db.CMD_TYPING === true || db.CMD_TYPING === 'true';

        if (!sub || sub === 'status') {
            return await reply(
`╭─❍ *TYPING INDICATORS*
│
│ *AUTO* (on incoming msg) : *${autoTypingStatus ? 'ON ✓' : 'OFF ✗'}*
│ *CMD* (on command exec)   : *${cmdTypingStatus ? 'ON ✓' : 'OFF ✗'}*
│
│ Commands:
│ ${prefix}autotyping auto on|off
│ ${prefix}autotyping cmd on|off
╰──────────────────`);
        }

        // AUTO TYPING — shows typing when bot receives messages
        if (sub === 'auto') {
            if (sub2 === 'on') {
                db.AUTO_TYPING = true;
                save(db);
                return await reply('`✓ Auto Typing ENABLED — bot shows typing when receiving messages`');
            }
            if (sub2 === 'off') {
                db.AUTO_TYPING = false;
                save(db);
                return await reply('`✘ Auto Typing DISABLED`');
            }
            return await reply(`Usage: ${prefix}autotyping auto on|off`);
        }

        // CMD TYPING — shows typing when executing commands
        if (sub === 'cmd') {
            if (sub2 === 'on') {
                db.CMD_TYPING = true;
                save(db);
                return await reply('`✓ Cmd Typing ENABLED — bot shows typing when running commands`');
            }
            if (sub2 === 'off') {
                db.CMD_TYPING = false;
                save(db);
                return await reply('`✘ Cmd Typing DISABLED`');
            }
            return await reply(`Usage: ${prefix}autotyping cmd on|off`);
        }

        // Legacy: just "on" or "off" → toggle AUTO_TYPING
        if (sub === 'on') {
            db.AUTO_TYPING = true;
            save(db);
            return await reply('`✓ Auto Typing ENABLED`');
        }
        if (sub === 'off') {
            db.AUTO_TYPING = false;
            save(db);
            return await reply('`✘ Auto Typing DISABLED`');
        }

        return await reply(`Usage: ${prefix}autotyping auto on|off or ${prefix}autotyping cmd on|off`);
    }
};
