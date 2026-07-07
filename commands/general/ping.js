const os = require('os');
const { formatUptime, formatBytes } = require('../../lib/utils');

module.exports = {
    name: 'ping',
    aliases: ['speed', 'latency'],
    category: 'general',
    description: 'Check bot response time and stats',

    async execute(bot, m, args) {
        const start = Date.now();
        // Small delay to calculate latency
        await new Promise(resolve => setTimeout(resolve, 100));
        const latency = Date.now() - start;

        const uptime = formatUptime(process.uptime());
        const ramUsage = formatBytes(process.memoryUsage().heapUsed);
        const totalRam = formatBytes(os.totalmem());

        const responseText = `📡 PONG!\n` +
                             `  🕣 ${latency}ms\n` +
                             `  🥏 ACTIVE\n` +
                             `  🧬 ${totalRam}  SERVER RAM`;

        await m.reply(responseText);
    }
};
