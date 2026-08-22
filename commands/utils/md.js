
module.exports = {
    name: 'md',
    alias: ['syntax', 'code'],
    desc: 'Send syntax-highlighted code block',
    category: 'utils',
    reactions: { start: '💻' },
    
    execute: async (sock, m, { args, reply, prefix }) => {
        const input = args.join(' ').trim();
        
        if (!input) {
            return reply(
                ` *Usage:* ${prefix}md <language> | <code>\n\n` +
                `✪ *Example:*\n` +
                `${prefix}md javascript | console.log('Hello!')\n` +
                `${prefix}md python | print("Hello World")\n\n` +
                `📝 *Languages:* js, py, java, cpp, html, css, etc.`
            );
        }

        const pipeIndex = input.indexOf('|');
        let language, code;

        if (pipeIndex !== -1) {
            language = input.slice(0, pipeIndex).trim().toLowerCase();
            code = input.slice(pipeIndex + 1).trim();
        } else {
            language = 'markdown'; // default
            code = input;
        }

        // Language aliases
        const langMap = {
            'js': 'javascript',
            'javascript': 'javascript',
            'py': 'python',
            'python': 'python',
            'java': 'java',
            'cpp': 'cpp',
            'c++': 'cpp',
            'c': 'c',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'ts': 'typescript',
            'typescript': 'typescript',
            'go': 'go',
            'rust': 'rust',
            'php': 'php',
            'ruby': 'ruby',
            'swift': 'swift',
            'kotlin': 'kotlin',
            'sql': 'sql',
            'shell': 'bash',
            'bash': 'bash',
            'sh': 'bash'
        };

        const finalLang = langMap[language] || language;

        try {
            // Send as a beautifully formatted WhatsApp markdown text message
            const finalText = `*📝 ${finalLang.charAt(0).toUpperCase() + finalLang.slice(1)} Code*\n\n` +
                              '```' + finalLang + '\n' +
                              code + '\n' +
                              '```\n\n' +
                              '_💻 Syntax CODEX Ai_';

            await sock.sendMessage(m.chat, {
                text: finalText
            }, { quoted: m });

        } catch (error) {
            console.error('[MD ERROR]', error.message || error);
            
            // Fallback to normal markdown if the main send fails
            reply('```' + finalLang + '\n' + code + '```');
        }
    }
};
              
