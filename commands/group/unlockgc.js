module.exports = {
    name: 'unlockgc',
    aliases: ['unlockgroup', 'gcunlock'],
    category: 'group',
    reactions: { start: '👥', success: '📋' },
    description: 'Allow all members to edit group info again.',
    groupOnly: true,
    adminOnly: true,

    async execute(bot, m) {
        try {
            await bot.sock.groupSettingUpdate(m.chat, 'unlocked');
            await m.reply('Group unlocked — all members can manage it again.');
        } catch (err) {
            const msg = err.message?.includes('not-authorized')
                ? "I need to be an admin first."
                : err.message;
            await m.reply(`Failed: ${msg}`);
        }
    },
};
