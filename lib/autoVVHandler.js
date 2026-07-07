/**
 * C☯︎DEX-AI V3.0 — Auto VV Handler
 * Detects view-once in every raw message (before Baileys marks it as viewed)
 * Antilink-style: intercepts at the messages.upsert level
 */

const { downloadContentFromMessage, getContentType } = require('./baileys');
const fs   = require('fs');
const path = require('path');

const DB   = path.join(process.cwd(), 'database', 'autovv.json');
const load = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return { mode: 'off' }; } };

// VV reaction triggers
const VV_REACTIONS_DB = path.join(process.cwd(), 'database', 'vv-reactions.json');
let   vvTriggers = {};
try { if (fs.existsSync(VV_REACTIONS_DB)) vvTriggers = JSON.parse(fs.readFileSync(VV_REACTIONS_DB, 'utf8')); } catch {}
const saveTriggers = () => fs.writeFileSync(VV_REACTIONS_DB, JSON.stringify(vvTriggers, null, 2));

const toNum = (j) => String(j || '').replace(/@.*/, '').replace(/:.*/, '').replace(/[^0-9]/g, '');

async function downloadVO(content, type) {
    const stream = await downloadContentFromMessage(content[type], type.replace('Message', '').toLowerCase());
    let buf = Buffer.alloc(0);
    for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
    return buf;
}

// ── Unwrap any viewOnce variant ───────────────────────────────────────────────
function extractViewOnce(raw) {
    if (!raw) return null;
    if (raw.viewOnceMessage?.message)            return raw.viewOnceMessage.message;
    if (raw.viewOnceMessageV2?.message)          return raw.viewOnceMessageV2.message;
    if (raw.viewOnceMessageV2Extension?.message) return raw.viewOnceMessageV2Extension.message;
    if (raw.ephemeralMessage?.message) {
        const ep = raw.ephemeralMessage.message;
        if (ep.viewOnceMessage?.message)   return ep.viewOnceMessage.message;
        if (ep.viewOnceMessageV2?.message) return ep.viewOnceMessageV2.message;
    }
    return null;
}

// Load config once at module level
const cfg = require('../config.json');

// ── Main auto-VV handler — called per raw message ─────────────────────────────
async function handleAutoVV(sock, msg) {
    try {
        if (!msg?.message || msg.key?.fromMe) return;

        const db   = load();
        const mode = db.mode || 'off';
        if (mode === 'off') return;

        const voInner = extractViewOnce(msg.message);
        if (!voInner) return;

        const mediaType = getContentType(voInner);
        if (!['imageMessage','videoMessage','audioMessage','stickerMessage'].includes(mediaType)) return;

        const jid    = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const tag    = sender.split('@')[0].replace(/[^0-9]/g, '');

        const buf  = await downloadVO(voInner, mediaType);
        const st   = { imageMessage:'image', videoMessage:'video', audioMessage:'audio', stickerMessage:'sticker' }[mediaType];
        const caption = 'x Auto View Once\nx From: @' + tag + '\nx Chat: ' + (jid.endsWith('@g.us') ? 'Group' : 'DM');

        const ownerJid = String((typeof cfg.owner === 'object' ? cfg.owner.number : cfg.owner) || '').replace(/[^0-9]/g, '') + '@s.whatsapp.net';

        if (mode === 'vv') {
            await sock.sendMessage(jid, { [st]: buf, caption, mentions: [sender] });
        } else if (mode === 'vvp') {
            await sock.sendMessage(ownerJid, { [st]: buf, caption });
        }
    } catch (err) {
        console.log('[AutoVV]', err.message);
    }
}

// ── VV reaction listener — attach once on connection open ─────────────────────
let reactionListenerAttached = false;
function attachVVReactionListener(sock) {
    if (reactionListenerAttached) return;
    reactionListenerAttached = true;

    sock.ev.on('messages.reaction', async (updates) => {
        try {
            const update     = updates[0];
            const reactEmoji = update.reaction?.text;
            const reactor    = update.reaction?.senderId || update.reaction?.participant;
            if (!reactEmoji || !reactor) return;

            const reactorNum = toNum(reactor);
            const entry      = Object.entries(vvTriggers).find(([k]) => toNum(k) === reactorNum);
            if (!entry || reactEmoji !== entry[1]) return;

            const msg = await sock.loadMessage(update.key.remoteJid, update.key.id).catch(() => null);
            if (!msg?.message) return;

            const voInner = extractViewOnce(msg.message) || msg.message;
            const t       = getContentType(voInner);
            if (!['imageMessage','videoMessage','audioMessage','stickerMessage'].includes(t)) return;

            const buf = await downloadVO(voInner, t);
            const st  = { imageMessage:'image', videoMessage:'video', audioMessage:'audio', stickerMessage:'sticker' }[t];
            const dm  = toNum(reactor) + '@s.whatsapp.net';

            await sock.sendMessage(dm, {
                [st]: buf,
                caption: 'x View Once — Reaction Triggered\nx Sign: ' + reactEmoji,
            });
        } catch (err) { console.log('[VV Reaction]', err.message); }
    });
}

