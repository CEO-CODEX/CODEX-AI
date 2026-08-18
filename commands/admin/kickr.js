const { getContentType } = require('../../lib/baileys');

module.exports = {
    name: 'kickr',
    aliases: ['kickreply', 'mkick'],
    category: 'admin',
    reactions: { start: '🛡️' },
    description: 'Reply to a message that mentions people, and this removes every one of them from the group — except that message\'s own sender.',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const ctx = m.contextInfo || m.msg?.contextInfo || {};
        const quotedMsg = ctx.quotedMessage;
        if (!quotedMsg) {
            return m.reply(`Reply to a message that mentions the members you want removed.\nUsage: reply, then send ${bot.prefix}kickr`);
        }

        // Mentions live INSIDE the quoted message's own content, not on this
        // command message — pull them from there.
        let mentioned = [];
        try {
            const qType = getContentType(quotedMsg);
            const qContent = quotedMsg[qType];
            mentioned = qContent?.contextInfo?.mentionedJid || [];
        } catch {}

        if (!mentioned.length) {
            return m.reply('The replied message has no mentioned members to remove.');
        }

        const quotedSender = (ctx.participant || '').replace(/:[0-9]+@/, '@');
        const botJid = (bot.sock.user?.id || '').replace(/:[0-9]+@/, '@');

        const targets = [...new Set(mentioned)].filter(jid =>
            jid !== quotedSender &&   // protect the person who sent the quoted message
            jid !== m.sender &&        // protect whoever ran this command
            jid !== botJid              // never target the bot itself
        );

        if (!targets.length) {
            return m.reply('Nothing to remove — everyone mentioned is protected (the quoted message\'s sender, you, or the bot).');
        }

        if (!(await bot.permission.isBotAdmin(m.chat).catch(() => false))) {
            return m.reply('❌ I need to be a group admin to remove members.');
        }

        try {
            await bot.sock.groupParticipantsUpdate(m.chat, targets, 'remove');
            return bot.sendMessage(m.chat, {
                text: `✅ Removed ${targets.length} mentioned member(s) from the replied message.`,
                mentions: targets
            });
        } catch (err) {
            return m.reply(`❌ Failed to remove members: ${err.message}`);
        }
    }
};
                           
