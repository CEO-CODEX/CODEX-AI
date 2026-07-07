const fs   = require('fs');
const path = require('path');
const axios = require('axios');
const os   = require('os');

const DEFAULT_THUMB = 'https://media.codex-ai.workers.dev/bafb2d80-d0da-4c2c-b6be-9cbdd7edd0b7.jpg';
const CACHED_IMG    = path.join(__dirname, '../../assets/menu.png');

module.exports = {
    name: 'menu',
    aliases: ['help', 'cmds', 'list'],
    category: 'general',
    description: 'Show all commands with CODEX UI',

    async execute(bot, m, args) {
        const c          = bot.config;
        const prefix     = bot.prefix || c.prefix || '.';
        const categories = bot.commandHandler.getAllCommands();

        const uniqueCount = Object.values(categories)
            .reduce((sum, cmds) => sum + cmds.length, 0);

        const uptimeMin = Math.floor(process.uptime() / 60);

        const time = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: true, timeZone: 'Africa/Lagos'
        }).toLowerCase();

        const getRam = () => {
            try {
                const total = os.totalmem();
                const used  = total - os.freemem();
                return `${(used/1024/1024/1024).toFixed(1)}/${(total/1024/1024/1024).toFixed(1)} GB (${Math.round(used/total*100)}%)`;
            } catch { return 'N/A'; }
        };

        const senderName = m.pushName || m.sender?.split('@')[0] || 'Unknown';
        const readmore   = String.fromCharCode(0x200E).repeat(4001);

        let text = '';
        text += `╔═══〔 𖣘 *${(c.settings?.title || c.botName || 'CODEX AI').toUpperCase()}* 𖣘 〕═══❒\n`;
        text += `║╭───────────────◆\n`;
        text += `║│ 𖣘 *USER:* ${senderName}\n`;
        text += `║│ 𖣘 *HOST:* Pterodactyl (panel)\n`;
        text += `║│ 𖣘 *PREFIX:* ${prefix}\n`;
        text += `║│ 𖣘 *CMDS:* ${uniqueCount}\n`;
        text += `║│ 𖣘 *UPTIME:* ${uptimeMin} MIN\n`;
        text += `║│ 𖣘 *MODE:* ${(c.mode || 'private').toUpperCase()}\n`;
        text += `║│ 𖣘 *STORAGE:* ${getRam()}\n`;
        text += `║│ 𖣘 *TIME:* ${time}\n`;
        text += `║╰───────────────◆\n`;
        text += `╚══════════════════❒\n\n`;
        text += `${readmore}\n`;

        for (const [category, commands] of Object.entries(categories)) {
            text += `╔═══〔 𖣘 *${category.toUpperCase()}* 𖣘 〕═══❒\n`;
            text += `║╭───────────────◆\n`;
            const seen = new Set();
            for (const cmd of commands) {
                if (!cmd?.name) continue;
                const n = cmd.name.toLowerCase();
                if (seen.has(n)) continue;
                seen.add(n);
                text += `║│ 𖣘 ${prefix}${cmd.name}\n`;
            }
            text += `║╰───────────────◆\n`;
            text += `╚══════════════════❒\n\n`;
        }

        text += `╔═══〔 𖣘 *DEVELOPER* 𖣘 〕═══❒\n`;
        text += `║╭───────────────◆\n`;
        text += `║│ ✰ 𝗖𝗢𝗗𝗘𝗫\n`;
        text += `║╰───────────────◆\n`;
        text += `╚══════════════════❒`;

        const getMenuImage = async () => {
            const menuUrl = c.MENU_IMAGE || c.thumbUrl || null;
            if (menuUrl) {
                try {
                    const res = await axios.get(menuUrl, { responseType: 'arraybuffer', timeout: 15000 });
                    fs.mkdirSync(path.dirname(CACHED_IMG), { recursive: true });
                    fs.writeFileSync(CACHED_IMG, res.data);
                    return Buffer.from(res.data);
                } catch {}
            }
            if (fs.existsSync(CACHED_IMG)) return fs.readFileSync(CACHED_IMG);
            try {
                const res = await axios.get(DEFAULT_THUMB, { responseType: 'arraybuffer', timeout: 15000 });
                fs.mkdirSync(path.dirname(CACHED_IMG), { recursive: true });
                fs.writeFileSync(CACHED_IMG, res.data);
                return Buffer.from(res.data);
            } catch { return null; }
        };

        const imgBuffer = await getMenuImage();

        await bot.sock.sendMessage(
            m.chat,
            imgBuffer ? { image: imgBuffer, caption: text } : { text },
            { quoted: m }
        );
    }
};
