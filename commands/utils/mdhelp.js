
module.exports = {
    name: 'mdhelp',
    alias: ['syntaxhelp', 'languages'],
    desc: 'Show supported languages for syntax highlighting',
    category: 'utils',
    reactions: { start: '📚' },
    
    execute: async (sock, m, { reply, prefix }) => {
        try {
            // Clean text layout instead of the table payload
            const textLayout = `*🔖 Supported Languages*\n\n` +
                `*JavaScript* (js, javascript)\n` +
                `*Python* (py, python)\n` +
                `*TypeScript* (ts, typescript)\n` +
                `*Java* (java)\n` +
                `*C / C++* (c, cpp, c++)\n` +
                `*HTML* (html)\n` +
                `*CSS* (css)\n` +
                `*JSON* (json)\n` +
                `*PHP* (php)\n` +
                `*Ruby* (ruby)\n` +
                `*Go* (go)\n` +
                `*Rust* (rust)\n` +
                `*Kotlin* (kotlin)\n` +
                `*Swift* (swift)\n` +
                `*SQL* (sql)\n` +
                `*Bash* (bash, sh, shell)\n\n` +
                `💡 _Use ${prefix}md <lang> | <code> to format code_`;

            await sock.sendMessage(m.chat, {
                text: textLayout
            }, { quoted: m });

        } catch (error) {
            console.error('[MDHELP ERROR]', error.message || error);
            
            // Fallback if the main message fails
            reply('📚 *Supported:* js, py, java, cpp, html, css, json, ts, go, rust, php, ruby, sql, bash');
        }
    }
};
