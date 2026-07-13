/**
 * C☯︎DEX-AI — Permission System
 * LID-safe owner / sudo / admin checks (ported from C☯︎DEX-AI V3.0)
 *
 * Owner is identified by:
 *   1. msg.key.fromMe === true  (always means the owner sent this — done in messageHandler)
 *   2. Digit-only tail-match of sender JID vs config.owner.number
 *
 * This is LID-safe: strips everything except digits and compares the last 10
 * digits, which handles all JID formats: @s.whatsapp.net, @lid, :device@ suffixes.
 */

const fs = require('fs-extra');

class Permission {
    constructor(bot) {
        this.bot = bot;
    }

    // ── Strip everything except digits from any JID / number string ───────────
    _phone(jid) {
        if (!jid) return '';
        return String(jid)
            .replace(/:[0-9]+@/, '@')   // strip device suffix
            .split('@')[0]
            .replace(/[^0-9]/g, '');
    }

    // ── Normalize to clean @s.whatsapp.net JID ────────────────────────────────
    _clean(jid) {
        if (!jid) return '';
        const num = this._phone(jid);
        return num ? num + '@s.whatsapp.net' : '';
    }

    // ── Digit tail-match — handles country-code prefix differences ────────────
    // Compares last 10 digits of both numbers (min 8 to avoid false positives)
    _numMatch(a, b) {
        if (!a || !b) return false;
        if (a === b) return true;
        const ta = a.slice(-10), tb = b.slice(-10);
        return ta.length >= 8 && tb.length >= 8 && ta === tb;
    }

    // ── Owner check ───────────────────────────────────────────────────────────
    // Works in DM and GROUP, with @lid or @s.whatsapp.net sender JIDs.
    isOwner(jid) {
        if (!jid) return false;

        // Owner number from config — supports both { number: '...' } and plain string
        const ownerRaw = (typeof this.bot.config.owner === 'object')
            ? (this.bot.config.owner.number || '')
            : (this.bot.config.owner || '');

        const ownerNum  = this._phone(ownerRaw);
        if (!ownerNum) return false;

        const senderNum = this._phone(jid);

        return senderNum === ownerNum || this._numMatch(senderNum, ownerNum);
    }

    // ── Match a single stored entry against any of the sender JID forms ───────
    // WhatsApp's @lid rollout means the sender can arrive as a phone JID
    // (@s.whatsapp.net) OR as a @lid whose digits differ entirely from the
    // phone number. We therefore match a stored entry if it equals/tail-matches
    // ANY of the provided sender identifiers (resolved phone + raw participant).
    _matchAny(storedNum, jids) {
        if (!storedNum) return false;
        return jids.some(j => {
            const n = this._phone(j);
            return n && (n === storedNum || this._numMatch(n, storedNum));
        });
    }

    // ── Mod check (config.mods array) ─────────────────────────────────────────
    // MOD = highest delegated tier: mods can use EVERY command, including
    // owner-only commands. Accepts multiple sender JID forms for LID safety.
    isMod(...jids) {
        jids = jids.flat().filter(Boolean);
        if (jids.some(j => this.isOwner(j))) return true;
        return (this.bot.config.mods || []).some(m =>
            this._matchAny(this._phone(m), jids)
        );
    }

    // ── Sudo check (database/sudo.json + config.sudo array) ──────────────────
    // SUDO = elevated tier that can use every command EXCEPT owner-only ones.
    // A mod is always also treated as sudo (mods outrank sudo). Accepts
    // multiple sender JID forms for LID safety.
    isSudo(...jids) {
        jids = jids.flat().filter(Boolean);
        if (!jids.length) return false;
        if (this.isMod(jids)) return true; // owner + mod both count as sudo

        // Check sudo.json DB (written by .sudo add / sudo.js command)
        let sudoData = {};
        try { sudoData = JSON.parse(fs.readFileSync('./database/sudo.json', 'utf8')); } catch {}

        // DB format: { users: ['2349...', ...] }  OR legacy { '2349...': true }
        const users = Array.isArray(sudoData.users)
            ? sudoData.users
            : Object.keys(sudoData).filter(k => k !== 'users');

        if (users.some(k => this._matchAny(this._phone(k), jids))) return true;

        // Also check config.sudo array (legacy / static list)
        return (this.bot.config.sudo || []).some(s =>
            this._matchAny(this._phone(s), jids)
        );
    }

    // ── Group admin check ─────────────────────────────────────────────────────
    // LID-safe: checks the participant entry's .id AND any .lid/.jid/.phoneNumber
    // fields against BOTH the resolved (phone-preferred) userJid and the raw
    // participant JID, since WhatsApp's @lid rollout means group participant
    // lists and sender JIDs don't always agree on which identifier they use.
    async isAdmin(groupJid, userJid, rawJid) {
        try {
            const meta = await this.bot.sock.groupMetadata(groupJid);
            const candidates = [this._phone(userJid), this._phone(rawJid)].filter(Boolean);
            if (!candidates.length) return false;

            const p = meta.participants.find(p => {
                const idCandidates = [
                    this._phone(p.id),
                    this._phone(p.lid),
                    this._phone(p.jid),
                    this._phone(p.phoneNumber),
                ].filter(Boolean);
                return idCandidates.some(pNum =>
                    candidates.some(cNum => pNum === cNum || this._numMatch(pNum, cNum))
                );
            });
            return p ? (p.admin === 'admin' || p.admin === 'superadmin') : false;
        } catch { return false; }
    }

    // ── Bot admin check ───────────────────────────────────────────────────────
    async isBotAdmin(groupJid) {
        try {
            const meta = await this.bot.sock.groupMetadata(groupJid);
            const botCandidates = [
                this._phone(this.bot.sock.user?.id),
                this._phone(this.bot.sock.user?.lid),
            ].filter(Boolean);

            const p = meta.participants.find(p => {
                const idCandidates = [
                    this._phone(p.id),
                    this._phone(p.lid),
                    this._phone(p.jid),
                    this._phone(p.phoneNumber),
                ].filter(Boolean);
                return idCandidates.some(pNum =>
                    botCandidates.some(cNum => pNum === cNum || this._numMatch(pNum, cNum))
                );
            });
            return p ? (p.admin === 'admin' || p.admin === 'superadmin') : false;
        } catch { return false; }
    }
}

module.exports = Permission;
