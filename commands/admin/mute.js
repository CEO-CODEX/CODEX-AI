const { parseTime, humanize, schedule, cancelAll } = require('../../lib/mute-core');

module.exports = {
    name: 'mute', aliases: ['lock', 'lockgroup', 'groupclose'],
    category: 'admin', adminOnly: true, groupOnly: true,
    description: 'Mute the group. .mute / .mute 10m / .mute after 10m',

    async execute(bot, m, args) {
        const jid    = m.chat;
        const joined = args.join(' ').trim();
        const isAfter = /\bafter\b/i.test(joined);
        const timeStr = joined.replace(/\bafter\b/i, '').trim();
        const ms      = timeStr ? parseTime(timeStr) : null;

        if (timeStr && !ms) return m.reply('⚠️ Bad duration. Try: 10m 1h 6h 1d 7d');

        // ── Delayed: .mute after 10m ───────────────────────────────────────
        if (isAfter && ms) {
            cancelAll({ chat: jid });
            schedule({ type: 'muteGroup', chat: jid, expiresAt: Date.now() + ms, mutedBy: m.sender, source: 'delayed' });
            return m.reply(`_Request received, group will be muted in ${humanize(ms)} (delayed action)_`);
        }

        try { await bot.sock.groupSettingUpdate(jid, 'announcement'); }
        catch (e) { return m.reply(`❌ Failed: ${e.message}\n(Bot must be admin)`); }

        const all = [];
        try { const meta = await bot.sock.groupMetadata(jid); all.push(...meta.participants.map(p => p.id)); } catch {}

        // ── Timed: .mute 10m ───────────────────────────────────────────────
        if (ms) {
            cancelAll({ chat: jid });
            schedule({ type: 'unmuteGroup', chat: jid, expiresAt: Date.now() + ms, mutedBy: m.sender, source: 'timer' });
            return bot.sendMessage(jid, {
                text: `_Group muted for ${humanize(ms)} (timed action)_`,
                mentions: all
            });
        }

        // ── Infinite: .mute ────────────────────────────────────────────────
        await bot.sendMessage(jid, { text: '_Group muted (infinite action)_', mentions: all });
    }
};
