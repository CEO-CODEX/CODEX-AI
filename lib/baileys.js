/**
 * CJS ↔ ESM bridge for @crysnovax/baileys.
 *
 * Baileys v7+ ships as ESM-only, so `require('@crysnovax/baileys')` throws
 * ERR_REQUIRE_ESM. Rather than convert the whole project to ESM (which would
 * break require.cache hot-reload, the dynamic command loader and __dirname),
 * we load Baileys ONCE via dynamic import() and copy its exports onto this
 * shared object.
 *
 * IMPORTANT: every consumer does `require('.../lib/baileys')` and gets THIS same
 * object. We mutate it in place (Object.assign) and never reassign module.exports,
 * so once __load() has run, all destructures resolve to the real exports.
 *
 * index.js MUST call `await require('./lib/baileys').__load()` BEFORE requiring
 * app.js (or anything that pulls in Baileys). app.js does the actual booting, so
 * the load order is: index.js → __load() → require('./app.js').
 *
 * Works for both module shapes:
 *   • CJS (Baileys ≤6.7): import() puts the whole module.exports on ns.default
 *   • ESM (Baileys v7+):  named exports live on ns.*, makeWASocket may be default
 */
const shim = {};
let loaded = false;

shim.__load = async () => {
    if (loaded) return shim;
    const ns = await import('@crysnovax/baileys');

    // CJS interop: dynamic import of a CommonJS module exposes the real
    // module.exports (containing every helper) as ns.default — copy it first.
    if (ns.default && typeof ns.default === 'object') Object.assign(shim, ns.default);

    // ESM named exports (getContentType, downloadContentFromMessage, proto, …)
    // overlay on top so they win if both forms are present.
    Object.assign(shim, ns);

    // makeWASocket is the default export in some versions, a named one in others.
    // Guarantee it is reachable as shim.makeWASocket regardless.
    if (!shim.makeWASocket && typeof ns.default === 'function') shim.makeWASocket = ns.default;
    if (!shim.default) shim.default = ns.default;

    loaded = true;
    return shim;
};

module.exports = shim;
