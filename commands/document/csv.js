
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'csv',
    aliases: ['spreadsheet', 'csvgen'],
    category: 'documents',
    reactions: { start: '📄', success: '✅' },
    description: 'Generate a CSV file from text data.',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        const input = args.join(' ').trim();
        
        if (!input) {
            return await m.reply(`Usage: ${prefix}csv Header1,Header2 | Row1Val1,Row1Val2\nExample: ${prefix}csv Name,Age,City | John,25,Lagos | Jane,30,Abuja`);
        }

        const rows = input.split('|').map(r => r.trim());
        if (rows.length < 2) {
            return await m.reply(`❌ Please provide at least a header row and one data row.\nExample: ${prefix}csv Name,Age | John,25`);
        }

        try {
            await m.reply('📄 Generating CSV file...');

            let csv = '';
            rows.forEach(row => {
                // Wrap each column value in quotes to safely handle spaces
                const cols = row.split(',').map(c => `"${c.trim()}"`).join(',');
                csv += cols + '\n';
            });

            // Create temp directory in the root folder if it doesn't exist
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const fileName = `spreadsheet_${Date.now()}.csv`;
            const filePath = path.join(tempDir, fileName);
            
            fs.writeFileSync(filePath, csv);

            await bot.sendMessage(m.chat, {
                document: fs.readFileSync(filePath),
                fileName: 'spreadsheet.csv',
                mimetype: 'text/csv',
                caption: '*📄 CSV FILE GENERATED*'
            }, { quoted: m });

            // Clean up the temp file after sending
            fs.unlinkSync(filePath);

        } catch (err) {
            console.error('[CSV ERROR]', err.message);
            await m.reply('❌ Failed to generate the CSV file. Please try again later.');
        }
    }
};
