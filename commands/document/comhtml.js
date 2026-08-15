
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'comhtml',
    aliases: ['compresshtml', 'minifyhtml'],
    category: 'tools',
    description: 'Create an HTML file from raw code (reply to an .html document or text message).',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        
        let customFileName = args[0]?.trim();
        if (customFileName && !customFileName.endsWith('.html')) customFileName += '.html';

        const quoted = m.quoted;
        let code = '';
        let sourceFileName = 'code.html';
        let isDocument = false;

        if (quoted) {
            const mtype = quoted.mtype || quoted.type || '';
            
            // Case 1: Replied to an .html document
            if (mtype === 'documentMessage' && quoted.fileName?.endsWith('.html')) {
                isDocument = true;
                sourceFileName = quoted.fileName;
                try {
                    const buffer = await quoted.download();
                    if (!buffer || buffer.length === 0) return await m.reply('❌ Failed to download file.');
                    code = buffer.toString('utf8');
                } catch (err) {
                    return await m.reply('❌ Failed to read document.');
                }
            }
            // Case 2: Replied to a text message
            else if (mtype === 'conversation' || mtype === 'extendedTextMessage' || quoted.text) {
                code = quoted.text || quoted.body || '';
                if (!code.trim()) return await m.reply('❌ No HTML code found in the replied message.');
            } else {
                return await m.reply('❌ Please reply to an .html document or a text message containing HTML code.');
            }
        } else {
            // Case 3: Code provided directly in the command
            if (!customFileName) {
                return await m.reply(`Usage: ${prefix}comhtml <filename.html> <code>\nOr reply to code with: ${prefix}comhtml <filename.html>`);
            }
            
            code = args.slice(1).join(' ').trim();
            if (!code) return await m.reply('❌ No code provided after the filename.');
        }

        // Determine final filename
        let finalFileName = customFileName || (isDocument ? sourceFileName : 'index.html');
        if (!finalFileName.endsWith('.html')) finalFileName += '.html';

        if (!code.trim()) return await m.reply('❌ No code to package.');

        try {
            await m.reply('📄 Packaging HTML file...');

            // Create temp directory in the root folder if it doesn't exist
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const outPath = path.join(tempDir, finalFileName);
            fs.writeFileSync(outPath, code, 'utf8');

            const stats = fs.statSync(outPath);
            const sizeKB = (stats.size / 1024).toFixed(2);

            const caption = 
                `*📄 HTML FILE CREATED*\n\n` +
                `*Filename:* ${finalFileName}\n` +
                `*Size:* ${stats.size} bytes (${sizeKB} KB)`;

            await bot.sendMessage(m.chat, {
                document: fs.readFileSync(outPath),
                fileName: finalFileName,
                mimetype: 'text/html',
                caption: caption
            }, { quoted: m });

            // Clean up the temp file after sending
            fs.unlinkSync(outPath);

        } catch (err) {
            console.error('[COMHTML ERROR]', err.message);
            await m.reply('❌ Failed to create HTML file. Please try again later.');
        }
    }
};
