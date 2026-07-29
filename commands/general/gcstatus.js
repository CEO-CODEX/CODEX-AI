/**
 * gcstatus — Post text, link, image, video or audio to the group's
 * WhatsApp Status feed (native groupStatusMessageV2), matching the
 * SUKUNA_MD reference implementation, adapted to CODEX-AI's own
 * conventions (m.reply / bot.sock / ffmpeg-static).
 *
 * ✅ No admin required — works as a regular group member
 * ✅ Uses the official groupStatusMessageV2 API (Baileys), with a manual
 *    relay fallback if the high-level `groupStatus:true` shortcut fails
 *
 * Usage:
 *   .gcstatus Hello world!            → text group status
 *   .gcstatus https://example.com     → link group status (with preview)
 *   Reply to a message + .gcstatus    → posts that message to group status
 *   Reply to a photo  + .gcstatus     → image group status
 *   Reply to a video  + .gcstatus     → video group status
 *   Reply to an audio + .gcstatus     → voice-note group status
 *
 *   All media types accept an optional caption:
 *   Reply to photo + .gcstatus My caption
 */

const crypto = require('crypto');
const axios  = require('axios');
const { spawn } = require('child_process');
const {
    downloadContentFromMessage,
    getContentType,
    generateWAMessageContent,
    generateWAMessageFromContent,
} = require('../../lib/baileys');

let ffmpegPath = null;
try { ffmpegPath = require('ffmpeg-static'); } catch { ffmpegPath = null; }

const TEXT_BG_COLOR = '#9C27B0';

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
 *  first, falls back to a manual groupStatusMessageV2 relay if unsupported. */
async function postGroupStatus(sock, groupJid, content) {
    try {
        const { backgroundColor, previewTitle, previewDescription, previewImage, ...rest } = content;
        const isTextPost = typeof rest.text === 'string' && rest.text.length > 0;
        const hasMedia   = !!(rest.image || rest.video || rest.audio);
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

// ── command ──────────────────────────────────────────────────────────────

module.exports = {
    name: 'gcstatus',
    aliases: ['groupstatus', 'gstatus', 'poststatus'],
    category: 'general',
    description: "Post text, link, image, video or audio to the group's status feed",
    groupOnly: true,

    async execute(bot, m, args) {
        const sock    = bot.sock;
        const from    = m.chat;
        const caption = args.join(' ').trim();
        const quoted  = getQuoted(m);

        // ── IMAGE (or sticker treated as image) ──────────────────────────
        const imgMsg = quoted?.imageMessage || quoted?.stickerMessage;
        if (imgMsg) {
            await m.reply('⏳ Posting image to group status…');
            try {
                const type = quoted.imageMessage ? 'image' : 'sticker';
                const buf  = await downloadMedia(imgMsg, type);
                await postGroupStatus(sock, from, { image: buf, caption: caption || '' });
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
                await postGroupStatus(sock, from, { video: buf, caption: caption || '' });
                return m.reply(`✅ Posted to group status!\n🎥 Type: Video${caption ? `\n💬 Caption: ${caption}` : ''}`);
            } catch (err) {
                return m.reply(`❌ Failed to post video: ${err.message}`);
            }
        }

        // ── AUDIO ──────────────────────────────────────────────────────────
        if (quoted?.audioMessage) {
            await m.reply('⏳ Posting audio to group status…');
            try {
                const raw = await downloadMedia(quoted.audioMessage, 'audio');
                const buf = await encodeOpus(raw);
                await postGroupStatus(sock, from, { audio: buf, mimetype: 'audio/ogg; codecs=opus', ptt: true });
                return m.reply('✅ Posted to group status!\n🎵 Type: Audio');
            } catch (err) {
                return m.reply(`❌ Failed to post audio: ${err.message}`);
            }
        }

        // ── QUOTED TEXT MESSAGE → post that text to group status ──────────
        const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
        if (quoted && quotedText) {
            await m.reply('⏳ Posting quoted message to group status…');
            try {
                const isUrl = /https?:\/\//i.test(quotedText);
                await postGroupStatus(sock, from, {
                    text: quotedText,
                    backgroundColor: isUrl ? undefined : TEXT_BG_COLOR,
                });
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
Reply to 📷 photo + ${bot.prefix}gcstatus [caption]
Reply to 🎥 video + ${bot.prefix}gcstatus [caption]
Reply to 🎵 audio + ${bot.prefix}gcstatus
Reply to 💬 any message + ${bot.prefix}gcstatus

No admin role needed.`
            );
        }

        await m.reply('⏳ Posting to group status…');
        try {
            const isUrl = /https?:\/\//i.test(caption);
            if (isUrl) {
                const preview = await fetchLinkPreview(caption);
                await postGroupStatus(sock, from, {
                    text: caption,
                    richPreview: true,
                    ...(preview.title       ? { previewTitle: preview.title }             : {}),
                    ...(preview.description ? { previewDescription: preview.description } : {}),
                    ...(preview.imageBuffer ? { previewImage: preview.imageBuffer }        : {}),
                });
            } else {
                await postGroupStatus(sock, from, { text: caption, backgroundColor: TEXT_BG_COLOR });
            }
            return m.reply(
                `✅ Posted to group status!\n${isUrl ? '🔗 Type: Link' : '💬 Type: Text'}\n` +
                `📝 "${caption.slice(0, 60)}${caption.length > 60 ? '…' : ''}"`
            );
        } catch (err) {
            return m.reply(`❌ Failed to post: ${err.message}`);
        }
    },
};
