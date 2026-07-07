const { applyFont, applyFancyFont, FONT_COUNT, FANCY_FONT_COUNT } = require('../../lib/fontEngine');

module.exports = {
    name: 'botfont',
    aliases: ['fonts', 'fontlist'],
    category: 'bot',
    description: 'List all available bot fonts and fancy text styles',

    async execute(bot, m, args) {
        const PREVIEW = 'CODEX AI';
        const current  = bot.config.BOT_FONT || 0;
        const custom   = bot.config.CUSTOM_BFONT || 0;

        let text = `📚 Bot Fonts\n`;
        text += `Current: ${current === 0 ? 'OFF (plain text)' : `#${current}`}\n`;
        text += `Custom: ${custom === 0 ? 'none set' : `#${custom}`}\n\n`;
        text += `Set: ${bot.prefix}setvar BOT_FONT=<number>\n`;
        text += `Custom: ${bot.prefix}setvar CUSTOM_BFONT=<number>\n`;
        text += `Restore: ${bot.prefix}setvar BOT_FONT=custom\n\n`;
        text += `--- BOT FONTS (1-${FONT_COUNT}) ---\n\n`;

        for (let i = 1; i <= FONT_COUNT; i++) {
            text += `${i}. ${applyFont(PREVIEW, i)}\n`;
        }

        text += `\n--- FANCY TEXT STYLES (1-${FANCY_FONT_COUNT}) ---\n`;
        text += `Usage: ${bot.prefix}fancy <number> <your text>\n\n`;

        for (let i = 1; i <= FANCY_FONT_COUNT; i++) {
            text += `${i}. ${applyFancyFont(PREVIEW, i)}\n`;
        }

        await m.reply(text.trim());
    }
};
