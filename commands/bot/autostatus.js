const fs = require('fs-extra');

const CONFIG_PATH = './database/autosavestatus.json';
const defaultConfig = { enabled: false, mode: 'dm', target: null };

let config = { ...defaultConfig };
try {
    if (fs.existsSync(CONFIG_PATH))
        config = { ...defaultConfig, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
} catch {}

function saveConfig() {
    fs.ensureDirSync('./database');
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

module.exports = {
    name: 'autostatus',
    aliases: ['ass', 'autosave'],
    category: 'bot',
    description: 'Auto-save all statuses to a specified chat or DM',

    async execute(bot, m, args) {
        const sub   = args[0]?.toLowerCase();
        const value = args.slice(1).join(' ');

        if (sub === 'on')  { config.enabled = true;  saveConfig(); return await m.reply('Auto Save Status ENABLED.'); }
        if (sub === 'off') { config.enabled = false; saveConfig(); return await m.reply('Auto Save Status DISABLED.'); }

        if (sub === 'mode') {
            const mode = value.toLowerCase();
            if (!['dm','chat','number'].includes(mode))
                return await m.reply('Invalid mode. Use: dm, chat, or number');
            config.mode = mode;
            saveConfig();
            return await m.reply(`Mode set to: ${mode.toUpperCase()}`);
        }

        if (sub === 'set') {
            if (!value) return await m.reply('Provide a number or chat JID.');
            let target = value.trim();
            if (config.mode === 'number') target = target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            else if (config.mode === 'chat' && !target.includes('@')) target = target + '@g.us';
            config.target = target;
            saveConfig();
            return await m.reply(`Target set to: ${target}`);
        }

        if (sub === 'status') {
            const tgt = config.target
                ? (config.mode === 'number' ? config.target.split('@')[0] : config.target)
                : 'None (owner DM)';
            return await m.reply(
` 📸 AUTO SAVE STATUS 
 Enabled : ${config.enabled ? 'ON' : 'OFF'}
 Mode    : ${config.mode.toUpperCase()}
 Target  : ${tgt}
`
            );
        }

        return await m.reply(
` 📸 AUTO SAVE STATUS 
 ${bot.prefix}autostatus on
 ${bot.prefix}autostatus off
 ${bot.prefix}autostatus mode dm
 ${bot.prefix}autostatus mode chat
 ${bot.prefix}autostatus mode number
 ${bot.prefix}autostatus set <number/JID>
 ${bot.prefix}autostatus status
`
        );
    },

    getConfig: () => config,
};
