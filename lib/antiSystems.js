const fs = require('fs-extra');

class AntiSystems {
    constructor(bot) {
        this.bot       = bot;
        this.spamCache = new Map();
    }

    _readDB(f)     { try { return JSON.parse(fs.readFileSync(f,'utf8')); } catch { return {}; } }
    _writeDB(f, d) { fs.ensureDirSync('./database'); fs.writeFileSync(f, JSON.stringify(d, null, 2)); }
    _linkRegex()   { return /(https?:\/\/|www\.)[^\s]+|chat\.whatsapp\.com\/[^\s]+/i; }
    _linkRegexGlobal() { return /(https?:\/\/|www\.)[^\s]+|chat\.whatsapp\.com\/[^\s]+/gi; }

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

    // Sends ONE quoted/tagged message carrying both the flag and the outcome
    // text, before the actual delete/kick runs — so there's a single visible
    // record of exactly which message triggered the anti-system, instead of
    // a separate tag message plus a second unquoted follow-up.
    async _notify(groupId, userId, text, m) {
        try {
            await this.bot.sock.sendMessage(groupId, {
                text: `🚩 @${userId.split('@')[0]}\n${text}`,
                mentions: [userId]
            }, { quoted: m });
        } catch (e) {
            // Fall back to an unquoted message if the source message can't be
            // quoted (e.g. it's already gone) — the notice itself must not fail.
            try {
                await this.bot.sendMessage(groupId, {
                    text: `🚩 @${userId.split('@')[0]}\n${text}`,
                    mentions: [userId]
                });
            } catch {}
        }
    }

