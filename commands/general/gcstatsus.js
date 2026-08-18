/**
 * gcstatus — Post text, link, image, video, audio or document to the
 * group's WhatsApp Status feed (native groupStatusMessageV2).
 *
 * ✅ No admin required — works as a regular group member
 * ✅ Uses the official groupStatusMessageV2 API (Baileys), with a manual
 *    relay fallback if the high-level `groupStatus:true` shortcut fails
 * ✅ Broadcast to every group the bot is in, or target one specific group
 * ✅ Tracks every status it posts so they can all be pulled down at once
 *
 * Usage:
 *   .gcstatus Hello world!                  → text group status
 *   .gcstatus https://example.com           → link group status (with preview)
 *   .gcstatus Hello | 12036...@g.us         → post to one specific group
 *   .gcstatus Hello everyone | all          → broadcast to every group
 *   .gcstatus clear                         → delete every status this bot has posted (this group)
 *   Reply to a message + .gcstatus          → posts that message to group status
 *   Reply to a photo    + .gcstatus         → image group status
 *   Reply to a video    + .gcstatus         → video group status
 *   Reply to an audio   + .gcstatus         → voice-note group status
 *   Reply to a document + .gcstatus         → document group status
 *
 *   All media types accept an optional caption:
 *   Reply to photo + .gcstatus My caption
 */

const crypto = require('crypto');
const axios  = require('axios');
const fs     = require('fs-extra');
const path   = require('path');
const { spawn } = require('child_process');
// Loaded through lib/baileys.js's CJS↔ESM bridge — this IS @crysnovax/baileys
// (the package the whole project already depends on); requiring the package
// directly here would throw ERR_REQUIRE_ESM, same reason every other file
// that touches Baileys internals goes through this shim instead.
const {
    downloadContentFromMessage,
    generateWAMessageContent,
    generateWAMessageFromContent,
} = require('../../lib/baileys');

let ffmpegPath = null;
try { ffmpegPath = require('ffmpeg-static'); } catch { ffmpegPath = null; }

const TEXT_BG_COLOR = '#9C27B0';

// ── Status ID store — lets .gcstatus clear find what to delete later ──────
const ID_DB   = path.join(process.cwd(), 'database/gstatus-ids.json');
const loadIds = () => { try { return JSON.parse(fs.readFileSync(ID_DB, 'utf8')); } catch { return {}; } };
const saveId  = (jid, msgId) => {
    if (!msgId) return;
    fs.ensureDirSync(path.dirname(ID_DB));
    const db = loadIds();
    if (!db[jid]) db[jid] = [];
    db[jid].push(msgId);
    fs.writeFileSync(ID_DB, JSON.stringify(db, null, 2));
};
const clearIds = (jid) => {
    const db  = loadIds();
    const ids = db[jid] || [];
    delete db[jid];
    fs.ensureDirSync(path.dirname(ID_DB));
    fs.writeFileSync(ID_DB, JSON.stringify(db, null, 2));
    return ids;
};

// ── helpers ──────────────────────────────────────────────────────────────

async function downloadMedia(mediaMsg, type) {
    const stream = await downloadContentFromMessage(mediaMsg, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

/** MP3/AAC/etc → OGG/Opus, same ffmpeg-static pattern used by lib/ttsHelper.js. */
function encodeOpus(buffer) {
    return new Promise((resolve) => {
        if (!ffmpegPath) return resolve(buffer);
        const args = [
            '-hide_banner', '-loglevel', 'error',
            '-i', 'pipe:0',
            '-vn', '-c:a', 'libopus', '-b:a', '64k',
            '-ar', '48000', '-ac', '1', '-f', 'ogg', 'pipe:1',
        ];
        const ff = spawn(ffmpegPath, args);
        const chunks = [];
        ff.stdout.on('data', c => chunks.push(c));
        ff.on('error', () => resolve(buffer));
        ff.on('close', code => resolve(code === 0 && chunks.length ? Buffer.concat(chunks) : buffer));
        ff.stdin.on('error', () => {});
        ff.stdin.end(buffer);
    });
}

/** Best-effort OG title/description/image scrape for a nicer link status. Never throws. */
async function fetchLinkPreview(url) {
    const result = { title: null, description: null, imageBuffer: null };
    try {
        const res = await axios.get(url, {
            timeout: 10000,
            responseType: 'text',
            headers: { 'User-Agent': 'WhatsApp/2.23.20.0 A' },
            maxRedirects: 5,
        });
        const html = res.data || '';

        const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
                      || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
        if (ogTitle) result.title = ogTitle.trim().slice(0, 120);

        const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
                     || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1];
        if (ogDesc) result.description = ogDesc.trim().slice(0, 300);

        const imgUrl = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
        if (imgUrl) {
            const absImg = imgUrl.startsWith('http') ? imgUrl : new URL(imgUrl, url).href;
            try {
                const imgRes = await axios.get(absImg, {
                    timeout: 12000,
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'WhatsApp/2.23.20.0 A' },
                });
                if (imgRes.data?.length > 1000) result.imageBuffer = Buffer.from(imgRes.data);
            } catch {}
        }
    } catch {}
    return result;
}

