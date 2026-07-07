/**
 * getTarget(m)
 * Resolves the target user JID from either:
 *   1. A tagged mention  → .kick @user
 *   2. A quoted reply    → reply to their message then .kick
 * Returns clean JID (no device suffix) or null if neither found.
 */
function getTarget(m) {
    // 1. Tag — m.mentions is set by messageHandler
    if (m.mentions && m.mentions.length > 0) {
        return m.mentions[0].replace(/:[0-9]+@/, '@');
    }

    // 2. Quoted reply — participant is in the quoted context
    const ctx = m.msg?.contextInfo;
    if (ctx) {
        const participant = ctx.participant || ctx.remoteJid || null;
        if (participant) return participant.replace(/:[0-9]+@/, '@');
    }

    return null;
}

module.exports = { getTarget };
