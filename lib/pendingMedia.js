/**
 * pendingMedia — tracks a "what should I do with this?" choice while CODEX AI
 * waits for the user's next message (describe / sticker / gif / yes for song-ID).
 * In-memory only, keyed by `${chat}:${sender}`, auto-expires after 5 minutes.
 */
const store = new Map();
const TTL_MS = 5 * 60 * 1000;

function set(key, value) {
    store.set(key, { ...value, expires: Date.now() + TTL_MS });
}

function get(key) {
    const v = store.get(key);
    if (!v) return null;
    if (Date.now() > v.expires) { store.delete(key); return null; }
    return v;
}

function clear(key) {
    store.delete(key);
}

module.exports = { set, get, clear };
