const fs   = require('fs-extra');
const path = require('path');
const DB   = path.join(process.cwd(), 'database/variables.json');

const readVars  = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return {}; } };
const saveVars  = (d) => { fs.ensureDirSync(path.dirname(DB)); fs.writeFileSync(DB, JSON.stringify(d, null, 2)); };

module.exports = {
    name:      'setvar',
    alias:     ['sv', 'setbotname', 'setname'],
    category: 'owner',
    desc:      'Set a bot config variable (BOT_NAME, PREFIX, MODE, etc.)',
    ownerOnly: true,
    reactions: { start: '⚙️', success: '👾' },

    execute: async (bot, m, args) => {
        if (!args[0]) return await m.reply(
            `Usage: ${bot.prefix}setvar KEY=value\n\nExamples:\n` +
            `• ${bot.prefix}setvar BOT_NAME=CODEX AI\n` +
            `• ${bot.prefix}setvar PREFIX=.\n` +
            `• ${bot.prefix}setvar MODE=public\n` +
            `• ${bot.prefix}setvar OWNER=2349064626405`
        );

        const full = args.join(' ');
        let key, value;
        if (full.includes('=')) {
            const idx = full.indexOf('=');
            key   = full.slice(0, idx).trim().toUpperCase();
            value = full.slice(idx + 1).trim();
        } else {
            key   = args[0].toUpperCase();
            value = args.slice(1).join(' ').trim();
        }

        if (!key || value === '') return await m.reply('Usage: `.setvar KEY=value`');

        // Save to database/variables.json (persistent)
        const vars = readVars();
        vars[key]  = value;
        saveVars(vars);

        // Apply to live config immediately
        try {
            const cfg = bot.config;  // Use live bot.config directly — no require needed
            const keyMap = {
                BOT_NAME:     'settings.title',
                PREFIX:       'prefix',
                MODE:         'mode',
                OWNER:        'owner',
                BOT_FONT:     'BOT_FONT',
                BOT_CHARACTER:'BOT_CHARACTER',
                AI_BADGE:     'AI_BADGE',
                STATUS_EMOJI: 'STATUS_EMOJI'
            };
            // Apply STATUS_EMOJI to autostatus db immediately
            if (key === 'STATUS_EMOJI') {
                try {
                    const _fs2  = require('fs-extra');
                    const _path = './database/autostatus.json';
                    const _db   = _fs2.existsSync(_path) ? JSON.parse(_fs2.readFileSync(_path,'utf8')) : {};
                    _db.reactEmoji = value;
                    _fs2.writeFileSync(_path, JSON.stringify(_db, null, 2));
                } catch {}
            }
            // Apply AUTO_TYPING / AUTO_RECORDING immediately to variables
            if (key === 'AUTO_TYPING' || key === 'AUTO_RECORDING') {
                const _boolVal = value === 'true' || value === '1' || value === 'on';
                vars[key] = _boolVal;
                saveVars(vars);
            }
            if (keyMap[key]) {
                const parts = keyMap[key].split('.');
                let obj = cfg;
                for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]] = obj[parts[i]] || {};
                obj[parts[parts.length - 1]] = value;
            }
            // Apply PREFIX live so commands work without restart
            if (key === 'PREFIX') {
                bot.config.prefix = value;
                try { bot.prefix = value; } catch {}
            }
            if (key === 'MODE') bot.config.mode = value;
            if (key === 'BOT_NAME') {
                if (!bot.config.settings) bot.config.settings = {};
                bot.config.settings.title = value;
                bot.config.botName = value;
            }
        } catch {}

        return await m.reply(`✪ *${key}* = ${value}\n\n_Saved. Takes effect immediately._`);
    }
};
