/**
 * getQuoted(bot, m)
 * Resolves the quoted message + a usable key for it (for .pin, .setgpp, etc).
 * This project's `m` object doesn't carry an `m.quoted` convenience field,
 * so this builds one from m.msg.contextInfo.
 */
function getQuoted(bot, m) {
    const ctx = m.msg?.contextInfo;
    if (!ctx?.stanzaId || !ctx?.quotedMessage) return null;

    const participant = ctx.participant || m.chat;
    const key = {
        remoteJid: m.chat,
        id: ctx.stanzaId,
        fromMe: bot.permission?.isOwner
            ? bot.permission.isOwner(participant)
            : false,
        participant,
    };

    return { message: ctx.quotedMessage, key };
}

module.exports = { getQuoted };
