
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'json',
    aliases: ['jsong', 'jsonformat', 'jsonfile'],
    category: 'documents',
    reactions: { start: '📄', success: '✅' },
    description: 'Create or format a JSON file from key:value pairs or raw JSON.',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        let text = args.join(' ').trim();

        // Fallback to quoted message text
        if (!text && m.quoted) {
            text = (m.quoted.text || m.quoted.caption || m.quoted.body || '').trim();
        }

        if (!text) {
            return await m.reply(`Usage: ${prefix}json key:value key2:value2\nExample: ${prefix}json name:John age:25 city:Lagos\nOr reply to raw JSON text with: ${prefix}json`);
        }

        let jsonContent = '';

        // Step 1: Try parsing as raw JSON first
        try {
            const parsed = JSON.parse(text);
            jsonContent = JSON.stringify(parsed, null, 2);
        } catch (e) {
            // Step 2: If it's not raw JSON, try parsing as key:value pairs
            const obj = {};
            const pairs = text.match(/(\w+):("[^"]*"|\S+)/g);
            
            if (!pairs) {
                return await m.reply('❌ Invalid format. Please provide valid raw JSON or `key:value` pairs.\nExample: name:John age:25');
            }

            pairs.forEach(pair => {
                const [key, ...val] = pair.split(':');
                let value = val.join(':');
                
                // Convert data types
                if (/^-?\d+$/.test(value)) value = parseInt(value, 10);
                else if (/^-?\d+\.\d+$/.test(value)) value = parseFloat(value);
                else if (value.toLowerCase() === 'true') value = true;
                else if (value.toLowerCase() === 'false') value = false;
                else if (value.toLowerCase() === 'null') value = null;
                else value = value.replace(/^"|"$/g, ''); // Strip surrounding quotes for strings
                
                obj[key] = value;
            });

            jsonContent = JSON.stringify(obj, null, 2);
        }

        // Step 3: Write to file and send
        try {
            await m.reply('📄 Generating JSON file...');

            // Create temp directory in the root folder if it doesn't exist
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const fileName = `data_${Date.now()}.json`;
            const filePath = path.join(tempDir, fileName);
            
            fs.writeFileSync(filePath, jsonContent);

            await bot.sendMessage(m.chat, {
                document: fs.readFileSync(filePath),
                fileName: 'data.json',
                mimetype: 'application/json',
                caption: '*📄 JSON FILE GENERATED*'
            }, { quoted: m });

            // Clean up the temp file after sending
            fs.unlinkSync(filePath);

        } catch (err) {
            console.error('[JSON ERROR]', err.message);
            await m.reply('❌ Failed to generate the JSON file. Please try again later.');
        }
    }
};