async function getGroupParticipantJids(sock, groupJid) {
    try {
        const meta = await sock.groupMetadata(groupJid);
        return (meta?.participants || []).map(p => p.id).filter(Boolean);
    } catch {
        return [];
    }
}

/** Posts `content` to groupJid's status feed. Tries the high-level shortcut
 *  first, falls back to a manual groupStatusMessageV2 relay if unsupported.
 *  Returns the sent message (so callers can track its id for .gcstatus clear). */
async function postGroupStatus(sock, groupJid, content) {
    try {
        const { backgroundColor, previewTitle, previewDescription, previewImage, ...rest } = content;
        const isTextPost = typeof rest.text === 'string' && rest.text.length > 0;
        const hasMedia   = !!(rest.image || rest.video || rest.audio || rest.document);
        const payload = { ...rest, groupStatus: true };
        if (isTextPost && !hasMedia) {
            payload.richPreview = true;
            if (previewTitle)       payload.previewTitle       = previewTitle;
            if (previewDescription) payload.previewDescription = previewDescription;
            if (previewImage)       payload.previewImage       = previewImage;
        }
        if (backgroundColor && payload.text) payload.backgroundColor = backgroundColor;
        return await sock.sendMessage(groupJid, payload);
    } catch (e) {
        console.error('[gcstatus] groupStatus:true path failed, falling back to relay:', e.message);
    }

    const { backgroundColor } = content;
    const payload = { ...content };
    delete payload.backgroundColor;

    const inner = await generateWAMessageContent(payload, {
        upload: sock.waUploadToServer,
        backgroundColor: backgroundColor || TEXT_BG_COLOR,
    });

    const secret = crypto.randomBytes(32);
    const msg = generateWAMessageFromContent(
        groupJid,
        {
            messageContextInfo: { messageSecret: secret },
            groupStatusMessageV2: { message: { ...inner, messageContextInfo: { messageSecret: secret } } },
        },
        {}
    );

    const statusJidList = await getGroupParticipantJids(sock, groupJid);
    await sock.relayMessage(groupJid, msg.message, {
        messageId: msg.key.id,
        statusJidList,
        additionalAttributes: { messageId: msg.key.id },
    });
    return msg;
}

/** Same manual relay path as postGroupStatus's fallback, used directly for
 *  broadcasts since we need the raw message object to reuse across many
 *  groups without re-uploading media each time. */
async function relayTextStatus(sock, groupJid, text, preview) {
    const payload = { text };
    if (preview) {
        payload.richPreview = true;
        if (preview.title)       payload.previewTitle       = preview.title;
        if (preview.description) payload.previewDescription = preview.description;
        if (preview.imageBuffer) payload.previewImage       = preview.imageBuffer;
    }
    return postGroupStatus(sock, groupJid, payload);
}

/** Resolve the quoted message the same way CODEX's own sticker.js does,
 *  including unwrapping view-once wrappers. */
function getQuoted(m) {
    const ctx = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo;
    let quoted = ctx?.quotedMessage;
    if (!quoted) return null;
    for (const vt of ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']) {
        if (quoted[vt]) { quoted = quoted[vt]?.message || quoted[vt]; break; }
    }
    return quoted;
}

/** Deletes every tracked status for one group. Uses sock.deleteGroupStatus
 *  if this Baileys build has it, otherwise falls back to a normal message
 *  delete — both are tried per-id so one missing API doesn't sink the rest. */
async function deleteTrackedStatuses(sock, groupJid) {
    const ids = clearIds(groupJid);
    if (!ids.length) return { deleted: 0, failed: 0, hadAny: false };

    let deleted = 0, failed = 0;
    for (const msgId of ids) {
        try {
            if (typeof sock.deleteGroupStatus === 'function') {
                await sock.deleteGroupStatus(groupJid, { remoteJid: groupJid, fromMe: true, id: msgId });
            } else {
                await sock.sendMessage(groupJid, { delete: { remoteJid: groupJid, fromMe: true, id: msgId } });
            }
            deleted++;
        } catch { failed++; }
        await new Promise(r => setTimeout(r, 300));
    }
    return { deleted, failed, hadAny: true };
}

