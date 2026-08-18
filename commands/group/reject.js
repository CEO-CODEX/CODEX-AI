module.exports = {
    name: 'reject',
    aliases: ['rejectall', 'denyall'],
    category: 'group',
    reactions: { start: '⚙️' },
    description: 'Reject all pending group join requests.',
    groupOnly: true,
    adminOnly: true,

    async execute(bot, m) {
        try {
            const requests = await bot.sock.groupRequestParticipantsList(m.chat);
            if (!requests?.length) return m.reply('No pending join requests.');

            const jids = requests.map(r => r.jid);
            await bot.sock.groupRequestParticipantsUpdate(m.chat, jids, 'reject');
            await m.reply(`Rejected ${jids.length} join request(s).`);
        } catch (err) {
            const msg = err.message?.includes('not-authorized')
                ? "I need to be an admin first."
                : err.message;
            await m.reply(`Failed: ${msg}`);
        }
    },
};
