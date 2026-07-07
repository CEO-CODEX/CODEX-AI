const fs = require('fs-extra');

module.exports = {
    name: 'statusview',
    aliases: ['sv', 'statusreact', 'sr'],
    category: 'owner',
    ownerOnly: true,
    description: 'Toggle auto status view / react and set reaction emoji',

    async execute(bot, m, args) {
        const sub = args[0]?.toLowerCase();
        const p   = bot.prefix;

        if (!sub) {
            const viewOn  = bot.config.statusView?.enabled  !== false;
            const reactOn = bot.config.statusReact?.enabled === true;
            const emoji   = bot.config.statusReact?.emoji   || 'random';
            return await m.reply(
`x *STATUS VIEW*

x Auto View  : ${viewOn  ? 'ON' : 'OFF'}
x Auto React : ${reactOn ? 'ON' : 'OFF'}
x React Emoji: ${emoji}

x ${p}statusview on          — enable auto view
x ${p}statusview off         — disable auto view
x ${p}statusview react on    — enable auto react
x ${p}statusview react off   — disable auto react
x ${p}statusview emoji <e>   — set reaction emoji (or "random")`
            );
        }

        // .statusview on / off  → controls autoView
        if (sub === 'on' || sub === 'off') {
            if (!bot.config.statusView) bot.config.statusView = {};
            bot.config.statusView.enabled = (sub === 'on');
            fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
            return await m.reply(`x Status view : *${sub.toUpperCase()}*`);
        }

        // .statusview react on / off
        if (sub === 'react') {
            const v = args[1]?.toLowerCase();
            if (!v) return await m.reply(`x ${p}statusview react on/off`);
            if (!bot.config.statusReact) bot.config.statusReact = {};
            bot.config.statusReact.enabled = (v === 'on');
            fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
            return await m.reply(`x Status react : *${v === 'on' ? 'ON' : 'OFF'}*`);
        }

        // .statusview emoji 🔥  /  .statusview emoji random
        if (sub === 'emoji') {
            const sign = args[1];
            if (!sign) return await m.reply(`x ${p}statusview emoji <emoji or "random">`);
            if (!bot.config.statusReact) bot.config.statusReact = {};
            bot.config.statusReact.emoji = sign === 'random' ? null : sign;
            fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
            return await m.reply(`x Status react emoji : ${sign}`);
        }

        await m.reply(`x Unknown subcommand. Use ${p}statusview for help.`);
    }
};
