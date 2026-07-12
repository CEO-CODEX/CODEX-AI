/**
 * mute-core — Unified scheduler for ALL timed group actions.
 * 
 * Persistence: everything lives in JSON files, so restarts are safe.
 * Engine: node-cron sweeps every 10 seconds (not just 1 minute).
 *         This gives ±10s accuracy — fine for mutes lasting minutes to 7+ days.
 * 
 * Warning system: at 5 seconds before any action, sends a countdown notice
 *   - Group actions (mute/unmute): tags @all
 *   - User actions (muteuser/mutesticker): tags the specific user
 * 
 * Types (one-time jobs): muteGroup | unmuteGroup | muteUser | unmuteUser | muteStickerUser | unmuteStickerUser
 * Types (recurring):     sch-muteGroup | sch-unmuteGroup | sch-muteUser | sch-unmuteUser
 */
const cron      = require('node-cron');
const fs        = require('fs-extra');
const path      = require('path');

const JOBS_DB       = path.join(process.cwd(), 'database/muteSchedules.json');
const RECURRING_DB  = path.join(process.cwd(), 'database/recurringSchedules.json');

const readJobs  = () => { try { return JSON.parse(fs.readFileSync(JOBS_DB, 'utf8')); } catch { return {}; } };
const saveJobs  = (d) => { fs.ensureDirSync(path.dirname(JOBS_DB)); fs.writeFileSync(JOBS_DB, JSON.stringify(d, null, 2)); };
const readRec   = () => { try { return JSON.parse(fs.readFileSync(RECURRING_DB, 'utf8')); } catch { return {}; } };
const saveRec   = (d) => { fs.ensureDirSync(path.dirname(RECURRING_DB)); fs.writeFileSync(RECURRING_DB, JSON.stringify(d, null, 2)); };

const genId     = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

let _bot          = null;
let _warnTimers   = new Map();   // jobId -> setTimeout handle for 5s warning
let _cronStarted  = false;
let _recurringCrons = new Map(); // recurringId -> [cronJob, cronJob]

// ── Time helpers ──────────────────────────────────────────────────────────────
function parseTime(str) {
    if (!str) return null;
    const match = String(str).trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days|w|week|weeks)$/i);
    if (!match) return null;
    const n = parseFloat(match[1]);
    const u = match[2][0].toLowerCase();
    return Math.round(n * { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[u]);
}

function humanize(ms) {
    if (!ms || ms <= 0) return '0s';
    if (ms >= 604800000) { const w = Math.floor(ms / 604800000), r = ms % 604800000; return r >= 86400000 ? `${w}w ${Math.floor(r / 86400000)}d` : `${w}w`; }
    if (ms >= 86400000)  { const d = Math.floor(ms / 86400000),  r = ms % 86400000;  return r >= 3600000  ? `${d}d ${Math.floor(r / 3600000)}h`  : `${d}d`; }
    if (ms >= 3600000)   { const h = Math.floor(ms / 3600000),   r = ms % 3600000;   return r >= 60000    ? `${h}h ${Math.floor(r / 60000)}m`    : `${h}h`; }
    if (ms >= 60000)     { const m = Math.floor(ms / 60000),     r = ms % 60000;     return r >= 1000     ? `${m}m ${Math.floor(r / 1000)}s`     : `${m}m`; }
    return `${Math.round(ms / 1000)}s`;
}

/** Parse "1am", "6:30pm", "23:00" → { hour, minute } or null */
function parseTimeOfDay(str) {
    if (!str) return null;
    str = str.trim().toLowerCase();
    const m12 = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (m12) {
        let h = parseInt(m12[1], 10), min = parseInt(m12[2] || '0', 10);
        if (m12[3] === 'pm' && h !== 12) h += 12;
        if (m12[3] === 'am' && h === 12) h = 0;
        return { hour: h, minute: min };
    }
    const m24 = str.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) return { hour: parseInt(m24[1], 10), minute: parseInt(m24[2], 10) };
    return null;
}

/** Build a cron expression for a specific time each day: "30 6 * * *" */
function toCronExpr({ hour, minute }) {
    return `${minute} ${hour} * * *`;
}

// ── Group mention helper ──────────────────────────────────────────────────────
async function _allMentions(chat) {
    try {
        const meta = await _bot.sock.groupMetadata(chat);
        return meta.participants.map(p => p.id || p.jid).filter(Boolean);
    } catch { return []; }
}