// ── command ──────────────────────────────────────────────────────────────

module.exports = {
    name: 'gcstatus',
    aliases: ['groupstatus', 'gstatus', 'poststatus'],
    category: 'general',
    reactions: { start: '🔎', success: '📌' },
    description: "Post text, link, image, video, audio or document to the group's status feed. Supports broadcasting to all groups and clearing tracked statuses.",
    groupOnly: true,

    async execute(bot, m, args) {
        const sock    = bot.sock;
        const from    = m.chat;
        const caption = args.join(' ').trim();
        const quoted  = getQuoted(m);

        // ── CLEAR — delete every status this bot has posted to this group ──
        if (caption.toLowerCase() === 'clear') {
            const { deleted, failed, hadAny } = await deleteTrackedStatuses(sock, from);
            if (!hadAny) return m.reply('No tracked statuses to delete for this group.');
            return m.reply(`🧹 Cleared ${deleted} status(es)${failed ? `, ${failed} failed` : ''}.`);
        }

        // ── BROADCAST / TARGET — "<text> | all" or "<text> | <groupJid>" ───
        // Works off typed text or a quoted message's own text, matching how
        // the rest of this command already treats those two sources.
        if (caption.includes('|')) {
            const [left, right] = caption.split('|').map(v => v.trim());
            const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
            const messageText = left || quotedText;

            if (right && right.toLowerCase() === 'all') {
                if (!messageText) return m.reply('❌ Please provide a message to broadcast.');

                let groupIds;
                try {
                    const groups = await sock.groupFetchAllParticipating();
                    groupIds = Object.keys(groups);
                } catch (err) {
                    return m.reply(`❌ Couldn't list groups: ${err.message}`);
                }
                if (!groupIds.length) return m.reply('❌ Bot is not in any groups.');

                await m.reply(`⏳ Broadcasting to ${groupIds.length} groups...`);

                const isUrl   = /https?:\/\//i.test(messageText);
                const preview = isUrl ? await fetchLinkPreview(messageText) : null;

                let success = 0, failed = 0;
                for (const groupId of groupIds) {
                    try {
                        const res = await relayTextStatus(sock, groupId, messageText, preview);
                        saveId(groupId, res?.key?.id);
                        success++;
                    } catch { failed++; }
                    await new Promise(r => setTimeout(r, 500));
                }
                return m.reply(`✅ Broadcast done.\nSuccess: ${success}\nFailed: ${failed}`);
            }

            if (right && right.endsWith('@g.us')) {
                if (!messageText) return m.reply('❌ Please provide a message to post.');
                try {
                    await sock.groupMetadata(right);
                } catch {
                    return m.reply('❌ Bot is not in that group.');
                }
                try {
                    const isUrl   = /https?:\/\//i.test(messageText);
                    const preview = isUrl ? await fetchLinkPreview(messageText) : null;
                    const res     = await relayTextStatus(sock, right, messageText, preview);
                    saveId(right, res?.key?.id);
                    return m.reply(`✅ Posted to that group's status!\n${isUrl ? '🔗 Type: Link' : '💬 Type: Text'}`);
                } catch (err) {
                    return m.reply(`❌ Failed to post: ${err.message}`);
                }
            }
            // Falls through to normal handling below if the right side
            // wasn't "all" or a valid group JID (e.g. text just contained
            // a literal "|" character).
        }

        // ── IMAGE (or sticker treated as image) ──────────────────────────
        const imgMsg = quoted?.imageMessage || quoted?.stickerMessage;
        if (imgMsg) {
            await m.reply('⏳ Posting image to group status…');
            try {
                const type = quoted.imageMessage ? 'image' : 'sticker';
                const buf  = await downloadMedia(imgMsg, type);
                const res  = await postGroupStatus(sock, from, { image: buf, caption: caption || '' });
                saveId(from, res?.key?.id);
                return m.reply(`✅ Posted to group status!\n📸 Type: Image${caption ? `\n💬 Caption: ${caption}` : ''}`);
            } catch (err) {
                return m.reply(`❌ Failed to post image: ${err.message}`);
            }
        }

        // ── VIDEO ──────────────────────────────────────────────────────────
        if (quoted?.videoMessage) {
            await m.reply('⏳ Posting video to group status…');
            try {
                const buf = await downloadMedia(quoted.videoMessage, 'video');
                const res = await postGroupStatus(sock, from, { video: buf, caption: caption || '' });
                saveId(from, res?.key?.id);
                return m.reply(`✅ Posted to group status!\n🎥 Type: Video${caption ? `\n💬 Caption: ${caption}` : ''}`);
            } catch (err) {
                return m.reply(`❌ Failed to post video: ${err.message}`);
            }
        }

        // ── AUDIO ───────────────���──────────────────────────────────────────
        if (quoted?.audioMessage) {
            await m.reply('⏳ Posting audio to group status…');
            try {
                const raw = await downloadMedia(quoted.audioMessage, 'audio');
                const buf = await encodeOpus(raw);
                const res = await postGroupStatus(sock, from, { audio: buf, mimetype: 'audio/ogg; codecs=opus', ptt: true });
                saveId(from, res?.key?.id);
                return m.reply('✅ Posted to group status!\n🎵 Type: Audio');
            } catch (err) {
                return m.reply(`❌ Failed to post audio: ${err.message}`);
            }
        }

        // ── DOCUMENT ─────────────────────────────────────────────────────
        if (quoted?.documentMessage) {
            await m.reply('⏳ Posting document to group status…');
            try {
                const doc = quoted.documentMessage;
                const buf = await downloadMedia(doc, 'document');
                const res = await postGroupStatus(sock, from, {
                    document: buf,
                    mimetype: doc.mimetype || 'application/octet-stream',
                    fileName: doc.fileName || 'document',
                    caption: caption || '',
                });
                saveId(from, res?.key?.id);
                return m.reply(`✅ Posted to group status!\n📄 Type: Document${caption ? `\n💬 Caption: ${caption}` : ''}`);
            } catch (err) {
                return m.reply(`❌ Failed to post document: ${err.message}`);
            }
        }

        // ── QUOTED TEXT MESSAGE → post that text to group status ──────────
        const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
        if (quoted && quotedText) {
            await m.reply('⏳ Posting quoted message to group status…');
            try {
                const isUrl = /https?:\/\//i.test(quotedText);
                const res = await postGroupStatus(sock, from, {
                    text: quotedText,
                    backgroundColor: isUrl ? undefined : TEXT_BG_COLOR,
                });
                saveId(from, res?.key?.id);
                return m.reply(
                    `✅ Posted to group status!\n${isUrl ? '🔗 Type: Link' : '💬 Type: Text'}\n` +
                    `📝 "${quotedText.slice(0, 60)}${quotedText.length > 60 ? '…' : ''}"`
                );
            } catch (err) {
                return m.reply(`❌ Failed to post: ${err.message}`);
            }
        }

        // ── TEXT / LINK typed directly after .gcstatus ─────────────────────
        if (!caption) {
            return m.reply(
`📊 GCStatus — Post to Group Status

Usage:
${bot.prefix}gcstatus Hello world!            — text status
${bot.prefix}gcstatus https://link.com        — link/preview status
${bot.prefix}gcstatus Hello | 12036...@g.us   — post to one specific group
${bot.prefix}gcstatus Hello everyone | all    — broadcast to every group
${bot.prefix}gcstatus clear                   — delete every status posted here
Reply to 📷 photo    + ${bot.prefix}gcstatus [caption]
Reply to 🎥 video    + ${bot.prefix}gcstatus [caption]
Reply to 🎵 audio    + ${bot.prefix}gcstatus
Reply to 📄 document + ${bot.prefix}gcstatus [caption]
Reply to 💬 any message + ${bot.prefix}gcstatus

No admin role needed.`
            );
        }

        await m.reply('⏳ Posting to group status…');
        try {
            const isUrl = /https?:\/\//i.test(caption);
            let res;
            if (isUrl) {
                const preview = await fetchLinkPreview(caption);
                res = await postGroupStatus(sock, from, {
                    text: caption,
                    richPreview: true,
                    ...(preview.title       ? { previewTitle: preview.title }             : {}),
                    ...(preview.description ? { previewDescription: preview.description } : {}),
                    ...(preview.imageBuffer ? { previewImage: preview.imageBuffer }        : {}),
                });
            } else {
                res = await postGroupStatus(sock, from, { text: caption, backgroundColor: TEXT_BG_COLOR });
            }
            saveId(from, res?.key?.id);
            return m.reply(
                `✅ Posted to group status!\n${isUrl ? '🔗 Type: Link' : '💬 Type: Text'}\n` +
                `📝 "${caption.slice(0, 60)}${caption.length > 60 ? '…' : ''}"`
            );
        } catch (err) {
            return m.reply(`❌ Failed to post: ${err.message}`);
        }
    },
};
        
