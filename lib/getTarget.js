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

/**
 * resolveTargets(bot, m)
 * LID-safe target resolver for mod/sudo storage. Returns an ARRAY of every
 * known JID form for the tagged/quoted user (both @lid and @s.whatsapp.net
 * when resolvable), so permission checks match regardless of which identifier
 * WhatsApp later reports the sender as. Falls back to just the raw target.
 */
async function resolveTargets(bot, m) {
    const primary = getTarget(m);
    if (!primary) return [];

    const forms = new Set([primary]);
    const lidMap = bot?.sock?.signalRepository?.lidMapping;

    try {
        if (primary.endsWith('@lid') && lidMap?.getPNForLID) {
            const pn = await lidMap.getPNForLID(primary);
            if (pn) forms.add(pn.replace(/:[0-9]+@/, '@'));
        } else if (primary.endsWith('@s.whatsapp.net') && lidMap?.getLIDForPN) {
            const lid = await lidMap.getLIDForPN(primary);
            if (lid) forms.add(lid.replace(/:[0-9]+@/, '@'));
        }
    } catch {}

    return [...forms];
}

module.exports = { getTarget, resolveTargets };
