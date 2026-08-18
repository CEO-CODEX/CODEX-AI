module.exports = {
    name: 'poll',
    aliases: ['createpoll', 'vote'],
    category: 'group',
    reactions: { start: '👥', success: '📋' },
    description: 'Create a native WhatsApp poll.',
    usage: '.poll Question | Option1 | Option2 (prefix with "multi" for multi-select)',
    groupOnly: true,

    async execute(bot, m, args) {
        let isMulti = false;
        let fullText = args.join(' ').trim();

        if (fullText.toLowerCase().startsWith('multi ')) {
            isMulti = true;
            fullText = fullText.slice(6).trim();
        }

        const parts = fullText.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length < 3) {
            return m.reply(`Usage: ${bot.prefix}poll Question | Option1 | Option2`);
        }

        const question = parts[0];
        const options = parts.slice(1);
        if (options.length > 12) return m.reply('Maximum 12 options.');
        if (question.length > 255) return m.reply('Question too long (max 255 characters).');

        try {
            await bot.sock.sendMessage(m.chat, {
                poll: {
                    name: question,
                    values: options,
                    selectableCount: isMulti ? 0 : 1,
                },
            });
        } catch (err) {
            await m.reply(`Failed to create poll: ${err.message}`);
        }
    },
};
