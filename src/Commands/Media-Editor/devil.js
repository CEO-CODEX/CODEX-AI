const mumaker = require('mumaker');

module.exports = {
    name: 'devil',
    alias: [],
    desc: 'Create a neon devil wings text effect',
    category: 'textmaker',
    usage: '.devil <text>',
    reactions: { start: '◈', success: '◉' },

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ');

        if (!text) {
            return reply(
                `◈ DEVIL TEXT ◈\n\n` +
                `☛ Provide text\n\n` +
                `❡ Usage: .devil <text>\n\n` +
                `❡ Example:\n` +
                `  .devil CODEX AI\n\n` +
                `─ · · · · · · · · · · · · · · · · · · ─`
            );
        }

        // Start reaction
        await sock.sendMessage(m.chat, { react: { text: '◈', key: m.key } });

        try {
            const result = await mumaker.ephoto(
                'https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html',
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
                    `◈ DEVIL TEXT ◈\n\n` +
                    `◉ Generated!\n\n` +
                    `❡ Text: ${text}\n\n` +
                    `─ · · · · · · · · · · · · · · · · · · ─\n` +
                    `  ☯︎ Source C☯︎DEX`
            }, { quoted: m });

        } catch (err) {
            console.error('[DEVIL ERROR]', err.message);

            // Error reaction
            await sock.sendMessage(m.chat, { react: { text: '✘', key: m.key } });

            return reply(
                `◈ DEVIL TEXT ◈\n\n` +
                `☛ Failed to generate\n\n` +
                `✘ ${err.message}\n\n` +
                `─ · · · · · · · · · · · · · · · · · · ─`
            );
        }
    }
};
