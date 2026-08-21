
module.exports = {
    name: 'open',
    alias: ['view', 'website', 'url'],
    desc: 'Create a website button that opens in-app',
    category: 'utils',
    reactions: { start: '🌐' },

    execute: async (sock, m, { args, reply, prefix }) => {
        let fullText = args.join(' ').trim();

        // If no args but replying to a text message, use that text
        if (!fullText && m.quoted) {
            const qtype = m.quoted.mtype || '';
            if (qtype === 'conversation' || qtype === 'extendedTextMessage') {
                fullText = m.quoted.body || m.quoted.text || '';
            }
        }

        if (!fullText) {
            return reply(
                `⚉ *Usage:* ${prefix}open <link> | <button text>\n\n` +
                `✪ *Example:*\n` +
                `${prefix}open https://crysnovax.link | Visit Site\n` +
                `${prefix}open https://youtube.com | Watch\n\n` +
                `🌐 _Opens in WhatsApp's in-app browser_`
            );
        }

        const parts = fullText.split('|').map(p => p.trim());
        let url = parts[0] || '';
        const buttonText = parts[1] || '☁︎ Open Link';

        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }

        try {
            await sock.sendMessage(m.chat, {
                text: `♧ *${buttonText}*\n\n_*ⓘ secured link*_`,
                nativeFlow: [{
                    text: buttonText,
                    url: url,
                    useWebview: true
                }]
            }, { quoted: m });

        } catch (error) {
            console.error('[OPEN ERROR]', error.message || error);
            
            // Fallback if the button message fails to send
            reply(`☁︎  *Link:* ${url}`);
        }
    }
};
