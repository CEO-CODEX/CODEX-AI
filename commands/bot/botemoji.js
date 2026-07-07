const { BOT_EMOJIS } = require('../../lib/characterEngine');

module.exports = {
    name: 'botemoji',
    aliases: ['emojilist', 'emojis'],
    category: 'bot',
    description: 'List all available bot emojis',

    async execute(bot, m, args) {
        const current = bot.config.BOT_EMOJI || 'off';
        let text = `BOT EMOJIS\n\n`;
        text += `Current: ${current}\n`;
        text += `Total: ${BOT_EMOJIS.length}\n\n`;
        text += `Set: ${bot.prefix}setvar BOT_EMOJI=<number>\n`;
        text += `Auto: ${bot.prefix}setvar BOT_EMOJI=automatic\n`;
        text += `Off: ${bot.prefix}setvar BOT_EMOJI=off\n\n`;
        text += `── List ──\n`;

        for (let i = 0; i < BOT_EMOJIS.length; i++) {
            text += `${i + 1}. ${BOT_EMOJIS[i]}\n`;
        }

        await m.reply(text.trim());
    }
};
