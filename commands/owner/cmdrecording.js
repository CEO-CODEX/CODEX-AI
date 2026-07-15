const fs   = require('fs-extra');
const DB   = './database/variables.json';
const read = () => { try { return JSON.parse(fs.readFileSync(DB,'utf8')); } catch { return {}; } };
const save = (d) => { fs.ensureDirSync('./database'); fs.writeFileSync(DB, JSON.stringify(d,null,2)); };

module.exports = {
    name: 'autorecording',
    aliases: ['cmdrecording','commandrecording','autorec','recording'],
    category: 'owner',
    ownerOnly: true,
    description: 'Toggle auto recording indicator (on incoming messages or commands)',

    async execute(bot, m, { args, reply, prefix }) {
        const sub = args[0]?.toLowerCase();
        const sub2 = args[1]?.toLowerCase();
        const db  = read();
        
        // AUTO_RECORDING = shows recording when receiving messages
        // CMD_RECORDING = shows recording when executing commands
        const autoRecordingStatus = db.AUTO_RECORDING === true || db.AUTO_RECORDING === 'true';
        const cmdRecordingStatus = db.CMD_RECORDING === true || db.CMD_RECORDING === 'true';

        if (!sub || sub === 'status') {
            return await reply(
`╭─❍ *RECORDING INDICATORS*
│
│ *AUTO* (on incoming msg) : *${autoRecordingStatus ? 'ON ✓' : 'OFF ✗'}*
│ *CMD* (on command exec)   : *${cmdRecordingStatus ? 'ON ✓' : 'OFF ✗'}*
│
│ Commands:
│ ${prefix}autorecording auto on|off
│ ${prefix}autorecording cmd on|off
╰──────────────────`);
        }

        // AUTO RECORDING — shows recording when bot receives messages
        if (sub === 'auto') {
            if (sub2 === 'on') {
                db.AUTO_RECORDING = true;
                save(db);
                return await reply('`✓ Auto Recording ENABLED — bot shows recording when receiving messages`');
            }
            if (sub2 === 'off') {
                db.AUTO_RECORDING = false;
                save(db);
                return await reply('`✘ Auto Recording DISABLED`');
            }
            return await reply(`Usage: ${prefix}autorecording auto on|off`);
        }

        // CMD RECORDING — shows recording when executing commands
        if (sub === 'cmd') {
            if (sub2 === 'on') {
                db.CMD_RECORDING = true;
                save(db);
                return await reply('`✓ Cmd Recording ENABLED — bot shows recording when running commands`');
            }
            if (sub2 === 'off') {
                db.CMD_RECORDING = false;
                save(db);
                return await reply('`✘ Cmd Recording DISABLED`');
            }
            return await reply(`Usage: ${prefix}autorecording cmd on|off`);
        }

        // Legacy: just "on" or "off" → toggle AUTO_RECORDING
        if (sub === 'on') {
            db.AUTO_RECORDING = true;
            save(db);
            return await reply('`✓ Auto Recording ENABLED`');
        }
        if (sub === 'off') {
            db.AUTO_RECORDING = false;
            save(db);
            return await reply('`✘ Auto Recording DISABLED`');
        }

        return await reply(`Usage: ${prefix}autorecording auto on|off or ${prefix}autorecording cmd on|off`);
    }
};
