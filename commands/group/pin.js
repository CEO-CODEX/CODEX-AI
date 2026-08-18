const { getQuoted } = require('../../lib/getQuoted');

const activePins = new Map();

module.exports = {
    name: 'pin',
    aliases: ['msgpin', 'gmpin'],
    category: 'group',
    reactions: { start: '👥', success: '📋' },
    description: 'Pin a replied message for a set duration.',
    usage: '.pin 24hr | 7d | 30d (reply to a message)',
    groupOnly: true,
    adminOnly: true,

    async execute(bot, m, args) {
        const quoted = getQuoted(bot, m);
        if (!quoted) return m.reply(`Reply to a message.\nUsage: ${bot.prefix}pin 24hr`);

        const timeInput = (args[0] || '').toLowerCase();
        const durations = { '24hr': 86400, '7d': 604800, '30d': 2592000 };
        const labels = { '24hr': '24 hours', '7d': '7 days', '30d': '30 days' };

        if (!durations[timeInput]) {
            return m.reply(`Usage: ${bot.prefix}pin 24hr | 7d | 30d`);
        }

        const duration = durations[timeInput];
        const pinId = `${m.chat}-${quoted.key.id}`;

        try {
            await bot.sock.sendMessage(m.chat, { pin: quoted.key, type: 1, time: duration });

            activePins.set(pinId, { key: quoted.key, chat: m.chat, expires: Date.now() + duration * 1000 });

            await m.reply(`Pinned for ${labels[timeInput]}.`);

            setTimeout(async () => {
                try {
                    await bot.sock.sendMessage(m.chat, { pin: quoted.key, type: 1, time: 0 });
                    activePins.delete(pinId);
                } catch {}
            }, duration * 1000);
        } catch (err) {
            await m.reply(`Failed to pin: ${err.message}`);
        }
    },
};
