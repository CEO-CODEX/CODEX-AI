const fs   = require('fs-extra');
const path = require('path');

const DB    = path.join(process.cwd(), 'database/antigroupmention.json');
const readDB = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveDB = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

module.exports = {
    name: 'antigm',
    aliases: ['antigroupmention', 'antistatusmentiongroup'],
    category: 'admin',
    description: 'Configure anti-group-mention: stop members from mentioning this group in their status',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const jid = m.chat;
        const a0  = (args[0] || '').toLowerCase();
        const a1  = (args[1] || '').toLowerCase();
        const db  = readDB();
        const cfg = db[jid] || { enabled: false, action: 'warn', maxWarns: 3 };

        if (!a0 || a0 === 'status') {
            return m.reply(
`🔒 *Anti Group Mention*

❏◦ Status: \`${cfg.enabled ? '✅ ON' : '❌ OFF'}\`
❏◦ Action: *${(cfg.action || 'warn').toUpperCase()}*
❏◦ Max Warns: *${cfg.maxWarns || 3}* (warn mode only)

*Commands:*
${bot.prefix}antigm on / off
${bot.prefix}antigm action warn / kick / delete
${bot.prefix}antigm maxwarns <number>

_Detects when members mention this group in their WhatsApp status and takes the configured action._`
            );
        }

        if (a0 === 'on' || a0 === 'off') {
            db[jid] = { ...cfg, enabled: a0 === 'on' };
            saveDB(db);
            return m.reply(a0 === 'on'
                ? '✅ Anti Group Mention *ENABLED* — members who mention this group in their status will be actioned.'
                : '❌ Anti Group Mention *DISABLED*.');
        }

        if (a0 === 'action') {
            if (!['warn', 'kick', 'delete'].includes(a1)) {
                return m.reply(`Usage: ${bot.prefix}antigm action warn|kick|delete`);
            }
            db[jid] = { ...cfg, action: a1 };
            saveDB(db);
            return m.reply(`✅ Action set to *${a1.toUpperCase()}*.`);
        }

        if (a0 === 'maxwarns') {
            const n = parseInt(a1);
            if (!n || n < 1) return m.reply(`Usage: ${bot.prefix}antigm maxwarns <number>`);
            db[jid] = { ...cfg, maxWarns: n };
            saveDB(db);
            return m.reply(`✅ Max warns set to *${n}*.`);
        }

        return m.reply(`Unknown option. Try ${bot.prefix}antigm status.`);
    }
};
