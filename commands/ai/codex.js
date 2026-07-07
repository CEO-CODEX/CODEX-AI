/**
 * CODEX AI — direct-ask command
 * Usage: .codex <question>
 *
 * For the "always-on" ambient assistant in a specific chat, see:
 *   .chatbot   — group auto-reply (replies when tagged or replied to)
 *   .chatbotdm — DM auto-reply (replies to anyone who messages this number)
 */
const smartAI = require('../../lib/smartAI');
const { CODEX_IDENTITY } = require('../../lib/codexPersona');

module.exports = {
    name: 'codex',
    aliases: ['ai', 'ask'],
    description: 'Ask CODEX AI anything',
    usage: '.codex <your question>',
    category: 'ai',

    async execute(bot, m, args) {
        const input = args.join(' ').trim();

        if (!input) {
            return await m.reply(
                `🤖 *CODEX AI*\n\n` +
                `Usage: *${bot.prefix}codex <question>*\n\n` +
                `For always-on chat in this conversation:\n` +
                `• Groups → *${bot.prefix}chatbot on*\n` +
                `• DMs    → *${bot.prefix}chatbotdm on*`
            );
        }

        await bot.sock.sendMessage(m.chat, {
            react: { text: '🤖', key: m.key }
        }).catch(() => {});

        const memKey = 'codex:' + m.chat;
        const aiReply = await smartAI.ask({
            bot,
            key: memKey,
            system: CODEX_IDENTITY,
            user: input,
        });

        if (!aiReply) {
            return await m.reply(
                `🤖 _No response — the AI key may be missing or rate-limited._\n\n` +
                `Owner can check with *${bot.prefix}aiapi status*.`
            );
        }

        await m.reply(`🤖 *CODEX AI:*\n\n${aiReply}`);
    }
};
