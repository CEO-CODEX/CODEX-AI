
const fs = require('fs');
const path = require('path');

const MIME = {
    '.js': 'application/javascript', 
    '.json': 'application/json',
    '.txt': 'text/plain', 
    '.md': 'text/markdown', 
    '.log': 'text/plain',
    '.sh': 'text/x-sh', 
    '.env': 'text/plain', 
    '.ts': 'application/typescript',
};

module.exports = {
    name: 'getfile',
    aliases: ['file', 'fetchfile'],
    category: 'tools',
    reactions: { start: '📄', success: '✅' },
    description: 'Fetch a file from the server or list a directory.',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        const filePath = args.join(' ').trim();

        if (!filePath) {
            return await m.reply(`Usage: ${prefix}getfile <path>\nExample: ${prefix}getfile temp\nExample: ${prefix}getfile package.json`);
        }

        try {
            const root = process.cwd();
            // Resolve path safely against the root directory
            const target = path.resolve(root, filePath);

            // Security Check: Prevent directory traversal attacks (e.g., ../../../etc/passwd)
            if (!target.startsWith(root)) {
                return await m.reply('❌ Access denied: Cannot access files outside the bot directory.');
            }

            if (!fs.existsSync(target)) {
                return await m.reply(`❌ Not found: \`${filePath}\``);
            }

            const stat = fs.statSync(target);

            // 1. If it's a directory, list its contents
            if (stat.isDirectory()) {
                const items = fs.readdirSync(target);
                let text = `*📁 Directory:* ${filePath || '/'}\n\n`;
                
                if (items.length === 0) {
                    text += '_Empty directory._';
                } else {
                    items.forEach(item => {
                        const isDir = fs.statSync(path.join(target, item)).isDirectory();
                        text += `${isDir ? '📁' : '📄'} ${item}\n`;
                    });
                }
                return await m.reply(text.trim());
            }

            // 2. If it's a file, send it
            // Size limit: 10MB
            if (stat.size > 10 * 1024 * 1024) {
                return await m.reply('❌ File is too large to send (Max limit: 10MB).');
            }

            await m.reply('📄 Fetching file...');

            const ext = path.extname(target).toLowerCase();
            const mime = MIME[ext] || 'application/octet-stream';
            const fileSizeKB = (stat.size / 1024).toFixed(2);

            await bot.sendMessage(m.chat, {
                document: fs.readFileSync(target),
                fileName: path.basename(target),
                mimetype: mime,
                caption: `*📄 FILE DEPLOYED*\n\n*Name:* ${path.basename(target)}\n*Size:* ${fileSizeKB} KB`
            }, { quoted: m });

        } catch (error) {
            console.error('[GETFILE ERROR]', error.message);
            await m.reply('❌ Failed to fetch the file or directory. Ensure you have the correct permissions.');
        }
    }
};
              
