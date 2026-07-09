module.exports = {
    name: 'ping',
    alias: ['speed', 'latency', 'test'],
    desc: 'Check bot response speed',
    category: 'Bot',
    reactions: { start: '', success: '' },

    execute: async (sock, m, { reply }) => {
        const start = Date.now();

        // Send initial "PINGING..." message
        const pingMsg = await reply('```❦ PINGING...```');

        const ms = Date.now() - start;

        // Edit the message to "PONG!" with ms
        await sock.sendMessage(m.chat, {
            edit: pingMsg.key,
            text: '```☙  P☯︎NG! ' +  ms + 'ms```'
        });
    }
};
