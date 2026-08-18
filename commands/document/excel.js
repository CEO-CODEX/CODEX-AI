
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'excel',
    aliases: ['xls', 'xlsx', 'spreadsheet'],
    category: 'documents',
    reactions: { start: '📄', success: '✅' },
    description: 'Generate a simple Excel file from text input.',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        const input = args.join(' ').trim();
        
        if (!input) {
            return await m.reply(`Usage: ${prefix}excel Title | col1,col2 | val1,val2\nExample: ${prefix}excel MySheet | Name,Age | John,25 | Jane,30`);
        }

        const parts = input.split('|').map(p => p.trim());
        if (parts.length < 2) {
            return await m.reply(`❌ Please provide a title and at least one data row.\nExample: ${prefix}excel MySheet | Name,Age | John,25`);
        }

        const title = parts[0];
        const rows = parts.slice(1);

        // Build simple HTML-based Excel
        let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="UTF-8"></head>
        <body><table border="1"><caption>${title}</caption>`;

        rows.forEach((row, i) => {
            // First row becomes headers (th), subsequent rows are data (td)
            const tag = i === 0 ? 'th' : 'td';
            const cols = row.split(',').map(c => `<${tag}>${c.trim()}</${tag}>`).join('');
            html += `<tr>${cols}</tr>`;
        });

        html += '</table></body></html>';

        try {
            await m.reply('📊 Generating Excel file...');

            // Create temp directory in the root folder if it doesn't exist
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // Clean the title for a safe filename
            const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
            const filePath = path.join(tempDir, `${safeTitle}_${Date.now()}.xls`);
            
            fs.writeFileSync(filePath, html);

            await bot.sendMessage(m.chat, {
                document: fs.readFileSync(filePath),
                fileName: `${safeTitle}.xls`,
                mimetype: 'application/vnd.ms-excel',
                caption: `*📊 EXCEL FILE GENERATED*\n\n*Title:* ${title}`
            }, { quoted: m });

            // Clean up the temp file after sending
            fs.unlinkSync(filePath);

        } catch (err) {
            console.error('[EXCEL ERROR]', err.message);
            await m.reply('❌ Failed to generate the Excel file. Please try again later.');
        }
    }
};
