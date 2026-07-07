const fs = require('fs-extra');

const AFK_PATH     = './database/afk.json';
const AFK_CFG_PATH = './database/afk_config.json';

class AFKSystem {
    constructor(bot) {
        this.bot = bot;
    }

    _clean(jid) {
        if (!jid) return '';
        return jid.replace(/:[0-9]+@/, '@');
    }

    _time() {
        return new Date().toLocaleString('en-NG', {
            timeZone: 'Africa/Lagos',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
    }

    _duration(ms) {
        const s = Math.floor(ms / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const r = s % 60;
        if (h > 0) return `${h}h ${m}m ${r}s`;
        if (m > 0) return `${m}m ${r}s`;
        return `${r}s`;
    }

    _readDB()      { try { return JSON.parse(fs.readFileSync(AFK_PATH,     'utf8')); } catch { return {}; } }
    _writeDB(db)   { fs.ensureDirSync('./database'); fs.writeFileSync(AFK_PATH,     JSON.stringify(db,  null, 2)); }
    _readCfg()     { try { return JSON.parse(fs.readFileSync(AFK_CFG_PATH, 'utf8')); } catch { return {}; } }
    _writeCfg(cfg) { fs.ensureDirSync('./database'); fs.writeFileSync(AFK_CFG_PATH, JSON.stringify(cfg, null, 2)); }

    getMode(jid) {
        const cfg = this._readCfg();
        return cfg[this._clean(jid)]?.mode || 'all';
    }

    setMode(jid, mode) {
        const cfg = this._readCfg();
        const key = this._clean(jid);
        if (!cfg[key]) cfg[key] = {};
        cfg[key].mode = mode;
        this._writeCfg(cfg);
    }

    // pushName = the WhatsApp display name of the person going AFK
    setAFK(userId, reason, pushName) {
        const db  = this._readDB();
        const key = this._clean(userId);
        db[key]   = {
            reason:   reason || 'AFK',
            name:     pushName || userId.split('@')[0],
            time:     Date.now(),
            lastSeen: this._time(),
            mentions: []
        };
        this._writeDB(db);
    }

    removeAFK(userId) {
        const db  = this._readDB();
        const key = this._clean(userId);
        if (db[key]) {
            const data = db[key];
            delete db[key];
            this._writeDB(db);
            return data;
        }
        return null;
    }

    isAFK(userId) {
        const db = this._readDB();
        return db[this._clean(userId)] || null;
    }

    async checkAFK(m) {
        const senderClean = this._clean(m.sender);
        const text        = m.text || '';
        const isCmd       = text.startsWith(this.bot.prefix);

        // ── STEP 1: AFK user sends a non-command → welcome back ───────────────
        const myAFK = this.isAFK(senderClean);
        if (myAFK && !isCmd) {
            const removed  = this.removeAFK(senderClean);
            const duration = this._duration(Date.now() - removed.time);
            const count    = (removed.mentions || []).length;
            const name     = removed.name || m.pushName || senderClean.split('@')[0];

            await this.bot.sendMessage(m.chat, {
                text:
`✨ *Welcome back, ${name}!*
⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁
🌙 Reason you were away: *${removed.reason}*
⏱ Duration: *${duration}*
🕐 Last seen: ${removed.lastSeen}
💬 Mentioned *${count}* time(s) while you were away.
⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁`
            }).catch(() => {});
            return;
        }

        // ── STEP 2: Someone else's message — check for AFK user ───────────────
        if (m.fromMe) return;

        const notified = new Set();

        // TRIGGER A: @mention tag
        const mentions = m.mentions || [];
        for (const raw of mentions) {
            const clean = this._clean(raw);
            if (clean === senderClean)  continue;
            if (notified.has(clean))    continue;

            const afk = this.isAFK(clean);
            if (!afk) continue;

            const mode = this.getMode(clean);
            if (mode === 'mention') continue;

            notified.add(clean);
            await this._handle(m, senderClean, clean, afk);
        }

        // TRIGGER B: quoted reply
        const ctx         = m.contextInfo || m.msg?.contextInfo || {};
        const quotedOwner = ctx.participant || ctx.remoteJid || null;
        if (quotedOwner) {
            const clean = this._clean(quotedOwner);
            if (clean !== senderClean && !notified.has(clean)) {
                const afk = this.isAFK(clean);
                if (afk) {
                    const mode = this.getMode(clean);
                    if (mode !== 'tag') {
                        notified.add(clean);
                        await this._handle(m, senderClean, clean, afk);
                    }
                }
            }
        }
    }

    async _handle(m, senderClean, afkUserClean, afk) {
        const time       = this._time();
        const duration   = this._duration(Date.now() - afk.time);
        const taggerName = m.pushName || senderClean.split('@')[0];
        const taggerNum  = senderClean.split('@')[0];
        const msgText    = m.text || '(media/sticker)';
        const afkName    = afk.name || afkUserClean.split('@')[0]; // their WhatsApp name

        // Save to DB
        const db = this._readDB();
        if (db[afkUserClean]) {
            if (!db[afkUserClean].mentions) db[afkUserClean].mentions = [];
            db[afkUserClean].mentions.push({ name: taggerName, number: taggerNum, message: msgText, time });
            this._writeDB(db);
        }

        // ── Group reply — use their WhatsApp name, no tag ─────────────────────
        await this.bot.sendMessage(m.chat, {
            text:
`🌙 *${afkName} is currently AFK*
⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁
📝 Reason: *${afk.reason}*
⏱ Duration: *${duration}*
🕐 Last seen: ${afk.lastSeen}
⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁
💡 They will be notified of your message.`
        }).catch(() => {});

        // ── DM to AFK user ────────────────────────────────────────────────────
        let chatName = m.chat;
        if (m.isGroup) {
            try {
                const meta = await this.bot.sock.groupMetadata(m.chat);
                chatName   = meta.subject || m.chat;
            } catch {}
        }

        const dmTarget = afkUserClean.includes('@') ? afkUserClean : afkUserClean + '@s.whatsapp.net';

        await this.bot.sendMessage(dmTarget, {
            text:
`🔔 *AFK ALERT*
⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁
👤 From: *${taggerName}* (+${taggerNum})
💬 Message: *${msgText}*
📍 Chat: *${chatName}*
🕐 Time: ${time} (NG)
⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁⌁
💤 Your reason: *${afk.reason}*
⏱ Duration so far: *${duration}*`,
            mentions: [senderClean]
        }).catch(() => {});
    }
}

module.exports = AFKSystem;
