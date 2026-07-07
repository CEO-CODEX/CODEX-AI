const fs   = require('fs-extra');
const DB   = './database/dnd.json';
const read = () => { try { return JSON.parse(fs.readFileSync(DB,'utf8')); } catch { return { enabled: false, customMsg: null }; } };
const save = (d) => { fs.ensureDirSync('./database'); fs.writeFileSync(DB, JSON.stringify(d,null,2)); };

module.exports = {
    name: 'dnd',
    aliases: ['donotdisturb', 'disturb'],
    category: 'owner',
    ownerOnly: true,
    description: 'Toggle Do Not Disturb mode — bot deletes tags/replies and warns the tagger',

    async execute(bot, m, args) {
        const db  = read();
        const sub = args[0]?.toLowerCase();

        if (!sub) {
            return await m.reply(
`🔕 *DO NOT DISTURB*

Status: *${db.enabled ? '🔴 ON' : '🟢 OFF'}*
${db.customMsg ? `Message: _${db.customMsg}_` : ''}

Usage:
${bot.prefix}dnd on
${bot.prefix}dnd off
${bot.prefix}dnd msg <custom message>`);
        }

        if (sub === 'on') {
            db.enabled = true;
            save(db);
            return await m.reply('🔕 *DND ON* — Tags and replies to you will be deleted and warned.');
        }

        if (sub === 'off') {
            db.enabled = false;
            save(db);
            return await m.reply('🔔 *DND OFF* — You can now be tagged freely.');
        }

        if (sub === 'msg') {
            const msg = args.slice(1).join(' ').trim();
            if (!msg) return await m.reply('Usage: .dnd msg <your custom message>');
            db.customMsg = msg;
            save(db);
            return await m.reply(`✅ DND message set to:\n_${msg}_`);
        }

        return await m.reply(`Usage: ${bot.prefix}dnd on/off/msg`);
    }
};
