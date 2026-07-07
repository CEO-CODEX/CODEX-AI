const { getContentType, downloadContentFromMessage } = require('../../lib/baileys');

// ── QUOTED MODE ───────────────────────────────────────────────────────────────
// Set via: .setvar QUOTED_MODE=1  or  .setvar QUOTED_MODE=2  or  .setvar QUOTED_MODE=3
//
// Mode 1 — DIRECT
//   You reply to message B → bot returns message B itself (the exact message you replied to)
//
// Mode 2 — DEEP (default)
//   You reply to message B → bot returns the ORIGINAL message that B was replying to (A)
//   If B was not a reply, falls back to returning B itself
//
// Mode 3 — BOTH
//   You reply to message B → bot returns BOTH:
//   first the original message A (what B was replying to), then B itself
//   If B was not a reply, just returns B

module.exports = {
    name: 'quoted',
    aliases: ['q', 'getquoted', 'quote'],
    category: 'general',
    description: 'Forward quoted messages. Mode: setvar QUOTED_MODE=1/2/3',

    async execute(bot, m, args) {
        const mode = parseInt(bot.config.QUOTED_MODE) || 2;

        const ctx       = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = ctx?.quotedMessage; // message B (the one you replied to)

        if (!quotedMsg) {
            return await m.reply(
`QUOTED MESSAGE VIEWER

Reply to any message with ${bot.prefix}quoted to retrieve it.

Current mode: ${mode}

Modes (set with ${bot.prefix}setvar QUOTED_MODE=<1/2/3>):
  1 - DIRECT  : Returns the exact message you replied to
  2 - DEEP    : Returns the original inside that reply (nested)
  3 - BOTH    : Returns both the nested original AND the reply itself`
            );
        }

        try {
            const quotedType  = getContentType(quotedMsg);
            const quotedInner = quotedMsg[quotedType];
            const deepCtx     = quotedInner?.contextInfo;

            const senderB     = ctx?.participant || ctx?.remoteJid || 'Unknown';

            if (mode === 1) {
                // ── Mode 1: just return message B ─────────────────────────────
                return await _forward(bot, m, quotedMsg, senderB);
            }

            if (mode === 2) {
                // ── Mode 2: return A (what B was replying to) ─────────────────
                if (deepCtx?.quotedMessage) {
                    const senderA = deepCtx.participant || deepCtx.remoteJid || senderB;
                    return await _forward(bot, m, deepCtx.quotedMessage, senderA);
                }
                // B was not a reply — fall back to B itself
                return await _forward(bot, m, quotedMsg, senderB);
            }

            if (mode === 3) {
                // ── Mode 3: return A first, then B ────────────────────────────
                if (deepCtx?.quotedMessage) {
                    const senderA = deepCtx.participant || deepCtx.remoteJid || senderB;
                    await bot.sendMessage(m.chat, { text: `── Original (A) ──` });
                    await _forward(bot, m, deepCtx.quotedMessage, senderA);
                    await bot.sendMessage(m.chat, { text: `── Reply (B) ──` });
                    return await _forward(bot, m, quotedMsg, senderB);
                }
                // B was not a reply — just return B
                return await _forward(bot, m, quotedMsg, senderB);
            }

            // Unknown mode fallback
            await m.reply(`Unknown mode ${mode}. Use ${bot.prefix}setvar QUOTED_MODE=1, 2, or 3`);

        } catch (err) {
            console.error('quoted error:', err);
            await m.reply('Failed: ' + err.message);
        }
    }
};

async function _forward(bot, m, msgObj, senderJid) {
    const senderNum = (senderJid || 'Unknown').split('@')[0];

    // Unwrap view-once
    let realObj = msgObj;
    for (const vt of ['viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension']) {
        if (msgObj[vt]) { realObj = msgObj[vt]?.message || msgObj[vt]; break; }
    }

    const type  = getContentType(realObj);
    const inner = realObj?.[type];

    if (!type || !inner) {
        return await bot.sendMessage(m.chat, {
            text: `From @${senderNum}\n\n(Could not read message content)`,
            mentions: [senderJid]
        });
    }

    // Plain text
    if (type === 'conversation' || type === 'extendedTextMessage') {
        const text = (typeof inner === 'string') ? inner : (inner?.text || inner?.conversation || '(empty)');
        return await bot.sendMessage(m.chat, {
            text: `From @${senderNum}:\n\n${text}`,
            mentions: [senderJid]
        });
    }

    const mimetype = inner?.mimetype || '';
    const caption  = inner?.caption  || '';
    const label    = `From @${senderNum}${caption ? `\n${caption}` : ''}`;

    const isImage   = type === 'imageMessage';
    const isVideo   = type === 'videoMessage';
    const isAudio   = type === 'audioMessage';
    const isDoc     = type === 'documentMessage';
    const isSticker = type === 'stickerMessage';

    if (isImage || isVideo || isAudio || isDoc || isSticker) {
        const cat    = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : isSticker ? 'sticker' : 'document';
        const stream = await downloadContentFromMessage(inner, cat);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        if (!buffer.length) {
            return await bot.sendMessage(m.chat, {
                text: `From @${senderNum}\n(Media expired — cannot retrieve)`,
                mentions: [senderJid]
            });
        }

        if (isImage)   return await bot.sendMessage(m.chat, { image: buffer, caption: label, mentions: [senderJid] });
        if (isVideo)   return await bot.sendMessage(m.chat, { video: buffer, caption: label, mentions: [senderJid] });
        if (isSticker) return await bot.sendMessage(m.chat, { sticker: buffer });
        if (isAudio) {
            await bot.sendMessage(m.chat, { text: label, mentions: [senderJid] });
            return await bot.sendMessage(m.chat, {
                audio:    buffer,
                mimetype: mimetype || 'audio/ogg; codecs=opus',
                ptt:      inner?.ptt !== undefined ? inner.ptt : true
            });
        }
        if (isDoc) return await bot.sendMessage(m.chat, {
            document: buffer,
            mimetype: mimetype || 'application/octet-stream',
            fileName: inner?.fileName || 'file',
            caption:  label,
            mentions: [senderJid]
        });
    }

    await bot.sendMessage(m.chat, {
        text: `From @${senderNum}\nType: ${type}\n(Cannot retrieve this media type)`,
        mentions: [senderJid]
    });
}
