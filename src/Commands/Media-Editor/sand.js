const mumaker = require('mumaker');

module.exports = {
    name: 'sand',
    alias: [],
    desc: 'Create a sand/beach writing text effect',
    category: 'textmaker',
    usage: '.sand <text>',
    reactions: { start: '☀', success: '☼' },

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ');

        if (!text) {
            return reply(
                `◈ SAND TEXT ◈\n\n` +
                `☛ Provide text\n\n` +
                `❡ Usage: .sand <text>\n\n` +
                `❡ Example:\n` +
                `  .sand CODEX AI\n\n` +
                `─ · · · · · · · · · · · · · · · · · · ─`
            );
        }

        // Start reaction
        await sock.sendMessage(m.chat, { react: { text: '☀', key: m.key } });

        try {
            const result = await mumaker.ephoto(
                'https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html',
                text
            );

            if (!result || !result.image) {
                throw new Error('No image URL received from the API');
            }

            // Success reaction
            await sock.sendMessage(m.chat, { react: { text: '☼', key: m.key } });

            await sock.sendMessage(m.chat, {
                image: { url: result.image },
                caption: 
                    `◈ SAND TEXT ◈\n\n` +
                    `◉ Generated!\n\n` +
                    `❡ Text: ${text}\n\n` +
                    `─ · · · · · · · · · · · · · · · · · · ─\n` +
                    `  ☯︎ Source C☯︎DEX`
            }, { quoted: m });

        } catch (err) {
            console.error('[SAND ERROR]', err.message);

            // Error reaction
            await sock.sendMessage(m.chat, { react: { text: '✘', key: m.key } });

            return reply(
                `◈ SAND TEXT ◈\n\n` +
                `☛ Failed to generate\n\n` +
                `✘ ${err.message}\n\n` +
                `─ · · · · · · · · · · · · · · · · · · ─`
            );
        }
    }
};
    
