const fs = require('fs-extra');

const DB_PATH = './database/autoreply.json';

function readDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
    catch { return { enabled: false, mode: 'text', emojis: [], rules: [] }; }
}
function saveDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

module.exports = {
    name: 'autoreply',
    aliases: ['ar', 'autoresponse'],
    category: 'bot',
    description: 'Configure auto-reply rules triggered by keywords or tag',

    async execute(bot, m, args) {
        const db  = readDB();
        const sub = args[0]?.toLowerCase();

        const areplyNum = bot.config.AREPLY_NUMBER || 'not set';

        if (!sub) {
            const ruleList = db.rules?.length
                ? db.rules.map((r, i) => `${i + 1}. "${r.trigger}" → "${r.reply}"`).join('\n')
                : 'No rules set.';
            return await m.reply(
`AUTOREPLY SETTINGS

Status: ${db.enabled ? 'ON' : 'OFF'}
Mode: ${db.mode || 'text'}
Emojis: ${db.emojis?.length ? db.emojis.join(' ') : 'none'}
Tag trigger number: ${areplyNum}

Rules:
${ruleList}

Usage:
${bot.prefix}autoreply on
${bot.prefix}autoreply off
${bot.prefix}autoreply mode text
${bot.prefix}autoreply mode emoji
${bot.prefix}autoreply setemoji 😂 🔥 ❤
${bot.prefix}autoreply add <trigger> | <reply>
${bot.prefix}autoreply remove <number>
${bot.prefix}autoreply list

Tag trigger:
.setvar AREPLY_NUMBER=2348012345678
When that number gets tagged, bot replies with the first rule's reply.`
            );
        }

        if (sub === 'on')  { db.enabled = true;  saveDB(db); return await m.reply('Auto-reply enabled.'); }
        if (sub === 'off') { db.enabled = false; saveDB(db); return await m.reply('Auto-reply disabled.'); }

        if (sub === 'mode') {
            const mode = args[1]?.toLowerCase();
            if (!mode || !['text','emoji'].includes(mode))
                return await m.reply('Use: text or emoji');
            db.mode = mode; saveDB(db);
            return await m.reply(`Auto-reply mode set to: ${mode}`);
        }

        if (sub === 'setemoji') {
            const emojis = args.slice(1).filter(e => /\p{Emoji}/u.test(e)).slice(0, 5);
            if (!emojis.length) return await m.reply('Provide up to 5 emojis.');
            db.emojis = emojis; saveDB(db);
            return await m.reply(`Emojis set: ${emojis.join(' ')}`);
        }

        if (sub === 'add') {
            const rest  = args.slice(1).join(' ');
            const parts = rest.split('|');
            if (parts.length < 2) return await m.reply(`Format: ${bot.prefix}autoreply add <trigger> | <reply>`);
            const trigger = parts[0].trim().toLowerCase();
            const reply   = parts.slice(1).join('|').trim();
            if (!trigger || !reply) return await m.reply('Trigger and reply cannot be empty.');
            if (!db.rules) db.rules = [];
            db.rules.push({ trigger, reply });
            saveDB(db);
            return await m.reply(`Rule added:\n"${trigger}" → "${reply}"`);
        }

        if (sub === 'remove') {
            const idx = parseInt(args[1]) - 1;
            if (isNaN(idx) || !db.rules?.[idx]) return await m.reply('Invalid rule number.');
            const removed = db.rules.splice(idx, 1)[0];
            saveDB(db);
            return await m.reply(`Removed: "${removed.trigger}" → "${removed.reply}"`);
        }

        if (sub === 'list') {
            if (!db.rules?.length) return await m.reply('No rules set.');
            const list = db.rules.map((r, i) => `${i + 1}. "${r.trigger}" → "${r.reply}"`).join('\n');
            return await m.reply(`AUTO-REPLY RULES\n\n${list}`);
        }

        await m.reply('Unknown option. Use ' + bot.prefix + 'autoreply');
    }
};
