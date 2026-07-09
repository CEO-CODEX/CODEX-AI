const os = require('os');

module.exports = {
    name: 'uptime',
    alias: ['up'],
    desc: 'Check how long the bot has been running',
    category: 'Bot',
    reactions: { start: '', success: '' },

    execute: async (sock, m, { reply }) => {
        const up  = process.uptime();
        const d   = Math.floor(up / 86400);
        const h   = Math.floor((up % 86400) / 3600);
        const min = Math.floor((up % 3600) / 60);
        const s   = Math.floor(up % 60);

        // One clean string wrapped in triple backticks. No edits.
        await reply('```❁ UPTIME ! ' + `${d}d-${h}h-${min}m-${s}s` + '```');
    }
};
