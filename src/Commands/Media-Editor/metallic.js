const mumaker = require('mumaker');

module.exports = {
    name: 'metallic',
    alias: [],
    desc: 'Create a decorative 3D metal text effect',
    category: 'textmaker',
    usage: '.metallic <text>',
    reactions: { start: '◈', success: '◉' },

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ');

        if (!text) {
            return reply(
                `◈ METALLIC TEXT ◈\n\n` +
                `☛ Provide text\n\n` +
                `❡ Usage: .metallic <text>\n\n` +
                `❡ Example:\n` +
                `  .metallic CODEX AI\n\n` +
                `─ · · · · · · · · · · · · · · · · · · ─`
            );
        }

        // Start reaction
        await sock.sendMessage(m.chat, { react: { text: '◈', key: m.key } });

        try {
            const result = await mumaker.ephoto(
                'https://en.ephoto360.com/impressive-decorative-3d-metal-text-effect-798.html',
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
                    `◈ METALLIC TEXT ◈\n\n` +
                    `◉ Generated!\n\n` +
                    `❡ Text: ${text}\n\n` +
                    `─ · · · · · · · · · · · · · · · · · · ─\n` +
                    `  ☯︎ Source C☯︎DEX`
            }, { quoted: m });

        } catch (err) {
            console.error('[METALLIC ERROR]', err.message);

            // Error reaction
            await sock.sendMessage(m.chat, { react: { text: '✘', key: m.key } });

            return reply(
                `◈ METALLIC TEXT ◈\n\n` +
                `☛ Failed to generate\n\n` +
                `✘ ${err.message}\n\n` +
                `─ · · · · · · · · · · · · · · · · · · ─`
            );
        }
    }
};
