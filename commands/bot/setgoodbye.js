const fs = require('fs-extra');

module.exports = {
    name: 'setgoodbye',
    aliases: ['goodbyemsg', 'goodbye'],
    category: 'bot',
    description: 'Configure goodbye message for this group',
    groupOnly: true,

    async execute(bot, m, args) {
        const dbPath = './database/goodbye.json';
        let db = {};
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch {}
        if (!db[m.chat]) db[m.chat] = { enabled: true, text: null };

        const sub = args[0]?.toLowerCase();

        if (!sub) return await m.reply(
`GOODBYE SETTINGS

Status: ${db[m.chat]?.enabled !== false ? 'ON' : 'OFF'}
Message: ${db[m.chat]?.text || 'default'}

Usage:
${bot.prefix}setgoodbye on
${bot.prefix}setgoodbye off
${bot.prefix}setgoodbye set <message>
${bot.prefix}setgoodbye reset

Variables:
@user  - tags the leaving member (can be anywhere in message)
{group} - group name
{count} - remaining member count

Example:
${bot.prefix}setgoodbye set Goodbye @user! We will miss you.`
        );

        if (sub === 'on') {
            db[m.chat].enabled = true;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            return await m.reply('Goodbye message enabled for this group.');
        }

        if (sub === 'off') {
            db[m.chat].enabled = false;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            return await m.reply('Goodbye message disabled for this group.');
        }

        if (sub === 'reset') {
            db[m.chat].text = null;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            return await m.reply('Goodbye message reset to default.');
        }

        if (sub === 'set') {
            const text = args.slice(1).join(' ').trim();
            if (!text) return await m.reply(`Provide a message. Example:\n${bot.prefix}setgoodbye set Goodbye @user! We will miss you.`);
            db[m.chat].text = text;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            const preview = text.replace('@user', '@YOU').replace('{group}', 'This Group').replace('{count}', '99');
            return await m.reply(`Goodbye message set.\n\nPreview:\n${preview}`);
        }

        await m.reply(`Unknown option. Use ${bot.prefix}setgoodbye`);
    }
};
