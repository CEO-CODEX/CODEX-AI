module.exports = {
    name: 'lockgc',
    aliases: ['lockgroup', 'gclock', 'fulllock'],
    category: 'group',
    reactions: { start: '👥', success: '📋' },
    description: 'Only admins can edit group info / add members.',
    groupOnly: true,
    adminOnly: true,

    async execute(bot, m) {
        try {
            await bot.sock.groupSettingUpdate(m.chat, 'locked');
            await m.reply('Group locked — only admins can manage it now.');
        } catch (err) {
            const msg = err.message?.includes('not-authorized')
                ? "I need to be an admin first."
                : err.message;
            await m.reply(`Failed: ${msg}`);
        }
    },
};
