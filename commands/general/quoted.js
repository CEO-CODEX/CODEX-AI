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
        const quoted = ctx.quotedMessage;
        if (!quoted) return reply('Reply to a message to extract it.');
        const key = { remoteJid: ctx.remoteJid || m.chat, id: ctx.stanzaId || `quoted-${Date.now()}`, participant: ctx.participant };
        store.saveMessage(key, { key, message: quoted, pushName: ctx.pushName || '' });
        return forward(sock, m.chat, quoted, ctx.participant, m);
    }
};

async function forward(sock, chat, message, sender, m) {
    const unwrapped = unwrap(message);
    const type = getContentType(unwrapped);
    const body = unwrapped?.[type];
    const mention = sender ? [sender] : [];
    const from = sender ? `From @${sender.split('@')[0]}\n` : '';
    if (!type || body == null) return sock.sendMessage(chat, { text: `${from}Unable to read the quoted message.`, mentions: mention });
    if (type === 'conversation' || type === 'extendedTextMessage') {
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
