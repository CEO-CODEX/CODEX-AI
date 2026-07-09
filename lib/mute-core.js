/**
 * mute-core — node-cron based mute/unmute scheduler (CRYSNOVA pattern).
 *
 * Stores all pending jobs in database/muteSchedules.json so they survive
 * bot restarts. node-cron checks every minute — worst-case firing delay is
 * 60 seconds, which is fine for mute durations of minutes through 7+ days.
 *
 * Supported duration formats: 10s / 10m / 1h / 1d / 1w (up to 7w or more)
 */
const cron   = require('node-cron');
const fs     = require('fs-extra');
const path   = require('path');

const DB = path.join(process.cwd(), 'database/muteSchedules.json');
const readDB = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveDB = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };
const genId  = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

let _bot = null;

// ── Time helpers ──────────────────────────────────────────────────────────────
function parseTime(str) {
    if (!str) return null;
    const match = String(str).trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days|w|week|weeks)$/i);
    if (!match) return null;
    const n = parseFloat(match[1]);
    const u = match[2].toLowerCase();
    if (u.startsWith('w')) return Math.round(n * 604800000);
    if (u.startsWith('d')) return Math.round(n * 86400000);
    if (u.startsWith('h')) return Math.round(n * 3600000);
    if (u.startsWith('m')) return Math.round(n * 60000);
    if (u.startsWith('s')) return Math.round(n * 1000);
    return null;
}

function humanize(ms) {
    if (!ms || ms <= 0) return '0s';
    if (ms >= 604800000) {
        const w = Math.floor(ms / 604800000);
        const rem = ms % 604800000;
        return rem >= 86400000 ? `${w}w ${Math.floor(rem / 86400000)}d` : `${w}w`;
    }
    if (ms >= 86400000) {
        const d = Math.floor(ms / 86400000);
        const rem = ms % 86400000;
        return rem >= 3600000 ? `${d}d ${Math.floor(rem / 3600000)}h` : `${d}d`;
    }
    if (ms >= 3600000) {
        const h = Math.floor(ms / 3600000);
        const rem = ms % 3600000;
        return rem >= 60000 ? `${h}h ${Math.floor(rem / 60000)}m` : `${h}h`;
    }
    if (ms >= 60000) {
        const m = Math.floor(ms / 60000);
        const rem = ms % 60000;
        return rem >= 1000 ? `${m}m ${Math.floor(rem / 1000)}s` : `${m}m`;
    }
    return `${Math.round(ms / 1000)}s`;
}

// ── Job management ────────────────────────────────────────────────────────────
/**
 * Schedule a mute-related job.
 * type: 'muteuser' | 'unmuteuser' | 'mutesticker' | 'unmutesticker'
 */
function schedule({ type, chat, target, expiresAt, mutedBy }) {
    const id  = genId();
    const db  = readDB();
    db[id] = { id, type, chat, target, expiresAt, mutedBy, createdAt: Date.now() };
    saveDB(db);
    return id;
}

/** Cancel all pending jobs of `type` for a specific `target` in `chat`. */
function cancel({ type, chat, target }) {
    const db = readDB();
    for (const id of Object.keys(db)) {
        const j = db[id];
        if (j.type === type && j.chat === chat && j.target === target) {
            delete db[id];
        }
    }
    saveDB(db);
}

/** Cancel ALL pending mute-related jobs for a target in a chat. */
function cancelAll({ chat, target }) {
    const db = readDB();
    for (const id of Object.keys(db)) {
        const j = db[id];
        if (j.chat === chat && j.target === target) delete db[id];
    }
    saveDB(db);
}

// ── Execution ─────────────────────────────────────────────────────────────────
async function _run(job) {
    if (!_bot) return;
    const muteStore = require('./muteStore');
    const tag = `@${job.target.split('@')[0]}`;

    switch (job.type) {
        case 'unmuteuser':
            muteStore.clearMute(job.target);
            await _bot.sendMessage(job.chat, { text: `🔊 ${tag} has been unmuted — timer expired.`, mentions: [job.target] }).catch(() => {});
            break;
        case 'muteuser':
            muteStore.setMute(job.target, { stickersOnly: false, mutedBy: job.mutedBy, chat: job.chat, mutedAt: Date.now() });
            await _bot.sendMessage(job.chat, { text: `🔇 ${tag} has been muted (scheduled).`, mentions: [job.target] }).catch(() => {});
            break;
        case 'unmutesticker':
            muteStore.clearMute(job.target);
            await _bot.sendMessage(job.chat, { text: `✅ ${tag}'s stickers are unblocked — timer expired.`, mentions: [job.target] }).catch(() => {});
            break;
        case 'mutesticker':
            muteStore.setMute(job.target, { stickersOnly: true, mutedBy: job.mutedBy, chat: job.chat, mutedAt: Date.now() });
            await _bot.sendMessage(job.chat, { text: `🚫 ${tag}'s stickers are blocked (scheduled).`, mentions: [job.target] }).catch(() => {});
            break;
    }
}

async function _sweep() {
    const db  = readDB();
    const now = Date.now();
    let changed = false;
    for (const id of Object.keys(db)) {
        const job = db[id];
        if (job.expiresAt && job.expiresAt <= now) {
            delete db[id];
            changed = true;
            try { await _run(job); } catch (e) { console.error('[mute-core] job failed:', e.message); }
        }
    }
    if (changed) saveDB(db);
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init(bot) {
    _bot = bot;
    // Run immediately to catch anything overdue from before a restart
    _sweep().catch(() => {});
    // Then every minute
    cron.schedule('* * * * *', () => _sweep().catch(() => {}));
}

module.exports = { parseTime, humanize, schedule, cancel, cancelAll, init };
