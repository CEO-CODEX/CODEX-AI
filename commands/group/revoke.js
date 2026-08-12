module.exports = {
    name: 'revoke',
    aliases: ['resetlink', 'newlink', 'revokelink'],
    category: 'group',
    description: 'Revoke and renew the group invite link.',
    groupOnly: true,
    adminOnly: true,

    async execute(bot, m) {
        try {
            const newCode = await bot.sock.groupRevokeInvite(m.chat);
            const link = `https://chat.whatsapp.com/${newCode}`;
            await m.reply(`Link revoked and renewed:\n${link}`);
        } catch (err) {
            await m.reply(`Failed to revoke link — make sure I'm an admin.\n${err.message}`);
        }
    },
};
