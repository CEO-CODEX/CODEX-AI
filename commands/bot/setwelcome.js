const fs = require('fs-extra');

module.exports = {
    name: 'setwelcome',
    aliases: ['welcomemsg', 'welcome'],
    category: 'bot',
    description: 'Configure welcome message for this group',
    groupOnly: true,

    async execute(bot, m, args) {
        const dbPath = './database/welcome.json';
        let db = {};
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch {}
        if (!db[m.chat]) db[m.chat] = { enabled: true, text: null };

        const sub = args[0]?.toLowerCase();

        if (!sub) return await m.reply(
`WELCOME SETTINGS

Status: ${db[m.chat]?.enabled !== false ? 'ON' : 'OFF'}
Message: ${db[m.chat]?.text || 'default'}

Usage:
${bot.prefix}setwelcome on
${bot.prefix}setwelcome off
${bot.prefix}setwelcome set <message>
${bot.prefix}setwelcome reset

Variables:
@user  - tags the new member (can be anywhere in message)
{group} - group name
{count} - member count

Example:
${bot.prefix}setwelcome set Welcome @user to {group}! We are {count} members.`
        );

        if (sub === 'on') {
            db[m.chat].enabled = true;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            return await m.reply('Welcome message enabled for this group.');
        }

        if (sub === 'off') {
            db[m.chat].enabled = false;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            return await m.reply('Welcome message disabled for this group.');
        }

        if (sub === 'reset') {
            db[m.chat].text = null;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            return await m.reply('Welcome message reset to default.');
        }

        if (sub === 'set') {
            const text = args.slice(1).join(' ').trim();
            if (!text) return await m.reply(`Provide a message. Example:\n${bot.prefix}setwelcome set Welcome @user to {group}!`);
            db[m.chat].text = text;
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            const preview = text.replace('@user', '@YOU').replace('{group}', 'This Group').replace('{count}', '100');
            return await m.reply(`Welcome message set.\n\nPreview:\n${preview}`);
        }

        await m.reply(`Unknown option. Use ${bot.prefix}setwelcome`);
    }
};
