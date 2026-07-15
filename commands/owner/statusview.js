const fs = require('fs-extra');
const path = require('path');

const DB = path.join(process.cwd(), 'database/variables.json');

const getVar = (key, def = null) => {
  try {
    const vars = JSON.parse(fs.readFileSync(DB, 'utf8'));
    return vars[key] !== undefined ? vars[key] : def;
  } catch {
    return def;
  }
};

const setVar = (key, value) => {
  try {
    fs.ensureDirSync(path.dirname(DB));
    let vars = {};
    try {
      vars = JSON.parse(fs.readFileSync(DB, 'utf8'));
    } catch {}
    vars[key] = value;
    fs.writeFileSync(DB, JSON.stringify(vars, null, 2));
    return true;
  } catch (err) {
    console.error('[setVar]', err.message);
    return false;
  }
};

module.exports = {
    name: 'statusview',
    aliases: ['sv', 'statusreact', 'sr'],
    category: 'owner',
    ownerOnly: true,
    description: 'Toggle auto status view / react and set reaction emoji',

    async execute(bot, m, { args, reply, prefix }) {
        const sub = args[0]?.toLowerCase();
        const p   = prefix;

        if (!sub) {
            const viewOn  = getVar('STATUS_VIEW', false);
            const reactOn = getVar('STATUS_REACT', false);
            const emoji   = getVar('STATUS_EMOJI', 'random');
            return await reply(
`╭─❍ *STATUS VIEW & REACT*
│
│ Auto View    : *${viewOn  ? 'ON ✓' : 'OFF ✗'}*
│ Auto React   : *${reactOn ? 'ON ✓' : 'OFF ✗'}*
│ React Emoji  : *${emoji}*
│
│ Commands:
│ ${p}statusview on           — enable auto view
│ ${p}statusview off          — disable auto view
│ ${p}statusview react on     — enable auto react
│ ${p}statusview react off    — disable auto react
│ ${p}statusview emoji <e>    — set reaction emoji (or "random")
╰──────────────────`
            );
        }

        // .statusview on / off  → controls autoView
        if (sub === 'on' || sub === 'off') {
            setVar('STATUS_VIEW', sub === 'on');
            return await reply(`\`✓ Status View : *${sub.toUpperCase()}*\``);
        }

        // .statusview react on / off
        if (sub === 'react') {
            const v = args[1]?.toLowerCase();
            if (!v) return await reply(`_⚉ ${p}statusview react on|off_`);
            setVar('STATUS_REACT', v === 'on');
            return await reply(`\`✓ Status React : *${v === 'on' ? 'ON' : 'OFF'}*\``);
        }

        // .statusview emoji 🔥  /  .statusview emoji random
        if (sub === 'emoji') {
            const sign = args[1];
            if (!sign) return await reply(`_⚉ ${p}statusview emoji <emoji or "random">_`);
            setVar('STATUS_EMOJI', sign);
            return await reply(`\`✓ Status React Emoji : ${sign}\``);
        }

        await reply(`_⚉ Unknown. Use ${p}statusview for help._`);
    }
};