// ── Job execution ─────────────────────────────────────────────────────────────
async function _execute(job, isWarning = false) {
    if (!_bot || !_bot.sock) return;
    const muteStore = require('./muteStore');
    const chat      = job.chat;

    // Source-based label for completion messages
    const label = job.source === 'schedule' ? '_(scheduled action)_'
                : job.source === 'delayed'  ? '_(delayed action)_'
                : '_(timed action)_';

    if (isWarning) {
        // 5-second warning — mentions everyone (group) or the specific user
        const mentions = job.target ? [job.target] : await _allMentions(chat);
        const who = job.target ? `@${job.target.split('@')[0]}` : '';
        const action = {
            muteGroup:         '⚠️ _Group will be muted in 5 seconds..._',
            unmuteGroup:       '⚠️ _Group will be unmuted in 5 seconds..._',
            muteUser:          `⚠️ _${who} will be muted in 5 seconds..._`,
            unmuteUser:        `⚠️ _${who} will be unmuted in 5 seconds..._`,
            muteStickerUser:   `⚠️ _${who}'s stickers will be blocked in 5 seconds..._`,
            unmuteStickerUser: `⚠️ _${who}'s stickers will be unblocked in 5 seconds..._`,
        }[job.type] || '⚠️ _Action in 5 seconds..._';
        await _bot.sendMessage(chat, { text: action, mentions }).catch(() => {});
        return;
    }

    // Execute the actual action
    switch (job.type) {
        case 'muteGroup':
            try { await _bot.sock.groupSettingUpdate(chat, 'announcement'); } catch {}
            const muteM = await _allMentions(chat);
            await _bot.sendMessage(chat, { text: `_Group auto-muted ${label}_`, mentions: muteM }).catch(() => {});
            break;

        case 'unmuteGroup':
            try { await _bot.sock.groupSettingUpdate(chat, 'not_announcement'); } catch {}
            const unmuteM = await _allMentions(chat);
            await _bot.sendMessage(chat, { text: `_Group auto-unmuted ${label}_`, mentions: unmuteM }).catch(() => {});
            break;

        case 'muteUser':
            muteStore.setMute(job.target, { stickersOnly: false, mutedBy: job.mutedBy, chat, mutedAt: Date.now() });
            await _bot.sendMessage(chat, { text: `_@${job.target.split('@')[0]} has been muted ${label}_`, mentions: [job.target] }).catch(() => {});
            break;

        case 'unmuteUser':
            muteStore.clearMute(job.target);
            await _bot.sendMessage(chat, { text: `_@${job.target.split('@')[0]} has been unmuted ${label}_`, mentions: [job.target] }).catch(() => {});
            break;

        case 'muteStickerUser':
            muteStore.setMute(job.target, { stickersOnly: true, mutedBy: job.mutedBy, chat, mutedAt: Date.now() });
            await _bot.sendMessage(chat, { text: `_@${job.target.split('@')[0]}'s stickers are blocked ${label}_`, mentions: [job.target] }).catch(() => {});
            break;

        case 'unmuteStickerUser':
            muteStore.clearMute(job.target);
            await _bot.sendMessage(chat, { text: `_@${job.target.split('@')[0]}'s stickers are unblocked ${label}_`, mentions: [job.target] }).catch(() => {});
            break;
    }
}

// ── Warning timer (5s before action) ─────────────────────────────────────────
function _armWarning(job) {
    const delay = job.expiresAt - Date.now() - 5000;
    if (delay <= 0 || delay > 7 * 24 * 3600 * 1000) return; // skip if already < 5s away or > 7d
    const h = setTimeout(async () => {
        _warnTimers.delete(job.id);
        if (!_bot) return;
        const jobs = readJobs();
        if (!jobs[job.id]) return; // was cancelled
        await _execute(job, true);
    }, delay);
    _warnTimers.set(job.id, h);
}

function _clearWarning(id) {
    const h = _warnTimers.get(id);
    if (h) { clearTimeout(h); _warnTimers.delete(id); }
}

// ── One-time job management ───────────────────────────────────────────────────
function schedule({ type, chat, target = null, expiresAt, mutedBy = null }) {
    const id  = genId();
    const job = { id, type, chat, target, expiresAt, mutedBy, createdAt: Date.now() };
    const db  = readJobs();
    db[id]    = job;
    saveJobs(db);
    _armWarning(job);
    return id;
}

function cancel({ type, chat, target = null }) {
    const db = readJobs();
    for (const id of Object.keys(db)) {
        const j = db[id];
        if (j.type === type && j.chat === chat && (target === null || j.target === target)) {
            _clearWarning(id);
            delete db[id];
        }
    }
    saveJobs(db);
}

function cancelAll({ chat, target = null }) {
    const db = readJobs();
    for (const id of Object.keys(db)) {
        const j = db[id];
        if (j.chat === chat && (target === null || j.target === target)) {
            _clearWarning(id);
            delete db[id];
        }
    }
    saveJobs(db);
}

