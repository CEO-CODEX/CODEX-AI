const fs = require('fs-extra');

module.exports = {
    name: 'autoread',
    aliases: ['ar'],
    category: 'owner',
    ownerOnly: true,
    description: 'Toggle auto-read (mark every incoming message as seen)',

    async execute(bot, m, args) {
        const sub = args[0]?.toLowerCase();

        if (!sub) {
            const cur = bot.config.autoRead ? 'ON' : 'OFF';
            return await m.reply(
`x *AUTO READ*

x Current : ${cur}

x ${bot.prefix}autoread on
x ${bot.prefix}autoread off`
            );
        }

        if (sub === 'on')  {
            bot.config.autoRead = true;
            fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
            return await m.reply('x Auto-read : *ON*\nx Bot will mark all messages as seen.');
        }

        if (sub === 'off') {
            bot.config.autoRead = false;
            fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
            return await m.reply('x Auto-read : *OFF*');
        }

        await m.reply(`x Usage: ${bot.prefix}autoread on/off`);
    }
};
