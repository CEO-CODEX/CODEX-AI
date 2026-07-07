const fs = require('fs-extra');

const DB_PATH = './database/autoreact.json';

const DEFAULT_EMOJIS = [
    '😂','🔥','👍','❤️','😍','🎉','👏','🤔','😎','🥳','✨','💯','🙏',
    '🐾','⚠️','💘','🎲','📰','🤯','🎊','👌','🛑','😤','📝','😁','🥰',
    '😱','🤭','😫','😩','🤢','💫','💥','❤️‍🔥','👀','🫂','🗣️','🖕'
];

function loadConfig() {
    try { if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch {}
    return { enabled: false, emojis: [...DEFAULT_EMOJIS] };
}
function saveConfig(c) {
    fs.ensureDirSync('./database');
    fs.writeFileSync(DB_PATH, JSON.stringify(c, null, 2));
}

module.exports = {
    name: 'autoreact',
    aliases: ['randomreact'],
    category: 'bot',
    description: 'Auto-react to every message with a random emoji from a custom pool',

    async execute(bot, m, args) {
        const config = loadConfig();
        const cmd    = args[0]?.toLowerCase();

        if (cmd === 'on')  { config.enabled = true;  saveConfig(config); return await m.reply('Auto-react ENABLED. Reacting with random emoji on every message.'); }
        if (cmd === 'off') { config.enabled = false; saveConfig(config); return await m.reply('Auto-react DISABLED.'); }

        if (cmd === 'list') {
            return await m.reply(`Current emoji pool (${config.emojis.length}):\n\n${config.emojis.join(' ')}`);
        }
        if (cmd === 'add') {
            const emoji = args[1];
            if (!emoji) return await m.reply('Provide an emoji.');
            if (config.emojis.includes(emoji)) return await m.reply('Already in pool.');
            config.emojis.push(emoji);
            saveConfig(config);
            return await m.reply(`Added ${emoji} to pool.`);
        }
        if (cmd === 'remove') {
            const emoji = args[1];
            if (!emoji) return await m.reply('Provide an emoji to remove.');
            const idx = config.emojis.indexOf(emoji);
            if (idx === -1) return await m.reply('Not in pool.');
            config.emojis.splice(idx, 1);
            saveConfig(config);
            return await m.reply(`Removed ${emoji} from pool.`);
        }
        if (cmd === 'reset') {
            config.emojis = [...DEFAULT_EMOJIS];
            saveConfig(config);
            return await m.reply('Reset to default emoji pool.');
        }

        return await m.reply(
` ⚡ AUTO REACT 
 Status : ${config.enabled ? 'ON' : 'OFF'}
 Pool   : ${config.emojis.length} emojis
 ${bot.prefix}autoreact on/off
 ${bot.prefix}autoreact list
 ${bot.prefix}autoreact add <emoji>
 ${bot.prefix}autoreact remove <emoji>
 ${bot.prefix}autoreact reset
`
        );
    },

    isEnabled:     () => loadConfig().enabled,
    getRandomEmoji: () => { const c = loadConfig(); return c.emojis[Math.floor(Math.random() * c.emojis.length)] || '👍'; }
};
