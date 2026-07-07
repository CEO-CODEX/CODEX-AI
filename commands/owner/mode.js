const fs = require('fs-extra');

module.exports = {
    name: 'mode',
    aliases: ['botmode'],
    category: 'owner',
    ownerOnly: true,
    description: 'Switch bot between public and private mode',

    async execute(bot, m, args) {
        const val = args[0]?.toLowerCase();

        if (!val || !['public', 'private'].includes(val)) {
            const cur = (bot.config.mode || 'public').toUpperCase();
            return await m.reply(
`x *MODE*

x Current : ${cur}

x Usage:
  ${bot.prefix}mode public   — everyone can use the bot (GC, DM, bot DM)
  ${bot.prefix}mode private  — only owner / mods / sudo (in GC, DM, bot DM)`
            );
        }

        bot.config.mode = val;
        fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));

        await m.reply(val === 'public'
            ? 'x Mode set to *PUBLIC*.\nx Everyone can now use the bot in groups, DMs and the bot DM.'
            : 'x Mode set to *PRIVATE*.\nx Only owner, mods and sudo can use the bot (groups, DMs and the bot DM).'
        );
    }
};