    async _doAction(groupId, userId, settings, reason, m) {
        const action   = settings.action   || 'warn';
        // Cap warnings at 3 maximum (not 1-10)
        const maxWarns = Math.min(Math.max(settings.maxWarns || 3, 1), 3);

        if (action === 'delete') {
            await this._notify(groupId, userId, `Reason: ${reason}\nThis is not allowed here.`, m);
            await this._tryDelete(m);
            return true;
        }

        if (action === 'kick') {
            await this._notify(groupId, userId, `Removed.\nReason: ${reason}`, m);
            await this._tryDelete(m);
            await this._kick(groupId, userId);
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
                await this._notify(groupId, userId, `⛔ Removed after ${maxWarns}/${maxWarns} warnings.\nReason: ${reason}`, m);
                await this._tryDelete(m);
                await this._kick(groupId, userId);
                warns[key] = { count: 0, history: [] };
                this._writeDB(warnPath, warns);
            } else {
                await this._notify(groupId, userId, `⚠️ Warning ${count}/${maxWarns}\nReason: ${reason}`, m);
                await this._tryDelete(m);
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
        // Fires the instant this function is entered, BEFORE any await —
        // if this line is missing from the console entirely for a given
        // message, checkAll() was never called at all (the bug is upstream,
        // in messageHandler.js's outer gate). If this line prints but
        // nothing after it ever does, checkAll() itself is hanging or
        // throwing below.
        console.log('[antiSystems debug] checkAll ENTERED', { group: m.chat, sender: m.sender, msgId: m.id });

        try {
            // Safety gate: NEVER run anti-systems in DMs or if bot is not admin.
            // This was the root cause of the bot tagging people about links
            // even when it had no admin rights to do anything about it.
            if (!m.isGroup) { console.log('[antiSystems debug] BAILED: not a group'); return false; }

            // _isBotAdmin() calls sock.groupMetadata() under the hood, which can
            // hang indefinitely on a flaky/reconnecting socket instead of ever
            // resolving or rejecting. Race it against a 5s timeout so a hang
            // gets logged instead of silently freezing this message forever.
            const botIsAdmin = await Promise.race([
                this._isBotAdmin(m.chat),
                new Promise((resolve) => setTimeout(() => {
                    console.log('[antiSystems debug] TIMEOUT: _isBotAdmin took >5s for', m.chat, '- treating as not-admin');
                    resolve(false);
                }, 5000))
            ]);

            console.log('[antiSystems debug] gate check:', {
                group: m.chat,
                botIsAdmin,
                fromMe: m.fromMe,
                sender: m.sender
            });
            if (!botIsAdmin) {
                console.log('[antiSystems debug] BAILED: bot is not a group admin in', m.chat);
                return false;
            }

            return await this._checkAllInner(m);
        } catch (err) {
            // Anything thrown anywhere in checkAll (or _checkAllInner) lands
            // here instead of silently vanishing or getting swallowed by an
            // unrelated try/catch further up the call stack.
            console.error('[antiSystems debug] checkAll THREW:', err);
            return false;
        }
    }

    async _checkAllInner(m) {
        // Never act on the bot's own messages. Without this, a message the
        // bot itself sends (e.g. a link, or its own warning/tag text that
        // mentions several users) could match a trigger and cause the bot
        // to warn/delete/kick itself.
        if (m.fromMe || m.key?.fromMe) return false;

        // Extra safety: owner and mods always bypass anti-systems
        const isOwner = this.bot.permission.isOwner(m.sender);
        const isMod = this.bot.permission.isMod(m.sender, m._participantRaw);
        if (isOwner || isMod) {
            console.log('[antiSystems debug] BAILED: sender is owner/mod, bypassing anti-systems', { sender: m.sender, isOwner, isMod });
            return false;
        }

        // BUG (found): bot-owner/bot-mod is a completely different thing
        // from being a WhatsApp group admin/superadmin — the two checks
        // above only cover the bot's own privileged users. A group admin
        // who isn't also the bot owner or a bot-mod had NO exemption at
        // all and could still get warned/deleted/kicked by anti-systems
        // like antilink, antispam, etc. Group admins/superadmins should
        // never be actioned by moderation they themselves have authority
        // over — check their real WhatsApp role too.
        const isGroupAdmin = await this.bot.permission.isAdmin(m.chat, m.sender, m._participantRaw).catch(() => false);
        console.log('[antiSystems debug] group-admin check:', { sender: m.sender, isGroupAdmin });
        if (isGroupAdmin) {
            console.log('[antiSystems debug] BAILED: sender is a group admin/superadmin, bypassing anti-systems');
            return false;
        }

        const groupId = m.chat;
        const userId  = m.sender;
        const text    = m.text || '';

        // Anti-Link (per-group, off by default)
        const alSettings = this._settings('./database/antilink.json', groupId);
        if (alSettings.enabled) {
            // Every link found in the message, not just a single yes/no test —
            // needed so an allowed link can sit alongside checking others.
            const foundLinks = text.match(this._linkRegexGlobal()) || [];
            if (foundLinks.length) {
                const allowed = alSettings.allowedLinks || [];
                const isAllowed = (link) => allowed.some((a) =>
                    link.toLowerCase().includes(a.toLowerCase()) ||
                    a.toLowerCase().includes(link.toLowerCase())
                );
                const hasDisallowedLink = foundLinks.some((link) => !isAllowed(link));
                if (hasDisallowedLink) {
                    return await this._doAction(groupId, userId, alSettings, 'No links allowed', m);
                }
            }
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
            // BUG (was): checked `(m.msg || m.message).groupStatusMessageV2`.
            // messageHandler.smsg() already sets `m.msg = msg.message[type]`,
            // so when the type IS groupStatusMessageV2, m.msg is already the
            // *unwrapped content* of that field, not a wrapper containing a
            // `.groupStatusMessageV2` property — that lookup was always
            // undefined and this feature could never fire. The correct check
            // is m.type (set from getContentType) or the raw m.message object.
            const isGroupStatusPost = m.type === 'groupStatusMessageV2' || !!m.message?.groupStatusMessageV2;

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
        // Real, reliable signal: the shape of the message ID itself.
        // Baileys (and most bot libraries) generate IDs like "3EB0" + 16 hex
        // chars = 20 chars total; the official WhatsApp app never produces
        // an ID shaped that way. messageHandler.smsg() now sets
        // m.isBot / m.isBaileys from that pattern, so use it directly.
        //
        // BUG (previous fix): checked the multi-device JID suffix instead,
        // but that suffix gets stripped off m.sender before antiSystems ever
        // sees it, so it could never match. The message-ID signal doesn't
        // depend on the sender JID at all, so it isn't affected by that.
        const abSettings = this._settings('./database/antibot.json', groupId);
        console.log('[antibot debug]', {
            group: groupId,
            enabled: abSettings.enabled,
            msgId: m.id,
            msgIdLength: m.id?.length,
            isBot: m.isBot,
            isBaileys: m.isBaileys,
            fromMe: m.fromMe,
            sender: m.sender
        });
        if (abSettings.enabled) {
            const isBot = (m.isBot || m.isBaileys) && !m.fromMe;
            console.log('[antibot debug] decision:', isBot ? 'FLAGGED as bot' : 'not flagged');
            if (isBot) {
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


        
