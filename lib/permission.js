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

    // ── Mod check (config.mods array) ─────────────────────────────────────────
    isMod(jid) {
        if (this.isOwner(jid)) return true;
        const senderNum = this._phone(jid);
        return (this.bot.config.mods || []).some(m => {
            const mNum = this._phone(m);
            return mNum && (senderNum === mNum || this._numMatch(senderNum, mNum));
        });
    }

    // ── Sudo check (database/sudo.json + config.sudo array) ──────────────────
    // NOTE: sudo is intentionally NOT a superset of mod — they're separate
    // elevated tiers (see isMod for that). Sudo gets its own bypass for
    // `sudoOnly` commands; mod does not bypass `ownerOnly`/`sudoOnly` at all.
    isSudo(jid) {
        const senderNum = this._phone(jid);
        if (!senderNum) return false;
        if (this.isOwner(jid)) return true;

        // Check sudo.json DB (written by .sudo add / sudo.js command)
        let sudoData = {};
        try { sudoData = JSON.parse(fs.readFileSync('./database/sudo.json', 'utf8')); } catch {}

        // DB format: { users: ['2349...', ...] }  OR legacy { '2349...': true }
        const users = Array.isArray(sudoData.users)
            ? sudoData.users
            : Object.keys(sudoData);

        const inDB = users.some(k => {
            const kNum = this._phone(k);
            return kNum && (senderNum === kNum || this._numMatch(senderNum, kNum));
        });
        if (inDB) return true;

        // Also check config.sudo array (legacy / static list)
        return (this.bot.config.sudo || []).some(s => {
            const sNum = this._phone(s);
            return sNum && (senderNum === sNum || this._numMatch(senderNum, sNum));
        });
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
