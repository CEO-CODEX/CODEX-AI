module.exports = {
    name: 'afk',
    category: 'general',
    description: 'Set/disable AFK. Usage: .afk <reason> | .afk off | .afk config',

    async execute(bot, m, args) {
        const sub = (args[0] || '').toLowerCase();

        // ── .afk off — disable AFK manually ──────────────────────────────────
        if (sub === 'off') {
            const removed = bot.afkSystem.removeAFK(m.sender);
            if (!removed) return await m.reply(`You are not currently AFK.`);
            const duration = bot.afkSystem._duration(Date.now() - removed.time);
            const count    = (removed.mentions || []).length;
            return await m.reply(
`👋 *AFK disabled.*
Reason you were away: ${removed.reason}
Duration: ${duration}
Mentioned ${count} time(s) while away.`
            );
        }

        // ── .afk config — show modes ──────────────────────────────────────────
        if (sub === 'config') {
            const currentMode = bot.afkSystem.getMode(m.sender);
            return await m.reply(
`⚙️ *AFK CONFIG*
Current mode: *${currentMode.toUpperCase()}*

Modes:
tag     — Only notifies when someone @tags you
mention — Only notifies when someone replies to your message
all     — Both tags AND quoted replies trigger

Change with:
.afk mode tag
.afk mode mention
.afk mode all`
            );
        }

        // ── .afk mode <tag|mention|all> ───────────────────────────────────────
        if (sub === 'mode') {
            const newMode = (args[1] || '').toLowerCase();
            if (!['tag', 'mention', 'all'].includes(newMode)) {
                return await m.reply(`Invalid mode. Use: tag, mention, or all`);
            }
            bot.afkSystem.setMode(m.sender, newMode);
            return await m.reply(`✅ AFK mode set to: *${newMode.toUpperCase()}*`);
        }

        // ── .afk <reason> — enable AFK ────────────────────────────────────────
        const reason = args.join(' ').trim() || 'AFK';
        const mode   = bot.afkSystem.getMode(m.sender);
        bot.afkSystem.setAFK(m.sender, reason, m.pushName);

        // Plain reply — no mention, no tag — so bot doesn't trigger itself
        await bot.sendMessage(m.chat, {
            text:
`🌙 *AFK mode enabled*
Reason: ${reason}
Mode: ${mode.toUpperCase()}
I will notify the group and DM you when someone tags or replies to your message.
Send any message to disable AFK.`
        });
    }
};
