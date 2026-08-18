const { getTarget } = require('../../lib/getTarget');
const akickStore     = require('../../lib/akickStore');

module.exports = {
    name: 'akick',
    aliases: ['autokick'],
    category: 'admin',
    reactions: { start: '🛡️' },
    description: 'Auto-kick list: anyone on it is instantly removed again the moment they try to rejoin.\n' +
                 '.akick add @user — .akick remove @user — .akick clear — .akick list',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const sub = (args[0] || '').toLowerCase();

        if (sub === 'add') {
            const target = getTarget(m);
            if (!target) return m.reply(`Reply to a message or tag a user.\n${bot.prefix}akick add @user`);
            if (akickStore.isListed(m.chat, target)) {
                return m.reply(`@${target.split('@')[0]} is already on the auto-kick list.`, { mentions: [target] });
            }
            akickStore.add(m.chat, target);
            return bot.sendMessage(m.chat, {
                text: `🚫 @${target.split('@')[0]} added to the auto-kick list.\nThey'll be removed automatically every time they try to rejoin.`,
                mentions: [target]
            });
        }

        if (sub === 'remove' || sub === 'del' || sub === 'delete') {
            const target = getTarget(m);
            if (!target) return m.reply(`Reply to a message or tag a user.\n${bot.prefix}akick remove @user`);
            const removed = akickStore.remove(m.chat, target);
            if (!removed) return m.reply(`@${target.split('@')[0]} isn't on the auto-kick list.`, { mentions: [target] });
            return bot.sendMessage(m.chat, {
                text: `✅ @${target.split('@')[0]} removed from the auto-kick list. They can rejoin normally now.`,
                mentions: [target]
            });
        }

        if (sub === 'clear') {
            akickStore.clear(m.chat);
            return m.reply('🧹 Auto-kick list cleared for this group.');
        }

        if (sub === 'list' || sub === '') {
            const jids = akickStore.list(m.chat);
            if (!jids.length) return m.reply('The auto-kick list is empty.');
            return bot.sendMessage(m.chat, {
                text: `🚫 Auto-kick list (${jids.length}):\n${jids.map((j, i) => `${i + 1}. @${j.split('@')[0]}`).join('\n')}`,
                mentions: jids
            });
        }

        return m.reply(`Usage:\n${bot.prefix}akick add @user\n${bot.prefix}akick remove @user\n${bot.prefix}akick clear\n${bot.prefix}akick list`);
    }
};
