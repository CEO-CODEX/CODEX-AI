const { getContentType, downloadContentFromMessage } = require('../../lib/baileys');
const store = require('../../lib/messageStore');

module.exports = {
    name: 'quoted',
    aliases: ['q', 'getquoted', 'quote'],
    category: 'general',
    reactions: { start: '⚙️' },
    description: 'Extract a replied text or media message',

    async execute(sock, m, { args, reply }) {
        const ctx = m.contextInfo || m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo || {};
        const quoted = m.quoted?.message || m.quoted?.msg || ctx.quotedMessage;
        if (!quoted) return reply('Reply to a message first');

        // If the command itself is a tagged reply, recover the message that
        // reply was quoting. The quoted message could itself be plain text
        // OR media (image/video/audio/document/sticker) that was sent as a
        // reply, and it may be wrapped in a disappearing-message/view-once
        // envelope — look through all of those, not just extendedTextMessage.
        let taggedReply = getContextInfo(quoted) || getContextInfo(m.quoted?.msg) || getContextInfo(m.quoted?.message);

        // WhatsApp trims the contextInfo it embeds in the "quotedMessage" it
        // hands us — it does NOT include the quoted message's own contextInfo,
        // so the lookups above almost always come back empty for a reply-to-a-
        // reply chain. We already cache every message we receive in full
        // (including its real contextInfo) when it first arrives, so fall back
        // to that authoritative copy, keyed by the quoted message's own id.
        // Note: private (@lid) chats don't always relay contextInfo at all —
        // when that's the case this simply falls through to the immediate
        // quoted message below, which is the best we can do.
        if (!taggedReply && ctx.stanzaId) {
            const stored = store.getMessage({ remoteJid: m.chat, id: ctx.stanzaId });
            if (stored?.message) taggedReply = getContextInfo(stored.message);
        }
        const original = taggedReply?.quotedMessage || quoted;
        const originalCtx = taggedReply || ctx;
        const quotedSender = originalCtx.participant || originalCtx.participantAlt || ctx.participant || m.quoted?.sender;
        const key = {
            remoteJid: originalCtx.remoteJid || m.chat,
            id: originalCtx.stanzaId || `quoted-${Date.now()}`,
            participant: originalCtx.participant,
        };
        store.saveMessage({ key, message: original, pushName: originalCtx.pushName || '' });
        return forward(sock, m.chat, original, quotedSender, m);
    }
};

// Pull contextInfo out of a message object regardless of which message
// type is carrying it (text reply, or a media message sent as a reply),
// unwrapping ephemeral/view-once envelopes first if needed.
function getContextInfo(message, seen = new Set()) {
    if (!message || typeof message !== 'object' || seen.has(message)) return null;
    seen.add(message);
    const msg = unwrap(message);
    if (!msg || typeof msg !== 'object') return null;
    if (msg.contextInfo?.quotedMessage) return msg.contextInfo;
    if (message.contextInfo?.quotedMessage) return message.contextInfo;
    const CONTEXT_KEYS = [
        'extendedTextMessage', 'imageMessage', 'videoMessage', 'audioMessage',
        'documentMessage', 'stickerMessage', 'contactMessage', 'locationMessage',
        'documentWithCaptionMessage',
    ];
    for (const key of CONTEXT_KEYS) {
        const ctx = msg[key]?.contextInfo;
        if (ctx?.quotedMessage) return ctx;
    }
    for (const value of Object.values(msg)) {
        const nested = getContextInfo(value, seen);
        if (nested) return nested;
    }
    return null;
}

async function forward(sock, chat, message, sender, m) {
    const unwrapped = unwrap(message);
    const type = getContentType(unwrapped);
    const body = unwrapped?.[type];
    const normalizedType = type === 'documentWithCaptionMessage' ? 'documentMessage' : type;
    const mention = sender ? [sender] : [];
    const from = sender ? `From @${sender.split('@')[0]}\n` : '';
    if (!type || body == null) return sock.sendMessage(chat, { text: `${from}Unable to read the quoted message.`, mentions: mention });
    if (normalizedType === 'conversation' || normalizedType === 'extendedTextMessage') {
        const text = typeof body === 'string' ? body : body.text || '';
        return sock.sendMessage(chat, { text: `${from}${text}`, mentions: mention });
    }
    const mediaTypes = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio', documentMessage: 'document', stickerMessage: 'sticker' };
    const kind = mediaTypes[type];
    if (!kind) return sock.sendMessage(chat, { text: `${from}Unsupported message type: ${type}`, mentions: mention });
    const stream = await downloadContentFromMessage(body, kind);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    if (!buffer.length) return sock.sendMessage(chat, { text: `${from}The media is no longer available.`, mentions: mention });
    const caption = body.caption ? `${from}${body.caption}` : from.trim();
    if (kind === 'image') return sock.sendMessage(chat, { image: buffer, caption, mentions: mention });
    if (kind === 'video') return sock.sendMessage(chat, { video: buffer, caption, mentions: mention });
    if (kind === 'audio') return sock.sendMessage(chat, { audio: buffer, mimetype: body.mimetype || 'audio/ogg; codecs=opus', ptt: !!body.ptt });
    if (kind === 'sticker') return sock.sendMessage(chat, { sticker: buffer });
    return sock.sendMessage(chat, { document: buffer, fileName: body.fileName || 'quoted-file', mimetype: body.mimetype || 'application/octet-stream', caption, mentions: mention });
}

function unwrap(message) {
    for (const key of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'documentWithCaptionMessage']) {
        if (message?.[key]?.message) return unwrap(message[key].message);
    }
    return message?.message || message;
                                                              }

