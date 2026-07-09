const os = require('os');

module.exports = {
    name: 'stats',
    alias: ['check', 'status'],
    desc: 'Bot statistics with full dynamic tracking bars',
    category: 'Bot',

    async execute(bot, m, args) {
        try {
            const sock = bot.sock;
            const config = bot.config;

            const botName  = config.settings?.botName || config.botName || 'C☯︎DEX-AI V3.0';
            const up       = process.uptime();
            const d        = Math.floor(up / 86400);
            const h        = Math.floor((up % 86400) / 3600);
            const min      = Math.floor((up % 3600) / 60);
            const s        = Math.floor(up % 60);
            
            // Your backtick uptime pattern
            const uptimeStr = `\`${d}d-${h}h-${min}m-${s}s\``;
            
            // Raw Metrics
            const memUsed  = parseFloat((process.memoryUsage().heapUsed/1024/1024).toFixed(1));
            const memTotal = parseFloat((os.totalmem()/1024/1024/1024).toFixed(1));
            const cpu      = parseFloat((os.loadavg()[0]*10).toFixed(1));
            const msgs     = global.codexStats?.messages || 0;
            const cmds     = global.codexStats?.commands || 0;

            // Target maximums to calculate percentages accurately
            const maxMessages = 50000; 
            const maxCommands = 10000; 
            const maxMemory   = memTotal * 1024; 
            const maxUptime   = 2592000; 

            // Dynamic progress bar generator 
            const makeBar = (value, max) => {
                if (value === 0) return '░'.repeat(10);
                const percentage = (value / max) * 10;
                const filledBlocks = Math.min(Math.max(Math.ceil(percentage), 1), 10);
                return '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);
            };

            // ORIGINAL DESIGN PRESERVED
            const dashboardText = 
                `*❦ ${botName.toUpperCase()} STATS*\n\n` +
                `❞ *Messages:* ${msgs.toLocaleString()} / ${maxMessages.toLocaleString()}\n` +
                `[ ${makeBar(msgs, maxMessages)} ]\n\n` +
                `♧ *Commands:* ${cmds.toLocaleString()} / ${maxCommands.toLocaleString()}\n` +
                `[ ${makeBar(cmds, maxCommands)} ]\n\n` +
                `⎙ *Memory:* ${memUsed} MB / ${maxMemory.toFixed(0)} MB\n` +
                `[ ${makeBar(memUsed, maxMemory)} ]\n\n` +
                `☁ *CPU Load:* ${cpu}%\n` +
                `[ ${makeBar(cpu, 100)} ]\n\n` +
                `ⓘ *Uptime:* ${uptimeStr}\n` +
                `[ ${makeBar(up, maxUptime)} ]\n\n` +
                `☙ *Platform:* ${os.platform()} | Node ${process.version}`;

            // Send as pure text
            await sock.sendMessage(m.chat, { text: dashboardText }, { quoted: m });

        } catch (e) {
            // Updated fallback error sending to match bot.sock structure
            await bot.sock.sendMessage(m.chat, { text: '❌ Stats failed: ' + e.message }, { quoted: m });
        }
    }
};
