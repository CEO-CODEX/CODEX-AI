const mumaker = require('mumaker');

module.exports = {
    name: '1917',
    alias: [],
    desc: 'Create a 1917 style text effect on an image',
    category: 'textmaker',
    usage: '.1917 <text>',
    reactions: { start: '◈', success: '◉' },

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ');

        if (!text) {
            return reply(
                `◈ 1917 TEXT ◈\n\n` +
                `☛ Provide text\n\n` +
                `❡ Usage: .1917 <text>\n\n` +
                `❡ Example:\n` +
                `  .1917 CODEX AI\n\n` +
                `─ · · · · · · · · · · · · · · · · · · ─`
            );
        }

        // Start reaction
        await sock.sendMessage(m.chat, { react: { text: '◈', key: m.key } });

        try {
            const result = await mumaker.ephoto(
                'https://en.ephoto360.com/1917-style-text-effect-523.html',
                text
            );

            if (!result || !result.image) {
                throw new Error('No image URL received from the API');
            }

            // Success reaction
            await sock.sendMessage(m.chat, { react: { text: '◉', key: m.key } });

            await sock.sendMessage(m.chat, {
                image: { url: result.image },
                caption:
                    `◈ 1917 TEXT ◈\n\n` +
                    `◉ Generated!\n\n` +
                    `❡ Text: ${text}\n\n` +
                    `─ · · · · · · · · · · · · · · · · · · ─\n` +
                    `  ☯︎ Source C☯︎DEX`
            }, { quoted: m });

        } catch (err) {
            console.error('[1917 ERROR]', err.message);

            // Error reaction
            await sock.sendMessage(m.chat, { react: { text: '✘', key: m.key } });

            return reply(
                `◈ 1917 TEXT ◈\n\n` +
                `☛ Failed to generate\n\n` +
                `✘ ${err.message}\n\n` +
                `─ · · · · · · · · · · · · · · · · · · ─`
            );
        }
    }
};
