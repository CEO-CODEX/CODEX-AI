const fs = require('fs-extra');

class AntiSystems {
    constructor(bot) {
        this.bot       = bot;
        this.spamCache = new Map();
        this.currentMessage = null;
    }

    _readDB(f)     { try { return JSON.parse(fs.readFileSync(f,'utf8')); } catch { return {}; } }
    _writeDB(f, d) { fs.ensureDirSync('./database'); fs.writeFileSync(f, JSON.stringify(d, null, 2)); }
    _linkRegex()   { return /(https?:\/\/|www\.)[^\s]+|chat\.whatsapp\.com\/[^\s]+/i; }

    async _doAction(groupId, userId, settings, reason, m) {
        const action   = settings.action   || 'warn';
        const maxWarns = settings.maxWarns || 3;

        if (action === 'delete') {
            await this._tryDelete(m);
            await this.bot.sendMessage(groupId, {
                text: `${reason}\n\n@${userId.split('@')[0]}, this is not allowed here.`,
                mentions: [userId]
            });
            return true;
        }

        if (action === 'kick') {
            await this._tryDelete(m);
            await this._kick(groupId, userId);
            await this.bot.sendMessage(groupId, {
                text: `@${userId.split('@')[0]} was removed.\nReason: ${reason}`,
                mentions: [userId]
            });
            return true;
        }

        if (action === 'warn') {
            const warnPath = './database/warnings.json';
            let warns = this._readDB(warnPath);
            const key = `${groupId}_${userId}`;
            // Support both old flat number and new object structure
            if (!warns[key] || typeof warns[key] === 'number') {
                warns[key] = { count: typeof warns[key] === 'number' ? warns[key] : 0, history: [] };
            }
            warns[key].count++;
            warns[key].history.push({
                reason,
                issuer: 'Auto',
                issuerName: 'System',
                time: new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos', hour12: true })
            });
            const count = warns[key].count;
            this._writeDB(warnPath, warns);

            if (count >= maxWarns) {
                await this._tryDelete(m);
                await this._kick(groupId, userId);
                warns[key] = { count: 0, history: [] };
                this._writeDB(warnPath, warns);
                await this.bot.sendMessage(groupId, {
                    text: `⛔ @${userId.split('@')[0]} removed after ${maxWarns}/${maxWarns} warnings.\nReason: ${reason}`,
                    mentions: [userId]
                });
            } else {
                await this._tryDelete(m);
                await this.bot.sendMessage(groupId, {
                    text: `⚠️ Warning ${count}/${maxWarns} — @${userId.split('@')[0]}\nReason: ${reason}`,
                    mentions: [userId]
                });
            }
            return true;
        }
        return false;
    }

    async _kick(groupId, userId) {
        try { await this.bot.sock.groupParticipantsUpdate(groupId, [userId], 'remove'); }
        catch (e) { console.error('Kick failed:', e.message); }
    }

    async _tryDelete(m) {
        if (!m || !m.key) return;
        try { await this.bot.sock.sendMessage(m.chat, { delete: m.key }); } catch {}
    }

    _settings(dbPath, groupId, cfgKey) {
        const db  = this._readDB(dbPath);
        const cfg = this.bot.config[cfgKey] || {};
        return db[groupId] ? { ...cfg, ...db[groupId] } : cfg;
    }

