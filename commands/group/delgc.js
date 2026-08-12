// Two-step confirm: .delgc arms it, .delgc confirm (within 30s) executes it.
module.exports = {
    name: 'delgc',
    aliases: ['deletegc', 'dgc', 'kickall'],
    category: 'group',
    description: 'Kick every member and leave the group. Irreversible.',
    usage: '.delgc, then .delgc confirm within 30s',
    groupOnly: true,
    ownerOnly: true,

    async execute(bot, m, args) {
        if ((args[0] || '').toLowerCase() !== 'confirm') {
            bot._delgcArmed = bot._delgcArmed || new Map();
            bot._delgcArmed.set(m.chat, Date.now() + 30000);
            return m.reply(
                `This will remove every member and delete the group. This cannot be undone.\n` +
                `Run "${bot.prefix}delgc confirm" within 30 seconds to proceed.`
            );
        }

        const armedUntil = bot._delgcArmed?.get(m.chat);
        if (!armedUntil || Date.now() > armedUntil) {
            return m.reply(`Run "${bot.prefix}delgc" first, then confirm within 30 seconds.`);
        }
        bot._delgcArmed.delete(m.chat);

        try {
            const meta = await bot.sock.groupMetadata(m.chat);
            const toRemove = meta.participants
                .filter(p => p.id !== bot.sock.user.id)
                .map(p => p.id);

            if (toRemove.length) {
                await bot.sock.groupParticipantsUpdate(m.chat, toRemove, 'remove');
            }
            await bot.sock.groupLeave(m.chat);
        } catch (err) {
            await m.reply(`Failed to delete group: ${err.message}`);
        }
    },
};
