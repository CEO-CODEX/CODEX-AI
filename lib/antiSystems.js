const fs = require('fs-extra');

class AntiSystems {
    constructor(bot) {
        this.bot       = bot;
        this.spamCache = new Map();
    }

    _readDB(f)     { try { return JSON.parse(fs.readFileSync(f,'utf8')); } catch { return {}; } }
    _writeDB(f, d) { fs.ensureDirSync('./database'); fs.writeFileSync(f, JSON.stringify(d, null, 2)); }
    _linkRegex()   { return /(https?:\/\/|www\.)[^\s]+|chat\.whatsapp\.com\/[^\s]+/i; }

    // Per-group settings ONLY — never falls back to global config.
    // Default is always { enabled: false } so the bot does nothing until
    // an admin explicitly enables a feature in that specific group.
    _settings(dbPath, groupId) {
        const db = this._readDB(dbPath);
        return db[groupId] || { enabled: false };
    }

    async _isBotAdmin(groupId) {
        try { return await this.bot.permission.isBotAdmin(groupId); }
        catch { return false; }
    }

    async _doAction(groupId, userId, settings, reason, m) {
        const action   = settings.action   || 'warn';
        // Cap warnings at 3 maximum (not 1-10)
        const maxWarns = Math.min(Math.max(settings.maxWarns || 3, 1), 3);

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
            if (!warns[key] || typeof warns[key] === 'number') {
                warns[key] = { count: typeof warns[key] === 'number' ? warns[key] : 0, history: [] };
            }
            warns[key].count++;
            warns[key].history.push({
                reason, issuer: 'Auto', issuerName: 'System',
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

    async checkAll(m) {
        
        // Safety gate: NEVER run anti-systems in DMs or if bot is not admin.
        // This was the root cause of the bot tagging people about links
        // even when it had no admin rights to do anything about it.
        if (!m.isGroup) return false;
        const botIsAdmin = await this._isBotAdmin(m.chat);
        if (!botIsAdmin) return false;

        console.log(JSON.stringify(botIsAdmin, null, 2)) 
        // Extra safety: owner and mods always bypass anti-systems
        const isOwner = this.bot.permission.isOwner(m.sender);
        const isMod = this.bot.permission.isMod(m.sender, m._participantRaw);
        if (isOwner || isMod) return false;

        const groupId = m.chat;
        const userId  = m.sender;
        const text    = m.text || '';

        // Anti-Link (per-group, off by default)
        const alSettings = this._settings('./database/antilink.json', groupId);
        console.log("linkkkkk:", text)
        console.log("linkk:", JSON.stringify(text))
        if (alSettings.enabled && this._linkRegex().test(text)) {
            
            return await this._doAction(groupId, userId, alSettings, 'No links allowed', m);
        }

        // Anti-Spam (per-group, off by default)
        const asSettings = this._settings('./database/antispam.json', groupId);
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

        // Anti-Tag (per-group, off by default)
        const atSettings = this._settings('./database/antitag.json', groupId);
        if (atSettings.enabled && (m.mentions || []).length >= 5) {
            return await this._doAction(groupId, userId, atSettings, 'Mass tagging not allowed', m);
        }

        // Anti-Game (per-group, off by default)
        const agSettings = this._settings('./database/antigame.json', groupId);
        if (agSettings.enabled) {
            const gameEmojiPattern = /^(\u{1F3B2}|\u{1F3AF}|\u{1F3C0}|\u26BD|\u{1F3B3}|\u{1F3B0}|\u{1F9E9})$/u;
            const isGameEmoji   = gameEmojiPattern.test(text.trim());
            const isGameMsgType = m.type === 'gameMessage' || m.type === 'interactiveMessage' ||
                                  m.type === 'nativeFlowMessage' || !!(m.msg?.nativeFlowMessage) ||
                                  !!(m.msg?.interactiveMessage);
            if (isGameEmoji || isGameMsgType) {
                return await this._doAction(groupId, userId, agSettings, 'Games/pills are not allowed here', m);
            }
        }

        // Anti-Group Mention (per-group, off by default)
        // Detects @everyone / @group wide-broadcast tags and forwarded
        // group-mention content inside normal chat messages. Includes the
        // real, verified signals a working reference bot (SUKUNA_MD) uses —
        // contextInfo.groupMentions, contextInfo.isSampled, and a mentioned
        // JID that is itself a group (@g.us) — in addition to the original
        // checks already here.
        const agmSettings = this._settings('./database/antigroupmention.json', groupId);
        if (agmSettings.enabled) {
            const rawMsg = m.msg || m.message || {};
            const ctxAGM = rawMsg.extendedTextMessage?.contextInfo ||
                           rawMsg.imageMessage?.contextInfo ||
                           rawMsg.videoMessage?.contextInfo ||
                           rawMsg.contextInfo || {};

           /* let isStatusMention = false;
            isStatusMention = isStatusMention || !!rawMsg.groupStatusMentionMessage;
            isStatusMention = isStatusMention || (rawMsg.protocolMessage?.type === 25);
            isStatusMention = isStatusMention || !!rawMsg.extendedTextMessage?.contextInfo?.forwardedNewsletterMessageInfo;
            isStatusMention = isStatusMention || !!(rawMsg.conversation && rawMsg.contextInfo?.forwardedNewsletterMessageInfo);
            isStatusMention = isStatusMention || !!rawMsg.imageMessage?.contextInfo?.forwardedNewsletterMessageInfo;
            isStatusMention = isStatusMention || !!rawMsg.videoMessage?.contextInfo?.forwardedNewsletterMessageInfo;
            isStatusMention = isStatusMention || !!rawMsg.contextInfo?.forwardedNewsletterMessageInfo;
            isStatusMention = isStatusMention || !!(rawMsg.contextInfo?.isForwarded && rawMsg.contextInfo?.forwardingScore);
            // Verified signals from a working reference implementation:
            isStatusMention = isStatusMention || (Array.isArray(ctxAGM.groupMentions) && ctxAGM.groupMentions.length > 0);
            isStatusMention = isStatusMention || !!ctxAGM.isSampled;
            isStatusMention = isStatusMention || (ctxAGM.mentionedJid || []).some(j => String(j).endsWith('@g.us'));
            isStatusMention = isStatusMention || /@everyone\b/i.test(text) || /@group\b/i.test(text); */

                if (m.message?.groupStatusMentionMessage && !m.fromMe) {
                return await this._doAction(groupId, userId, agmSettings, 'Group mentions are not allowed', m);
            }
        }

        // Anti-GC-Status (per-group, off by default)
        // Detects an actual native "group status post" — a member posting
        // directly to the group's status/updates feed. The real field for
        // this is `groupStatusMessageV2` on the raw message (verified against
        // a working reference bot, SUKUNA_MD). This is a DIFFERENT feature
        // from Anti-Group-Mention above (which is about @everyone/@group tags
        // and forwarded mentions inside normal chat messages).
        //
        // Uses the SAME enabled/action(delete|warn|kick) system as every
        // other anti-system here (via _settings()/_doAction()), so warnings
        // accumulate consistently and the command surface matches
        // .antilink / .antiforwarding / .antiword etc. A group status post
        // needs a special key shape to actually revoke on WhatsApp's side
        // (different Baileys forks want different shapes), so that reliable
        // multi-method delete still runs as a pre-step before handing off
        // to _doAction() for the standard delete/warn/kick bookkeeping.
        const agcsSettings = this._settings('./database/antigcstatus.json', groupId);
        if (agcsSettings.enabled) {
            const rawMsg = m.msg || m.message || {};
            const isGroupStatusPost = !!rawMsg.groupStatusMessageV2;

            if (isGroupStatusPost) {
                const sock = this.bot.sock;
                const statusKey = {
                    remoteJid:   groupId,
                    fromMe:      false,
                    id:          m.key.id,
                    participant: userId,
                };
                try { await sock.sendMessage(groupId, { delete: statusKey }); } catch {}
                try {
                    if (typeof sock.groupRevokeStatus === 'function') {
                        await sock.groupRevokeStatus(groupId, m.key.id);
                    }
                } catch {}
                try {
                    await sock.sendMessage(groupId, { protocolMessage: { key: statusKey, type: 0 } }); // REVOKE
                } catch {}
                try {
                    await sock.sendMessage(groupId, { delete: { ...statusKey, fromMe: true } });
                } catch {}

                return await this._doAction(groupId, userId, agcsSettings, 'Group status posts are not allowed', m);
            }
        }

        // Anti-Bot (detect & kick bot accounts)
        // Real, reliable signal: a multi-device JID — number:N@s.whatsapp.net
        // where N > 0. There is no `m.isBot` property anywhere in this codebase,
        // so the old check could never fire; this is the same signal a working
        // reference bot (SUKUNA_MD) uses.
        const abSettings = this._settings('./database/antibot.json', groupId);
        if (abSettings.enabled) {
            const mdMatch = String(userId).match(/^(\d+):(\d+)@s\.whatsapp\.net$/);
            const isMdBot = !!(mdMatch && parseInt(mdMatch[2], 10) > 0);
            if (isMdBot) {
                return await this._doAction(groupId, userId, abSettings, 'Bots are not allowed', m);
            }
        }

        // Block-Sticker (per-sticker content ban, always enforced when a hash
        // is on the list — set via commands/admin/blocksticker.js). This is
        // SUKUNA_MD's `mutesticker` feature ported under a non-conflicting
        // name, since this bot's own `mutesticker` means something different
        // (muting a USER's stickers, not banning a specific sticker image).
        if (m.type === 'stickerMessage' && m.msg?.fileSha256) {
            const blockedDb = this._readDB('./database/blockedstickers.json');
            const blockedList = blockedDb[groupId] || [];
            if (blockedList.length) {
                const hash = Buffer.from(m.msg.fileSha256).toString('base64');
                if (blockedList.includes(hash)) {
                    await this._tryDelete(m);
                    return true;
                }
            }
        }

        // Anti-Word (banned words detection)
        const awSettings = this._settings('./database/antiword.json', groupId);
        if (awSettings.enabled && awSettings.words && Array.isArray(awSettings.words)) {
            const msgText = (text || '').toLowerCase();
            for (const word of awSettings.words) {
                if (msgText.includes(word.toLowerCase())) {
                    return await this._doAction(groupId, userId, awSettings, `Banned word used: "${word}"`, m);
                }
            }
        }

        // Anti-Forwarding (detect forwarded messages)
        const afSettings = this._settings('./database/antiforwarding.json', groupId);
        if (afSettings.enabled) {
            const rawMsg = m.msg || m.message || {};
            const isForwarded = rawMsg.contextInfo?.isForwarded || 
                               !!(rawMsg.contextInfo?.forwardingScore && rawMsg.contextInfo?.forwardingScore > 0);
            if (isForwarded) {
                return await this._doAction(groupId, userId, afSettings, 'Forwarded messages are not allowed', m);
            }
        }

        return false;
    }

    async checkStatusGroupMention(statusSender, mentionedGroupJid) {
        const db       = this._readDB('./database/antigroupmention.json');
        const settings = db[mentionedGroupJid];
        if (!settings?.enabled) return;
        if (this.bot.permission.isOwner(statusSender) || this.bot.permission.isMod(statusSender)) return;

        const botIsAdmin = await this._isBotAdmin(mentionedGroupJid);
        if (!botIsAdmin) return;

        const action   = settings.action   || 'warn';
        // Cap warnings at 3 maximum (not 1-10)
        const maxWarns = Math.min(Math.max(settings.maxWarns || 3, 1), 3);

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
            if (!warns[key] || typeof warns[key] === 'number') {
                warns[key] = { count: typeof warns[key] === 'number' ? warns[key] : 0, history: [] };
            }
            warns[key].count++;
            warns[key].history.push({
                reason: 'Mentioned group in status', issuer: 'Auto', issuerName: 'System',
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
            await this.bot.sendMessage(mentionedGroupJid, {
                text: `📢 @${statusSender.split('@')[0]} mentioned this group in their WhatsApp status.`,
                mentions: [statusSender]
            });
        }
    }
}

module.exports = AntiSystems;


        