// ── Recurring schedule management ─────────────────────────────────────────────
/**
 * addRecurring({ chat, target, mutedBy, type, timeFrom, timeTo })
 * type: 'sch-muteGroup' | 'sch-unmuteGroup' | 'sch-muteUser' | 'sch-unmuteUser'
 * timeFrom/timeTo: { hour, minute }
 * 
 * e.g. .sch -mute 1am to 6am daily → muteGroup at 1am, unmuteGroup at 6am
 */
function addRecurring({ chat, target = null, mutedBy = null, type, timeFrom, timeTo }) {
    const id  = genId();
    const rec = { id, chat, target, mutedBy, type, timeFrom, timeTo, createdAt: Date.now() };
    const db  = readRec();
    db[id]    = rec;
    saveRec(db);
    _startRecurring(rec);
    return id;
}

function cancelRecurring(chat, id = null) {
    const db = readRec();
    for (const rid of Object.keys(db)) {
        const r = db[rid];
        if (r.chat === chat && (id === null || rid === id)) {
            const jobs = _recurringCrons.get(rid);
            if (jobs) { jobs.forEach(j => j.stop()); _recurringCrons.delete(rid); }
            delete db[rid];
        }
    }
    saveRec(db);
}

function listRecurring(chat) {
    const db = readRec();
    return Object.values(db).filter(r => r.chat === chat);
}

function _startRecurring(rec) {
    const fromExpr  = toCronExpr(rec.timeFrom);
    const toExpr    = toCronExpr(rec.timeTo);
    const jobs      = [];

    // Determine what happens at FROM and at TO
    const { fromAction, toAction } = _resolveRecurringActions(rec.type);

    const fromJob = cron.schedule(fromExpr, async () => {
        if (!_bot) return;
        const job = { type: fromAction, chat: rec.chat, target: rec.target, mutedBy: rec.mutedBy, source: 'schedule' };
        await _execute(job, true);
        await new Promise(r => setTimeout(r, 5000));
        await _execute(job, false);
    }, { timezone: 'Africa/Lagos' });

    const toJob = cron.schedule(toExpr, async () => {
        if (!_bot) return;
        const job = { type: toAction, chat: rec.chat, target: rec.target, mutedBy: rec.mutedBy, source: 'schedule' };
        await _execute(job, true);
        await new Promise(r => setTimeout(r, 5000));
        await _execute(job, false);
    }, { timezone: 'Africa/Lagos' });

    jobs.push(fromJob, toJob);
    _recurringCrons.set(rec.id, jobs);
}

function _resolveRecurringActions(type) {
    // Returns what to do at the START time and END time
    switch (type) {
        case 'sch-muteGroup':    return { fromAction: 'muteGroup',         toAction: 'unmuteGroup' };
        case 'sch-unmuteGroup':  return { fromAction: 'unmuteGroup',       toAction: 'muteGroup' };
        case 'sch-muteUser':     return { fromAction: 'muteUser',          toAction: 'unmuteUser' };
        case 'sch-unmuteUser':   return { fromAction: 'unmuteUser',        toAction: 'muteUser' };
        default:                 return { fromAction: type, toAction: type };
    }
}

// ── Sweep (checks every 10s) ──────────────────────────────────────────────────
async function _sweep() {
    if (!_bot) return;
    const db  = readJobs();
    const now = Date.now();
    let changed = false;

    for (const id of Object.keys(db)) {
        const job = db[id];
        if (!job.expiresAt || job.expiresAt > now) continue;
        delete db[id];
        changed = true;
        _clearWarning(id);
        try { await _execute(job, false); } catch (e) { console.error('[mute-core] job failed:', e.message); }
    }
    if (changed) saveJobs(db);
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init(bot) {
    _bot = bot;

    // Sweep immediately to catch overdue jobs from before restart
    _sweep().catch(() => {});

    // Start one-time cron sweep every 10 seconds — only once per process
    if (!_cronStarted) {
        _cronStarted = true;
        cron.schedule('*/10 * * * * *', () => _sweep().catch(() => {}));
    }

    // Re-arm warning timers for pending jobs
    const db = readJobs();
    for (const job of Object.values(db)) {
        if (job.expiresAt && job.expiresAt > Date.now()) _armWarning(job);
    }

    // Re-register all recurring schedules
    const rec = readRec();
    for (const r of Object.values(rec)) {
        if (!_recurringCrons.has(r.id)) _startRecurring(r);
    }
}

module.exports = {
    parseTime, humanize, parseTimeOfDay, toCronExpr,
    schedule, cancel, cancelAll,
    addRecurring, cancelRecurring, listRecurring,
    init
};
    
