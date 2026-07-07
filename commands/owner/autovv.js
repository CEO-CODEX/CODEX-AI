const fs   = require('fs-extra');
const path = require('path');

const DB   = path.join(process.cwd(), 'database', 'autovv.json');
const load = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return { mode: 'off' }; } };
const save = (d) => fs.writeFileSync(DB, JSON.stringify(d, null, 2));

module.exports = {
    name: 'autovv',
    aliases: ['avv'],
    category: 'owner',
    ownerOnly: true,
    description: 'Auto-decrypt view-once messages. Modes: off / vv (reveal in chat) / vvp (send to owner DM)',

    async execute(bot, m, args) {
        const db  = load();
        const sub = args[0]?.toLowerCase();
        const p   = bot.prefix;

        if (!sub) return await m.reply(
`x *AUTO VV*
x Mode: ${db.mode.toUpperCase()}

x ${p}autovv off   — disabled
x ${p}autovv vv    — reveal view-once in chat
x ${p}autovv vvp   — send view-once to owner DM silently`
        );

        if (!['off', 'vv', 'vvp'].includes(sub))
            return await m.reply('x Invalid mode. Use: off / vv / vvp');

        db.mode = sub;
        save(db);

        const msgs = {
            off: 'x Auto VV: *OFF*',
            vv:  'x Auto VV: *ON* — revealing view-once in chat',
            vvp: 'x Auto VVP: *ON* — sending view-once to owner DM silently',
        };
        await m.reply(msgs[sub]);
    }
};
