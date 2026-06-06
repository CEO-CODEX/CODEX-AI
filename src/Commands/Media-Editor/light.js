const mumaker = require('mumaker');

module.exports = {
    name: 'light',
    alias: [],
    desc: 'Create a futuristic light/neon text effect',
    category: 'textmaker',
    usage: '.light <text>',
    reactions: { start: '◈', success: '◉' },

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ');

        if (!text) {
            return reply(
                `◈ LIGHT TEXT ◈\n\n` +
                `☛ Provide text\n\n` +
                `❡ Usage: .light <text>\n\n` +
                `❡ Example:\n` +
                `  .light CODEX AI\n\n` +
                `─ · · · · · · · · · · · · · · · · · · ─`
            );
        }

        // Start reaction
        await sock.sendMessage(m.chat, { react: { text: '◈', key: m.key } });

        try {
            const result = await mumaker.ephoto(
                'https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html',
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
                    `◈ LIGHT TEXT ◈\n\n` +
                    `◉ Generated!\n\n` +
                    `❡ Text: ${text}\n\n` +
                    `─ · · · · · · · · · · · · · · · · · · ─\n` +
                    `  ☯︎ Source C☯︎DEX`
            }, { quoted: m });

        } catch (err) {
            console.error('[LIGHT ERROR]', err.message);

            // Error reaction
            await sock.sendMessage(m.chat, { react: { text: '✘', key: m.key } });

            return reply(
                `◈ LIGHT TEXT ◈\n\n` +
                `☛ Failed to generate\n\n` +
                `✘ ${err.message}\n\n` +
                `─ · · · · · · · · · · · · · · · · · · ─`
            );
        }
    }
};
