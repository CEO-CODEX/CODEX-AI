/** Parses "10m", "1h", "30s", "1h30m" etc into milliseconds. Returns null if no match. */
function parseDuration(str) {
    if (!str) return null;
    const re = /(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)/gi;
    let total = 0, matched = false;
    let m;
    while ((m = re.exec(str)) !== null) {
        matched = true;
        const n = parseInt(m[1], 10);
        const unit = m[2].toLowerCase();
        if (unit.startsWith('h')) total += n * 3600000;
        else if (unit.startsWith('m')) total += n * 60000;
        else if (unit.startsWith('s')) total += n * 1000;
    }
    return matched ? total : null;
}

function humanizeMs(ms) {
    const totalSec = Math.round(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const parts = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (s && !h) parts.push(`${s}s`);
    return parts.join(' ') || '0s';
}

/**
 * Splits "<duration>" or "after <duration>" out of an args array.
 * Returns { isAfter, ms, rest } where `rest` is args with the duration
 * tokens removed (e.g. so a target mention/tag is left intact).
 * `isAfter` = true means "do the action AFTER this delay" (delayed action),
 * false means "do the action now, FOR this duration" (auto-revert timer).
 */
function extractDuration(args) {
    const joined = args.join(' ').trim();
    const afterMatch = joined.match(/\bafter\s+(.+)$/i);
    if (afterMatch) {
        const ms = parseDuration(afterMatch[1]);
        const rest = joined.slice(0, afterMatch.index).trim().split(/\s+/).filter(Boolean);
        return { isAfter: true, ms, rest };
    }
    // No "after" — try to find a trailing duration-looking token and treat it
    // as a "for this long" timer instead.
    const durMatch = joined.match(/(\d+\s*(?:h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds))\s*$/i);
    if (durMatch) {
        const ms = parseDuration(durMatch[1]);
        const rest = joined.slice(0, durMatch.index).trim().split(/\s+/).filter(Boolean);
        return { isAfter: false, ms, rest };
    }
    return { isAfter: false, ms: null, rest: args };
}

module.exports = { parseDuration, humanizeMs, extractDuration };
