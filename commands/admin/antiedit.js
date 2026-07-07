const fs = require('fs');
const path = require('path');

const DB = path.join(__dirname, '../../database/antiedit.json');

if (!fs.existsSync(DB)) {
    fs.writeFileSync(DB, JSON.stringify({ chats: {}, _globalPriv: false, _mode: 'dm' }, null, 2));
}

const getDB = () => JSON.parse(fs.readFileSync(DB));
const saveDB = (data) => fs.writeFileSync(DB, JSON.stringify(data, null, 2));

const originalCache = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of originalCache.entries()) {
        if (now - entry.timestamp > 600000) originalCache.delete(key);
    }
}, 300000);

function getTime(timestamp) {
    const d = new Date(timestamp * 1000);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${mins}`;
}

function getDisplayName(entry, senderJid) {
    if (entry?.pushName) return entry.pushName;
    return senderJid.split('@')[0];
}

function getMessageContent(msgObj) {
    if (!msgObj) return '[Empty message]';

    const layers = ['protocolMessage', 'ephemeralMessage', 'message', 'viewOnceMessage', 'templateMessage', 'editedMessage'];
    for (const layer of layers) {
        if (msgObj[layer]) {
            return getMessageContent(msgObj[layer]);
        }
    }

    if (msgObj.conversation) return msgObj.conversation;
    if (msgObj.extendedTextMessage?.text) return msgObj.extendedTextMessage.text;

    if (msgObj.imageMessage) {
        return msgObj.imageMessage.caption ? `[Image] ${msgObj.imageMessage.caption}` : '[Image]';
    }
    if (msgObj.videoMessage) {
        return msgObj.videoMessage.caption ? `[Video] ${msgObj.videoMessage.caption}` : '[Video]';
    }
    if (msgObj.documentMessage) return `[Document] ${msgObj.documentMessage.fileName || 'file'}`;
    if (msgObj.audioMessage) return '[Voice message]';
    if (msgObj.stickerMessage) return '[Sticker]';
    if (msgObj.locationMessage) return '[Location]';
    if (msgObj.contactMessage) return `[Contact] ${msgObj.contactMessage.displayName || 'contact'}`;

    if (msgObj.buttonsResponseMessage?.selectedDisplayText) return msgObj.buttonsResponseMessage.selectedDisplayText;
    if (msgObj.listResponseMessage?.title) return msgObj.listResponseMessage.title;

    try {
        const str = JSON.stringify(msgObj);
        const match = str.match(/"text":"(.*?)"/);
        if (match) return match[1];
    } catch {}

    return '[Unsupported message]';
}

function cacheOriginal(key, msgObj) {
    if (!originalCache.has(key)) {
        originalCache.set(key, {
            text: getMessageContent(msgObj),
            pushName: msgObj?.pushName || null,
            timestamp: Date.now()
        });
    }
}

module.exports = {
    name: 'antiedit',
    alias: ['editledetect', 'editedetect'],
    category: 'tools',
    desc: 'Detect message edits and send old + new content',

    execute: async (sock, m, { args, reply }) => {
        const db = getDB();
        const chat = m.chat;
        const sub = args[0]?.toLowerCase();
        const sub2 = args[1]?.toLowerCase();

        if (!sub) {
            const status = db.chats[chat] ? 'ON' : 'OFF';
            const globalPriv = db._globalPriv ? 'ON' : 'OFF';
            const mode = db._mode || 'dm';
            return reply(
                `╭─❍ *ANTI-EDIT* 𓉤\n` +
                `│ Status     : *${status}*\n` +
                `│ Global DMs : *${globalPriv}*\n` +
                `│ Send to    : *${mode.toUpperCase()}*\n` +
                `│\n` +
                `│ Commands:\n` +
                `│ .antiedit on\n` +
                `│ .antiedit off\n` +
                `│ .antiedit on all\n` +
                `│ .antiedit off all\n` +
                `│ .antiedit mode dm\n` +
                `│ .antiedit mode chat\n` +
                `╰────────────────`
            );
        }

        if (sub === 'on' && !sub2) {
            db.chats[chat] = true;
            saveDB(db);
            return reply('`—͟͟͞͞𖣘 ANTI-EDIT ENABLED for this chat`');
        }
        if (sub === 'on' && sub2 === 'all') {
            db._globalPriv = true;
            saveDB(db);
            return reply('`—͟͟͞͞𖣘 ANTI-EDIT ENABLED for all private chats`');
        }
        if (sub === 'off' && !sub2) {
            delete db.chats[chat];
            saveDB(db);
            return reply('`⟁⃝✘ ANTI-EDIT DISABLED for this chat`');
        }
        if (sub === 'off' && sub2 === 'all') {
            db._globalPriv = false;
            saveDB(db);
            return reply('`⟁⃝✘ ANTI-EDIT DISABLED for all private chats`');
        }
        if (sub === 'mode') {
            if (!sub2 || !['dm', 'chat'].includes(sub2)) {
                return reply('_⚉ Use .antiedit mode dm or .antiedit mode chat_');
            }
            db._mode = sub2;
            saveDB(db);
            return reply(
                sub2 === 'dm'
                    ? '`—͟͟͞͞𖣘 Edited messages → sent to your DM`'
                    : '`—͟͟͞͞𖣘 Edited messages → sent back to the same chat`'
            );
        }
        reply('_⚉ Unknown. Use .antiedit for help._');
    },

    cacheOriginal: (key, msgObj) => cacheOriginal(key, msgObj),

    onEdit: async (sock, updates, store) => {
        try {
            const db = getDB();

            for (const update of updates) {
                if (update.update?.message && update.update?.message !== update.previous) {
                    const key = update.key;
                    const chat = key.remoteJid;
                    if (!chat) continue;

                    const isGroup = chat.includes('@g.us');
                    const isPrivate = !isGroup;
                    const enabledForChat = !!db.chats[chat];
                    const enabledGlobally = isPrivate && !!db._globalPriv;
                    if (!enabledForChat && !enabledGlobally) continue;

                    await new Promise(res => setTimeout(res, 1000));

                    let newMsgObj = update.update.message;
                    newMsgObj = getMessageContent(newMsgObj);

                    const timeStr = getTime(update.update.messageTimestamp || Math.floor(Date.now() / 1000));

                    const sender = key.participant || key.remoteJid;
                    if (!sender) continue;

                    
                    const senderJidPart = sender.split('@')[0];  

                    const originalEntry = originalCache.get(key.id);
                    let oldText = originalEntry ? originalEntry.text : '[Original message not cached]';

                    
                    let contactName = senderJidPart;
                    if (store && store.contacts && store.contacts[sender]) {
                        const c = store.contacts[sender];
                        contactName = c.name || c.notify || c.verifiedName || contactName;
                    }
                    if (contactName === senderJidPart && originalEntry?.pushName) {
                        contactName = originalEntry.pushName;
                    }
                    if (contactName === senderJidPart && update.update.message?.pushName) {
                        contactName = update.update.message.pushName;
                    }

                    let formatted = `*✎ EDITED MESSAGE*\n`;

                    if (isGroup) {
                        let groupName = 'Unknown Group';
                        try {
                            const metadata = await sock.groupMetadata(chat);
                            groupName = metadata.subject || 'Unknown Group';
                        } catch {}
                        formatted += `_❏◦Group_ •⌲ ${groupName}\n`;
                        formatted += `_𓋎◦sender_ •⌲ @${contactName}\n`;  
                    } else {
                    
                        formatted += `_❏◦Chat_ •⌲ @${contactName}\n`;
                        formatted += `_𓋎◦sender_ •⌲ @${contactName}\n`;
                    }

                    formatted += `╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ᕗ\n`;
                    formatted += `_*⎙ old message:*_\n☇\n${oldText}\n\n`;
                    formatted += `_*✎ new message:*_\n☇\n${newMsgObj}\n\n`;
                    formatted += `✐ ${timeStr}`;

                    const sendOptions = { text: formatted, mentions: [sender] };  
                    const owner = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    const mode = db._mode || 'dm';
                    const dest = mode === 'chat' ? chat : owner;

                    await sock.sendMessage(dest, sendOptions)
                        .catch(err => console.error('[ANTIEDIT] Send failed:', err.message));

                    console.log(`[ANTIEDIT] ${senderJidPart} edited in ${isGroup ? 'group' : 'private'} → ${mode}`);
                }
            }
        } catch (e) {
            console.error('[ANTIEDIT ERROR]', e);
        }
    }
};
