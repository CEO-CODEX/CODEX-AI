const fs   = require('fs');
const path = require('path');

const STICKER_CMD_FILE = path.join(process.cwd(), 'database/sticker_cmds.json');

let stickerCmds = {};

const loadStickerCmds = () => {
    try {
        if (fs.existsSync(STICKER_CMD_FILE)) {
            stickerCmds = JSON.parse(fs.readFileSync(STICKER_CMD_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[STICKER CMD LOAD ERROR]', e.message);
        stickerCmds = {};
    }
};

const saveStickerCmds = () => {
    try {
        fs.mkdirSync(path.dirname(STICKER_CMD_FILE), { recursive: true });
        fs.writeFileSync(STICKER_CMD_FILE, JSON.stringify(stickerCmds, null, 2));
    } catch (e) {
        console.error('[STICKER CMD SAVE ERROR]', e.message);
    }
};

loadStickerCmds();

module.exports = {
    name: 'setcmd',
    alias: ['bindcmd', 'stickercmd'],
    desc: 'Bind a command to a sticker',
    category: 'owner',
    ownerOnly: true,
    usage: '.setcmd <command> (reply to sticker)',

    execute: async (bot, m, args) => {
        const reply  = (t) => m.reply(t);
        const prefix = bot.prefix;

        const quotedMsg   = m.msg?.contextInfo?.quotedMessage || m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const stickerData = quotedMsg?.stickerMessage;

        if (!stickerData) {
            return reply(
                `╭─❍ *SETCMD*\n│\n│ ✘ Reply to a sticker\n│ ⚉ Usage: ${prefix}setcmd <command>\n│\n│ 𓄄 Example: ${prefix}setcmd ping\n╰──────────────────`
            );
        }

        if (!args[0]) {
            return reply('╭─❍ *SETCMD*\n│\n│ ✘ Provide a command\n╰──────────────────');
        }

        const fileSha256 = stickerData.fileSha256;
        if (!fileSha256) {
            return reply('╭─❍ *SETCMD*\n│\n│ ✘ Could not get sticker hash\n╰──────────────────');
        }

        // _handleStickerCommand (lib/messageHandler.js) looks up by the HEX form.
        const hash = Buffer.isBuffer(fileSha256)
            ? fileSha256.toString('hex')
            : Buffer.from(fileSha256, 'base64').toString('hex');

        const command = args.join(' ');
        const cmdName = command.split(/\s+/)[0];

        // Must match the shape _handleStickerCommand expects: { type, command }
        loadStickerCmds();
        stickerCmds[hash] = { type: 'command', command };
        saveStickerCmds();

        return reply(`\`⎙ Bounded to ${cmdName}\``);
    }
};

module.exports.stickerCmds = stickerCmds;
module.exports.loadStickerCmds = loadStickerCmds;
