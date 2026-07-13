const fs = require('fs-extra');

const AUTOSTATUS_PATH = './database/autostatus.json';
const VARS_PATH = './database/variables.json';

function readJson(p, def) {
    try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
    return def;
}
function writeJson(p, data) {
    fs.ensureDirSync('./database');
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

module.exports = {
    name: 'setstatusemoji',
    aliases: ['statusemoji', 'sse'],
    category: 'owner',
    ownerOnly: true,
    description: 'Set the emoji used when auto-reacting to statuses',

    async execute(bot, m, args) {
        const p = bot.prefix;
        const value = (args[0] || '').trim();

        if (!value) {
            const current =
                bot.config.statusReact?.emoji ||
                readJson(AUTOSTATUS_PATH, {}).reactEmoji ||
                'green heart 💚 (default)';
            return await m.reply(
` 💚 STATUS REACT EMOJI 
 Current : ${current}

 ${p}setstatusemoji 🔥      react with a specific emoji
 ${p}setstatusemoji green   use the WhatsApp green heart 💚
 ${p}setstatusemoji random  random emoji each time
 ${p}setstatusemoji off     stop reacting to statuses`
            );
        }

        if (!bot.config.statusReact) bot.config.statusReact = {};
        const vars = readJson(VARS_PATH, {});
        const autostatus = readJson(AUTOSTATUS_PATH, {});
        const low = value.toLowerCase();

        // Turn status auto-react OFF entirely
        if (low === 'off') {
            bot.config.statusReact.enabled = false;
            autostatus.autoReact = false;
            writeJson(AUTOSTATUS_PATH, autostatus);
            fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));
            return await m.reply('Status auto-react : OFF');
        }

        // Resolve the chosen emoji.
        //   green → clear overrides so the built-in 💚 default is used
        //   random → the literal "random" keyword
        //   anything else → the literal emoji provided
        let chosen;
        if (low === 'green' || low === 'greenheart' || value === '💚') {
            chosen = null; // null → connection.js falls back to the 💚 default
        } else if (low === 'random') {
            chosen = 'random';
        } else {
            chosen = value;
        }

        // Enable status react and persist the emoji to every place the
        // handler reads from (config.statusReact.emoji, autostatus.reactEmoji,
        // and variables.STATUS_EMOJI which takes top priority).
        bot.config.statusReact.enabled = true;
        bot.config.statusReact.emoji = chosen;
        autostatus.autoReact = true;
        autostatus.reactEmoji = chosen;
        if (chosen === null) delete vars.STATUS_EMOJI;
        else vars.STATUS_EMOJI = chosen;

        writeJson(AUTOSTATUS_PATH, autostatus);
        writeJson(VARS_PATH, vars);
        fs.writeFileSync('./config.json', JSON.stringify(bot.config, null, 2));

        const shown = chosen === null ? 'green heart 💚 (default)' : chosen;
        return await m.reply(`Status react emoji set to : ${shown}\nStatus auto-react : ON`);
    }
};
