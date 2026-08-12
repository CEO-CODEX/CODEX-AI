module.exports = {
    name: 'approve',
    aliases: ['acceptall', 'approveall'],
    category: 'group',
    description: 'Approve all pending group join requests.',
    groupOnly: true,
    adminOnly: true,

    async execute(bot, m) {
        try {
            const requests = await bot.sock.groupRequestParticipantsList(m.chat);
            if (!requests?.length) return m.reply('No pending join requests.');

            const jids = requests.map(r => r.jid);
            await bot.sock.groupRequestParticipantsUpdate(m.chat, jids, 'approve');
            await m.reply(`Approved ${jids.length} join request(s).`);
        } catch (err) {
            const msg = err.message?.includes('not-authorized')
                ? "I need to be an admin first."
                : err.message;
            await m.reply(`Failed: ${msg}`);
        }
    },
};
