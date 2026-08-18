const fs   = require('fs-extra');
const path = require('path');

// Same file setwelcome.js / setgoodbye.js already use — "one file, all group
// event config". This command only ever merges new fields into it, never
// touches welcomeEnabled/goodbyeEnabled/welcome/goodbye directly except when
// `.events on/off` intentionally includes them (per spec: those two already
// have their own dedicated commands, but `.events on` still switches them on
// too, since it's meant to be the single "turn everything basic on" switch).
const DB     = path.join(process.cwd(), 'database/groupEvents.json');
const readDB = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveDB = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

// Maps a normalized (lowercased, spaces/hyphens stripped) sub-feature name
// to its field in groupEvents.json. Accepts a few spellings/spacings —
// "antiinvaid-promotion" / "antiinvaid promotion" / "antiinvaidpromotion"
// should all work the same.
const FIELD = {
    promote:               'promoteEnabled',
    demote:                'demoteEnabled',
    antipromote:            'antipromoteEnabled',
    antidemote:             'antidemoteEnabled',
    antiinvaidpromotion:   'antiInvaidPromotionEnabled',
    antiinvaiddemotion:    'antiInvaidDemotionEnabled',
    invaidpromotion:       'antiInvaidPromotionEnabled',
    invaiddemotion:        'antiInvaidDemotionEnabled',
};

const LABEL = {
    welcomeEnabled:               'Welcome message',
    goodbyeEnabled:                'Goodbye message',
    promoteEnabled:                'Promote announcement',
    demoteEnabled:                 'Demote announcement',
    antipromoteEnabled:            'Anti-Promote',
    antidemoteEnabled:             'Anti-Demote',
    antiInvaidPromotionEnabled:   'Anti-Invaid-Promotion',
    antiInvaidDemotionEnabled:    'Anti-Invaid-Demotion',
};

module.exports = {
    name: 'events',
    aliases: ['event'],
    category: 'admin',
    reactions: { start: '👀', success: '📝' },
    description:
        'Group events configuration — welcome/goodbye, promote/demote announcements, ' +
        'and anti-promote/anti-demote/anti-invaid-promotion/anti-invaid-demotion.',
    adminOnly: true,
    groupOnly: true,

    async execute(bot, m, args) {
        const jid = m.chat;
        const db  = readDB();
        const cfg = db[jid] || {};
        const P   = bot.prefix;

        const save = (fields) => {
            db[jid] = Object.assign({}, db[jid] || {}, fields);
            saveDB(db);
        };

        const last = (args[args.length - 1] || '').toLowerCase();
        const state = ['on', 'off', 'status'].includes(last) ? last : null;
        const keyParts = state ? args.slice(0, -1) : args;
        const key = keyParts.join('').toLowerCase().replace(/[^a-z]/g, '');

        // ── .events / .events status — full summary ─────────────────────
        if (!args.length || (key === '' && state === 'status')) {
            const line = (field) => {
                const on = field === 'welcomeEnabled'
                    ? (cfg.welcomeEnabled ?? (bot.config.welcome !== false))
                    : field === 'goodbyeEnabled'
                        ? (cfg.goodbyeEnabled ?? (bot.config.goodbye !== false))
                        : !!cfg[field];
                return `${LABEL[field]}: ${on ? '✅ ON' : '❌ OFF'}`;
            };
            return m.reply(
`📋 *Group Events — Status*

${line('welcomeEnabled')}
${line('goodbyeEnabled')}
${line('promoteEnabled')}
${line('demoteEnabled')}
${line('antipromoteEnabled')}
${line('antidemoteEnabled')}
${line('antiInvaidPromotionEnabled')}
${line('antiInvaidDemotionEnabled')}

*Commands:*
${P}events on / off        — welcome, goodbye, promote & demote announcements
${P}events promote on/off
${P}events demote on/off
${P}events antipromote on/off
${P}events antidemote on/off
${P}events antiinvaid-promotion on/off
${P}events antiinvaid-demotion on/off
${P}events status`
            );
        }

        // ── .events on / .events off — the 4 base toggles ───────────────
        if (key === '' && (state === 'on' || state === 'off')) {
            const enabled = state === 'on';
            save({
                welcomeEnabled: enabled,
                goodbyeEnabled: enabled,
                promoteEnabled: enabled,
                demoteEnabled:  enabled,
            });
            return m.reply(
                `${enabled ? '✅' : '❌'} Events *${enabled ? 'ENABLED' : 'DISABLED'}*: welcome, goodbye, promote & demote announcements.\n` +
                `(anti-promote / anti-demote / anti-invaid-promotion / anti-invaid-demotion are separate — use ${P}events <name> on)`
            );
        }

        // ── .events <name> on/off — individual toggle ────────────────────
        const field = FIELD[key];
        if (field && (state === 'on' || state === 'off')) {
            const enabled = state === 'on';
            save({ [field]: enabled });
            return m.reply(`${enabled ? '✅' : '❌'} ${LABEL[field]} *${enabled ? 'ENABLED' : 'DISABLED'}* for this group.`);
        }

        if (field && state === 'status') {
            return m.reply(`${LABEL[field]}: ${cfg[field] ? '✅ ON' : '❌ OFF'}`);
        }

        return m.reply(
            `Unknown option. Try:\n${P}events status\n${P}events on / off\n` +
            `${P}events promote on/off\n${P}events demote on/off\n` +
            `${P}events antipromote on/off\n${P}events antidemote on/off\n` +
            `${P}events antiinvaid-promotion on/off\n${P}events antiinvaid-demotion on/off`
        );
    }
};
                             
