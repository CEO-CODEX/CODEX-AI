module.exports = {
    name: 'reload',
    aliases: ['repack', 'refresh'],
    category: 'bot',
    reactions: { start: '🔧' },
    description: 'Reload all commands without restarting the bot',

    async execute(bot, m, args) {
        const result = await bot.reloader.reload();
        await m.reply(result.message);
    }
};
