const { BOT_CHARACTERS } = require('../../lib/characterEngine');

module.exports = {
    name: 'botcharacter',
    aliases: ['characters', 'charlist'],
    category: 'bot',
    description: 'List all available bot characters',

    async execute(bot, m, args) {
        const current = bot.config.BOT_CHARACTER || 'off';
        let text = `BOT CHARACTERS\n\n`;
        text += `Current: ${current}\n`;
        text += `Total: ${BOT_CHARACTERS.length}\n\n`;
        text += `Set: ${bot.prefix}setvar BOT_CHARACTER=<number>\n`;
        text += `Auto: ${bot.prefix}setvar BOT_CHARACTER=automatic\n`;
        text += `Off: ${bot.prefix}setvar BOT_CHARACTER=off\n\n`;
        text += `── List ──\n`;

        for (let i = 0; i < BOT_CHARACTERS.length; i++) {
            text += `${i + 1}. ${BOT_CHARACTERS[i]}\n`;
        }

        await m.reply(text.trim());
    }
};