    async checkAll(m) {
        const groupId = m.chat;
        const userId  = m.sender;
        const text    = m.text || '';

        // Anti-Link
        const alSettings = this._settings('./database/antilink.json', groupId, 'antiLink');
        if (alSettings.enabled && this._linkRegex().test(text)) {
            return await this._doAction(groupId, userId, alSettings, 'No links allowed', m);
        }

        // Anti-Spam
        const asSettings = this._settings('./database/antispam.json', groupId, 'antiSpam');
        if (asSettings.enabled) {
            const limit    = asSettings.limit    || 5;
            const cooldown = asSettings.cooldown || 10000;
            const key      = `${groupId}_${userId}`;
            const now      = Date.now();
            const entry    = this.spamCache.get(key) || { count: 0, first: now };

            if (now - entry.first > cooldown) {
                this.spamCache.set(key, { count: 1, first: now });
            } else {
                entry.count++;
                this.spamCache.set(key, entry);
                if (entry.count >= limit) {
                    this.spamCache.delete(key);
                    return await this._doAction(groupId, userId, asSettings, 'Spamming not allowed', m);
                }
            }
        }

        // (Anti-Bot removed — the message-ID-length heuristic was too unreliable
        // and false-flagged legitimate members.)

        // Anti-Tag
        const atSettings = this._settings('./database/antitag.json', groupId, 'antiTag');
        if (atSettings.enabled !== false && (m.mentions || []).length >= 5) {
            return await this._doAction(groupId, userId, atSettings, 'Mass tagging not allowed', m);
        }

        // Anti-Game
        // WhatsApp game/pill emojis are sent as regular messages — no special type.
        // Detect: dice(🎲), dart(🎯), basketball(🏀), football(⚽), bowling(🎳), slot(🎰)
        // Also catch interactiveMessage / liveLocationMessage game types
        const agSettings = this._settings('./database/antigame.json', groupId, 'antiGame');
        if (agSettings.enabled) {
            const gameEmojiPattern = /^(\u{1F3B2}|\u{1F3AF}|\u{1F3C0}|\u26BD|\u{1F3B3}|\u{1F3B0}|\u{1F9E9})$/u;
            const isGameEmoji   = gameEmojiPattern.test(text.trim());
            const isGameMsgType = m.type === 'gameMessage' ||
                                  m.type === 'interactiveMessage' ||
                                  (m.type === 'nativeFlowMessage') ||
                                  !!(m.msg?.nativeFlowMessage) ||
                                  !!(m.msg?.interactiveMessage);
            if (isGameEmoji || isGameMsgType) {
                return await this._doAction(groupId, userId, agSettings, 'Games/pills are not allowed here', m);
            }
        }

        // ── Anti-Group Mention — KnightBot 9-method detection ──────────────
        const agmSettings = this._settings('./database/antigroupmention.json', groupId, 'antiGroupMention');
        if (agmSettings.enabled) {
            const rawMsg = m.msg || m.message || {};
            let isStatusMention = false;

            isStatusMention = isStatusMention || !!rawMsg.groupStatusMentionMessage;
            isStatusMention = isStatusMention || (rawMsg.protocolMessage?.type === 25);
            isStatusMention = isStatusMention || !!rawMsg.extendedTextMessage?.contextInfo?.forwardedNewsletterMessageInfo;
            isStatusMention = isStatusMention || !!(rawMsg.conversation && rawMsg.contextInfo?.forwardedNewsletterMessageInfo);
            isStatusMention = isStatusMention || !!rawMsg.imageMessage?.contextInfo?.forwardedNewsletterMessageInfo;
            isStatusMention = isStatusMention || !!rawMsg.videoMessage?.contextInfo?.forwardedNewsletterMessageInfo;
            isStatusMention = isStatusMention || !!rawMsg.contextInfo?.forwardedNewsletterMessageInfo;
            isStatusMention = isStatusMention || !!(rawMsg.contextInfo?.isForwarded) || !!(rawMsg.extendedTextMessage?.contextInfo?.isForwarded);
            isStatusMention = isStatusMention || !!(rawMsg.contextInfo?.forwardingScore) || !!(rawMsg.extendedTextMessage?.contextInfo?.forwardingScore);

            if (isStatusMention) {
                return await this._doAction(groupId, userId, agmSettings, 'Group status mentions are not allowed', m);
            }
        }

        return false;
    }

    // ── Anti-Group Mention: called when bot detects someone mentioned a group in their status ──
    async checkStatusGroupMention(statusSender, mentionedGroupJid) {
        const db       = this._readDB('./database/antigroupmention.json');
        const settings = db[mentionedGroupJid];
        if (!settings?.enabled) return;

        // Skip if sender is owner or mod
        if (this.bot.permission.isOwner(statusSender) || this.bot.permission.isMod(statusSender)) return;

        const action   = settings.action   || 'warn';
        const maxWarns = settings.maxWarns || 3;

        console.log(`[AntiGroupMention] ${statusSender} mentioned group ${mentionedGroupJid} in status. Action: ${action}`);

        if (action === 'kick') {
            await this._kick(mentionedGroupJid, statusSender);
            await this.bot.sendMessage(mentionedGroupJid, {
                text: `@${statusSender.split('@')[0]} was removed.\nReason: Mentioned this group in their WhatsApp status.`,
                mentions: [statusSender]
            });
        } else if (action === 'warn') {
            const warnPath = './database/warnings.json';
            let warns = this._readDB(warnPath);
            const key = `${mentionedGroupJid}_${statusSender}`;

            // Support both old flat number and new object structure
            if (!warns[key] || typeof warns[key] === 'number') {
                warns[key] = { count: typeof warns[key] === 'number' ? warns[key] : 0, history: [] };
            }
            warns[key].count++;
            warns[key].history.push({
                reason: 'Mentioned group in status',
                issuer: 'Auto',
                issuerName: 'System',
                time: new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos', hour12: true })
            });
            const count = warns[key].count;
            this._writeDB(warnPath, warns);

            if (count >= maxWarns) {
                await this._kick(mentionedGroupJid, statusSender);
                warns[key] = { count: 0, history: [] };
                this._writeDB(warnPath, warns);
                await this.bot.sendMessage(mentionedGroupJid, {
                    text: `⛔ @${statusSender.split('@')[0]} removed after ${maxWarns}/${maxWarns} warnings.\nReason: Kept mentioning this group in WhatsApp status.`,
                    mentions: [statusSender]
                });
            } else {
                await this.bot.sendMessage(mentionedGroupJid, {
                    text: `⚠️ Warning ${count}/${maxWarns} — @${statusSender.split('@')[0]}\nReason: Mentioned this group in their status.`,
                    mentions: [statusSender]
                });
            }
        } else if (action === 'delete') {
            // Can't delete someone's status, just notify
            await this.bot.sendMessage(mentionedGroupJid, {
                text: `📢 @${statusSender.split('@')[0]} mentioned this group in their WhatsApp status.`,
                mentions: [statusSender]
            });
        }
    }
}

module.exports = AntiSystems;
