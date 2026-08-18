const fs = require('fs-extra');

module.exports = {
    name: 'cmdreact',
    aliases: ['commandreact'],
    category: 'bot',
    description: 'Configure command reaction emojis',

    async execute(bot, m, args) {
        const sub  = args[0]?.toLowerCase();
        const save = () => fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));

        if (!bot.config.cmdReact) bot.config.cmdReact = { enabled: false, emoji: null, doneEmoji: null };
        const cr = bot.config.cmdReact;

        if (!sub) return await m.reply(`cmdreact ${cr.enabled ? 'on' : 'off'}`);

        if (sub === 'on')  { cr.enabled = true;  save(); return await m.reply('cmd reaction on'); }
        if (sub === 'off') { cr.enabled = false; save(); return await m.reply('cmd reaction off'); }

        if (sub === 'emoji') {
            const val = args[1];
            if (!val) return await m.reply(`Usage: ${bot.prefix}cmdreact emoji <emoji> or default`);
            if (val.toLowerCase() === 'default') {
                cr.emoji = null;
                save();
                return await m.reply('React emoji set back to system default (each command uses its own).');
            }
            cr.emoji = val;
            save();
            return await m.reply(`React emoji set to: ${val}\nAll commands will now react with this emoji.`);
        }

        if (sub === 'done') {
            const val = args[1];
            if (!val) return await m.reply(`Usage: ${bot.prefix}cmdreact done <emoji>`);
            cr.doneEmoji = val;
            save();
            return await m.reply(`Done emoji set to: ${val}`);
        }

        return await m.reply(`Unknown option. Use: ${bot.prefix}cmdreact`);
    }
};
