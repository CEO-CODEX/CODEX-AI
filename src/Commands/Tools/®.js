const fs   = require('fs');
const path = require('path');

const MIME = {
    '.js':'application/javascript', '.json':'application/json',
    '.txt':'text/plain', '.md':'text/markdown', '.log':'text/plain',
    '.sh':'text/x-sh', '.env':'text/plain', '.ts':'application/typescript',
};

module.exports = {
    name: 'getfile',
    alias: ['file'],
    desc: 'Fetch a file from the server and send it',
    category: 'Tools',
    reactions: { start: '📁', success: '✅' },

    execute: async (sock, m, { args, reply }) => {
        const filePath = args.join(' ').trim();
        if (!filePath) return reply('☛⃠ Usage: .getfile <path>\nExample: .getfile settings/config.js');

        const root   = process.cwd();
        const target = path.resolve(root, filePath);

        if (!target.startsWith(root)) return reply('☛⃠ Access denied: outside bot directory.');
        if (!fs.existsSync(target))   return reply('☛⃠ Not found: ' + filePath);

        const stat = fs.statSync(target);

        if (stat.isDirectory()) {
            const items = fs.readdirSync(target);
            let text = '◈ ' + filePath + '/\n\n';
            items.forEach(i => {
                const d = fs.statSync(path.join(target, i)).isDirectory();
                text += (d ? '◉ ' : '◈ ') + i + '\n';
            });
            return reply(text.trim());
        }

        if (stat.size > 10 * 1024 * 1024) return reply('☛⃠ File too large (max 10MB).');

        const ext  = path.extname(target).toLowerCase();
        const mime = MIME[ext] || 'application/octet-stream';

        // Start reaction
        await sock.sendMessage(m.chat, { react: { text: '📁', key: m.key } });

        await sock.sendMessage(m.chat, {
            document: fs.readFileSync(target),
            fileName: path.basename(target),
            mimetype: mime,
            caption: '*❀ CODEX CONTROL CENTER*\n\n*FILE SUCCESSFULLY DEPLOYED FROM PANEL*',
        }, { quoted: m });

        // Success reaction
        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
    }
};
                               
