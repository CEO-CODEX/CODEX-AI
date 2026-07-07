/**
 * Entry point — safe for hosts that hardcode `node index.js` or `npm start`.
 *
 * Baileys v7+ is ESM-only, so it can't be `require()`d directly from our
 * CommonJS code. We load it ONCE here via the CJS↔ESM bridge
 * (lib/baileys.js → dynamic import), THEN require the actual bot body (app.js).
 * app.js and every module it pulls in destructure Baileys synchronously from the
 * shim, which is fully populated by the time they load.
 *
 * The real application lives in app.js — this file is only the loader.
 */
(async () => {
    try {
        await require('./lib/baileys').__load();   // populate the Baileys shim first
        require('./app.js');                        // app.js self-starts bot.start()
    } catch (err) {
        console.error('Fatal: failed to load Baileys / boot:', err);
        process.exit(1);
    }
})();
