const fs = require('fs-extra');

module.exports = {
    name: 'getvar',
    category: 'bot',
    description: 'Get a variable value from the database',

    async execute(bot, m, args) {
        if (args.length < 1) return await m.reply(`Usage: ${bot.prefix}getvar <key>\nExample: ${bot.prefix}getvar PREFIX`);
        const key    = args[0];
        const dbPath = './database/variables.json';
        let db = {};
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch {}
        if (db[key] !== undefined)         return await m.reply(`${key} = ${db[key]}`);
        if (bot.config[key] !== undefined) return await m.reply(`${key} = ${bot.config[key]} (from config)`);
        return await m.reply(`Variable ${key} not found.`);
    }
};