// ── DND handler — AFK-style, groups + DMs ────────────────────────────────────
async function handleDND(sock, msgOrM, m) {
    // Accept both (sock, rawMsg, smsgResult) and (sock, smsgResult)
    if (!m) m = msgOrM;
    try {
        if (m.key?.fromMe) return;
        const mentions = m.mentionedJid || [];
        if (!mentions.length) return;

        const cfg      = require('../config.json');
        const ownerNum = String((typeof cfg.owner === 'object' ? cfg.owner.number : cfg.owner) || '').replace(/[^0-9]/g, '');

        let db = {};
        try { db = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'database', 'dnd.json'), 'utf8')); } catch {}
        const entry = db[ownerNum];
        if (!entry?.enabled) return;

        const ownerTagged = mentions.some(jid => toNum(jid) === ownerNum);
        if (!ownerTagged) return;
        if (toNum(m.sender || '') === ownerNum) return;

        // Delete the tag message
        try { await sock.sendMessage(m.chat, { delete: m.key }); } catch {}

        // Reply with DND message
        const msg = entry.message || 'x I am in DND mode. Do not tag me.';
        await sock.sendMessage(m.chat, {
            text: 'x *DND*\n\n@' + (m.sender || '').split('@')[0] + ', ' + msg,
            mentions: [m.sender],
        });
    } catch (err) { console.log('[DND]', err.message); }
}

// ── Bot tag reply — AFK-style, checks raw @lid mentions ──────────────────────
async function handleBotTagReply(sock, msg, m) {
    try {
        if (msg.key?.fromMe) return;

        let db = {};
        try { db = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'database', 'bottagreply.json'), 'utf8')); } catch {}
        if (db.enabled === false) return;

        // Collect all mention JIDs from every layer
        const rawMsg = msg.message || {};
        const allMentions = [
            ...(m.mentionedJid || []),
            ...(rawMsg.extendedTextMessage?.contextInfo?.mentionedJid || []),
            ...(rawMsg.imageMessage?.contextInfo?.mentionedJid || []),
            ...(rawMsg.videoMessage?.contextInfo?.mentionedJid || []),
        ];

        const botJid = sock.user?.id || '';
        const botNum = toNum(botJid);
        const botLid = sock.user?.lid ? sock.user.lid.split('@')[0] : '';

        const botTagged = allMentions.some(jid => {
            if (!jid) return false;
            const n   = toNum(jid);
            const lid = jid.split('@')[0];
            return n === botNum || lid === botLid || jid.replace(/:[0-9]+@/, '@') === botJid.replace(/:[0-9]+@/, '@');
        });

        if (!botTagged) return;

        const cfg     = require('../config.json');
        const botName = cfg.settings?.botName || 'C☯︎DEX-AI V3.0';
        const prefix  = cfg.settings?.prefix  || '.';
        const sender  = m.sender || msg.key?.participant || msg.key?.remoteJid || '';

        const replyText = (db.message || ('x Hey {user}!\nx I am *' + botName + '*.\nx Prefix: ' + prefix + '\nx Commands: ' + prefix + 'menu'))
            .replace('{user}',    '@' + sender.split('@')[0])
            .replace('{prefix}',  prefix)
            .replace('{botname}', botName);

        await sock.sendMessage(m.chat, {
            text: replyText,
            mentions: [sender],
        }).catch(() => {});
    } catch (err) { console.log('[BotTagReply]', err.message); }
}

// ── Auto-reply handler ────────────────────────────────────────────────────────
async function handleAutoReply(sock, m) {
    try {
        if (m.key?.fromMe) return;
        const text = (m.text || m.body || '').trim().toLowerCase();
        if (!text) return;

        let db = {};
        try { db = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'database', 'autoreply.json'), 'utf8')); } catch { return; }

        for (const [trigger, entry] of Object.entries(db)) {
            const match = entry.exact
                ? text === trigger.toLowerCase()
                : text.includes(trigger.toLowerCase());
            if (match) {
                await sock.sendMessage(m.chat, { text: entry.response }, { quoted: m }).catch(() => {});
                return;
            }
        }
    } catch (err) { console.log('[AutoReply]', err.message); }
}

module.exports = {
    handleAutoVV,
    attachVVReactionListener,
    handleDND,
    handleBotTagReply,
    handleAutoReply,
    vvTriggers,
    saveTriggers,
};
