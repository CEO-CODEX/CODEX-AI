const fs = require('fs-extra');

module.exports = {
    name: 'listvar',
    aliases: ['vars', 'allvar'],
    category: 'bot',
    description: 'List all variables in the database',

    async execute(bot, m, args) {
        const dbPath = './database/variables.json';
        let db = {};
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch {}
        const vars = Object.entries(db);
        if (vars.length === 0) return await m.reply('No custom variables set.');
        let text = 'All variables:\n';
        vars.forEach(([key, value], i) => { text += `${i+1}. ${key} = ${value}\n`; });
        text += `\nTotal: ${vars.length}`;
        await m.reply(text);
    }
};
