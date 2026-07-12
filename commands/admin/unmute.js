const { parseTime, humanize, schedule, cancelAll } = require('../../lib/mute-core');

module.exports = {
    name: 'unmute', aliases: ['unlock', 'unlockgroup', 'groupopen'],
    category: 'admin', adminOnly: true, groupOnly: true,
    description: 'Unmute the group. .unmute / .unmute after 10m',

    async execute(bot, m, args) {
        const jid    = m.chat;
        const joined = args.join(' ').trim().replace(/\bafter\b/i, '').trim();
        const ms     = joined ? parseTime(joined) : null;

        if (joined && !ms) return m.reply('⚠️ Bad duration. Try: 10m 1h 6h 1d 7d');

        // ── Delayed: .unmute after 10m ─────────────────────────────────────
        if (ms) {
            cancelAll({ chat: jid });
            schedule({ type: 'unmuteGroup', chat: jid, expiresAt: Date.now() + ms, mutedBy: m.sender, source: 'delayed' });
            return m.reply(`_Request received, group will be unmuted in ${humanize(ms)} (delayed action)_`);
        }

        try { await bot.sock.groupSettingUpdate(jid, 'not_announcement'); }
        catch (e) { return m.reply(`❌ Failed: ${e.message}\n(Bot must be admin)`); }

        cancelAll({ chat: jid });
        const all = [];
        try { const meta = await bot.sock.groupMetadata(jid); all.push(...meta.participants.map(p => p.id)); } catch {}

        // ── Infinite: .unmute ──────────────────────────────────────────────
        await bot.sendMessage(jid, { text: '_Group unmuted (infinite action)_', mentions: all });
    }
};

