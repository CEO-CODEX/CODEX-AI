
const os = require('os');

module.exports = {
    name: 'stats',
    alias: ['check', 'status'],
    desc: 'Bot statistics with full dynamic tracking bars',
    category: 'Bot',
    reactions: { start: '📊', success: '📡' },

    execute: async (sock, m, { config, reply }) => {
        try {
            if (this.reactions?.start) {
                await sock.sendMessage(m.chat, { react: { text: this.reactions.start, key: m.key } });
            }

            const botName  = config.settings?.botName || 'C☯︎DEX-AI V3.0';
            const up       = process.uptime();
            const uptimeStr= Math.floor(up/86400)+'d '+Math.floor((up%86400)/3600)+'h '+Math.floor((up%3600)/60)+'m '+Math.floor(up%60)+'s';
            
            // Raw Metrics
            const memUsed  = parseFloat((process.memoryUsage().heapUsed/1024/1024).toFixed(1));
            const memTotal = parseFloat((os.totalmem()/1024/1024/1024).toFixed(1));
            const cpu      = parseFloat((os.loadavg()[0]*10).toFixed(1));
            const msgs     = global.codexStats?.messages || 0;
            const cmds     = global.codexStats?.commands || 0;

            // Target maximums to calculate percentages accurately
            const maxMessages = 50000; 
            const maxCommands = 10000; 
            const maxMemory   = memTotal * 1024; // Convert GB to MB
            const maxUptime   = 2592000; // 30 Days in seconds

            // Dynamic progress bar generator (Using Math.ceil so low stats still show life!)
            const makeBar = (value, max) => {
                if (value === 0) return '░'.repeat(10);
                const percentage = (value / max) * 10;
                // Use Math.ceil so anything above 0% gets at least 1 block filled
                const filledBlocks = Math.min(Math.max(Math.ceil(percentage), 1), 10);
                return '█'.repeat(filledBlocks) + '░'.repeat(10 - filledBlocks);
            };

            // Format the text dashboard
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

            if (this.reactions?.success) {
                await sock.sendMessage(m.chat, { react: { text: this.reactions.success, key: m.key } });
            }
        } catch (e) {
            await reply('❌ Stats failed: ' + e.message);
        }
    }
};


