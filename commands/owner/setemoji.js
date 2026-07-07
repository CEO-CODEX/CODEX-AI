const fs   = require('fs');
const path = require('path');
const DB   = path.join(process.cwd(), 'database/setemoji.json');

const load = () => { try { return JSON.parse(fs.readFileSync(DB,'utf8')); } catch { return {}; } };
const save = (d)  => { fs.mkdirSync(path.dirname(DB), { recursive:true }); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

module.exports = {
    name: 'setemoji',
    aliases: ['emojimap', 'bindemoji'],
    category: 'owner',
    ownerOnly: true,
    description: 'Bind an emoji to a command. Send that emoji to trigger the command.',

    execute: async (bot, m, args) => {
        const db  = load();
        const sub = args[0];

        // .setemoji list
        if (!sub || sub === 'list') {
            const entries = Object.entries(db);
            if (!entries.length) return await m.reply('No emoji bindings set yet.\nUsage: .setemoji <emoji> <command>');
            const list = entries.map(([emoji, cmd]) => `${emoji} → ${bot.prefix}${cmd}`).join('\n');
            return await m.reply(`╭─❍ *SETEMOJI BINDINGS*\n│\n${list.split('\n').map(l=>'│ '+l).join('\n')}\n╰──────────────────`);
        }

        // .setemoji clear
        if (sub === 'clear') {
            const cleared = Object.keys(db);
            cleared.forEach(k => delete db[k]);
            save(db);
            return await m.reply(`✅ Cleared ${cleared.length} emoji binding(s).`);
        }

        // .setemoji remove <emoji>
        if (sub === 'remove' || sub === 'del') {
            const emoji = args[1];
            if (!emoji) return await m.reply('Usage: .setemoji remove <emoji>');
            if (!db[emoji]) return await m.reply(`No binding found for: ${emoji}`);
            delete db[emoji];
            save(db);
            return await m.reply(`✅ Removed binding for: ${emoji}`);
        }

        // .setemoji <emoji> <command>
        const emoji   = sub;
        const command = args.slice(1).join(' ').trim();
        if (!command) return await m.reply(`Usage: .setemoji <emoji> <command>\nExample: .setemoji 🏓 ping`);

        // Remove prefix if user included it
        const cleanCmd = command.startsWith(bot.prefix) ? command.slice(bot.prefix.length) : command;
        db[emoji] = cleanCmd;
        save(db);
        return await m.reply(`✅ Bound: *${emoji}* → \`${bot.prefix}${cleanCmd}\`\n\nNow just send *${emoji}* and the bot will run *${bot.prefix}${cleanCmd}*`);
    }
};
