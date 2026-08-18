
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'xml',
    aliases: ['xmlgen', 'xmlfile'],
    category: 'documents',
    reactions: { start: '📄' },
    description: 'Generate an XML file from key:value pairs or raw XML.',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        let input = args.join(' ').trim();

        // Fallback to quoted message text
        if (!input && m.quoted) {
            input = (m.quoted.text || m.quoted.caption || m.quoted.body || '').trim();
        }

        if (!input) {
            return await m.reply(`Usage: ${prefix}xml rootname | key:value | key2:value2\nExample: ${prefix}xml User | name:John | age:25\nOr reply to raw XML code with: ${prefix}xml`);
        }

        let xmlContent = '';
        let fileName = 'data';

        // Step 1: Check if the user provided raw XML directly
        if (input.startsWith('<') && input.endsWith('>')) {
            xmlContent = input;
            fileName = 'raw_data';
        } else {
            // Step 2: Parse using the custom pipe format
            const parts = input.split('|').map(p => p.trim());
            // Sanitize the root name to ensure it's a valid XML tag
            const rootName = parts[0].replace(/[^a-zA-Z0-9_]/g, '') || 'root';
            fileName = rootName;
            
            const dataParts = parts.slice(1);

            if (dataParts.length === 0) {
                return await m.reply(`❌ Please provide at least one key:value pair.\nExample: ${prefix}xml Settings | theme:dark`);
            }

            xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>\n`;
            
            dataParts.forEach(pair => {
                const splitIndex = pair.indexOf(':');
                if (splitIndex !== -1) {
                    const key = pair.substring(0, splitIndex).trim().replace(/[^a-zA-Z0-9_]/g, '');
                    // Escape basic XML characters in the value
                    const value = pair.substring(splitIndex + 1).trim()
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                        
                    if (key) {
                        xmlContent += `  <${key}>${value}</${key}>\n`;
                    }
                }
            });
            
            xmlContent += `</${rootName}>`;
        }

        try {
            await m.reply('📄 Generating XML file...');

            // Create temp directory in the root folder if it doesn't exist
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const filePath = path.join(tempDir, `${fileName}_${Date.now()}.xml`);
            fs.writeFileSync(filePath, xmlContent);

            await bot.sendMessage(m.chat, {
                document: fs.readFileSync(filePath),
                fileName: `${fileName}.xml`,
                mimetype: 'application/xml',
                caption: '*📄 XML FILE GENERATED*'
            }, { quoted: m });

            // Clean up the temp file after sending
            fs.unlinkSync(filePath);

        } catch (err) {
            console.error('[XML ERROR]', err.message);
            await m.reply('❌ Failed to generate the XML file. Please try again later.');
        }
    }
};
