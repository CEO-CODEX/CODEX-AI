/**
 * scheduler — persisted, restart-safe timer system for delayed/auto-revert
 * group actions (lock/unlock, mute/unmute, sticker-mute/unmute).
 *
 * Why not plain setTimeout: an in-memory timer is gone the moment the bot
 * process restarts, silently breaking "accurate" timers. This persists every
 * scheduled job to disk, keeps a live setTimeout for the common case (precise
 * to the millisecond while the process stays up), AND runs a periodic sweep
 * (every 15s) that catches any job whose time came due while the process was
 * offline or the in-memory timer was otherwise lost — so a restart delays a
 * job by at most ~15s instead of losing it entirely.
 */
const fs   = require('fs-extra');
const path = require('path');

const DB = path.join(process.cwd(), 'database/scheduledJobs.json');
const _timeouts = new Map(); // jobId -> Node timeout handle (in-memory fast path)
let _bot = null;
let _sweepInterval = null;

const readDB  = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveDB  = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };
const genId   = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** type: 'lock'|'unlock'|'muteuser'|'unmuteuser'|'mutesticker'|'unmutesticker' */
function schedule({ type, dueAt, chat, target = null, issuedBy = null }) {
    const id  = genId();
    const job = { id, type, dueAt, chat, target, issuedBy, createdAt: Date.now() };
    const db  = readDB();
    db[id] = job;
    saveDB(db);
    _armTimeout(job);
    return job;
}

/** Cancels every pending job of `type` for `chat` (and `target`, if given). Returns count cancelled. */
function cancelMatching({ type, chat, target = null }) {
    const db = readDB();
    let count = 0;
    for (const id of Object.keys(db)) {
        const j = db[id];
        if (j.chat === chat && j.type === type && (target === null || j.target === target)) {
            _clearTimeout(id);
            delete db[id];
            count++;
        }
    }
    saveDB(db);
    return count;
}

function _clearTimeout(id) {
    const h = _timeouts.get(id);
    if (h) { clearTimeout(h); _timeouts.delete(id); }
}

function _armTimeout(job) {
    _clearTimeout(job.id);
    const delay = job.dueAt - Date.now();
    // setTimeout has a max safe delay (~24.8 days); our use cases are short,
    // but cap defensively rather than overflow into an immediate fire.
    const capped = Math.min(Math.max(delay, 0), 2147483647);
    const handle = setTimeout(() => _runJob(job.id).catch(e => console.error('[scheduler]', e.message)), capped);
    _timeouts.set(job.id, handle);
}

async function _runJob(id) {
    const db  = readDB();
    const job = db[id];
    if (!job) return; // already cancelled/run
    delete db[id];
    saveDB(db);
    _clearTimeout(id);

    if (!_bot || !_bot.sock) return; // not connected yet — sweep will retry once connected
    try {
        await _execute(job);
    } catch (e) {
        console.error(`[scheduler] job ${job.type} failed:`, e.message);
    }
}

async function _execute(job) {
    const bot = _bot;
    switch (job.type) {
        case 'lock':
            await bot.sock.groupSettingUpdate(job.chat, 'announcement');
            await bot.sendMessage(job.chat, { text: '🔒 *Group locked* (scheduled) — only admins can send messages.' }).catch(() => {});
            break;
        case 'unlock':
            await bot.sock.groupSettingUpdate(job.chat, 'not_announcement');
            await bot.sendMessage(job.chat, { text: '🔓 *Group unlocked* — timer expired.' }).catch(() => {});
            break;
        case 'muteuser': {
            const { setMute } = require('./muteStore');
            setMute(job.target, { stickersOnly: false, mutedBy: job.issuedBy, chat: job.chat, mutedAt: Date.now() });
            await bot.sendMessage(job.chat, { text: `🔇 @${job.target.split('@')[0]} has been muted (scheduled).`, mentions: [job.target] }).catch(() => {});
            break;
        }
        case 'unmuteuser': {
            const { clearMute } = require('./muteStore');
            clearMute(job.target);
            await bot.sendMessage(job.chat, { text: `🔊 @${job.target.split('@')[0]} has been unmuted — timer expired.`, mentions: [job.target] }).catch(() => {});
            break;
        }
        case 'mutesticker': {
            const { setMute } = require('./muteStore');
            setMute(job.target, { stickersOnly: true, mutedBy: job.issuedBy, chat: job.chat, mutedAt: Date.now() });
            await bot.sendMessage(job.chat, { text: `🚫 @${job.target.split('@')[0]}'s stickers are now blocked (scheduled).`, mentions: [job.target] }).catch(() => {});
            break;
        }
        case 'unmutesticker': {
            const { clearMute } = require('./muteStore');
            clearMute(job.target);
            await bot.sendMessage(job.chat, { text: `✅ @${job.target.split('@')[0]}'s stickers are unblocked — timer expired.`, mentions: [job.target] }).catch(() => {});
            break;
        }
    }
}

/** Call once, right after the socket connects. Re-arms all pending jobs and sweeps anything overdue. */
function init(bot) {
    _bot = bot;
    const db = readDB();
    const now = Date.now();
    for (const job of Object.values(db)) {
        if (job.dueAt <= now) {
            _runJob(job.id).catch(e => console.error('[scheduler] overdue job failed:', e.message));
        } else {
            _armTimeout(job);
        }
    }
    if (_sweepInterval) clearInterval(_sweepInterval);
    _sweepInterval = setInterval(() => {
        const cur = readDB();
        const t = Date.now();
        for (const job of Object.values(cur)) {
            if (job.dueAt <= t) _runJob(job.id).catch(e => console.error('[scheduler] sweep job failed:', e.message));
        }
    }, 15000);
}

module.exports = { schedule, cancelMatching, init };
