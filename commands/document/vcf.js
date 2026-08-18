
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'vcf',
    aliases: ['contact', 'savecontact'],
    category: 'documents',
    reactions: { start: '⚙️' },
    description: 'Generate a contact card (.vcf file).',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        const input = args.join(' ').trim();
        
        if (!input) {
            return await m.reply(`Usage: ${prefix}vcf Name | Phone | Email | Org\nExample: ${prefix}vcf John Doe | 2348012345678 | john@email.com | Company Inc`);
        }

        const parts = input.split('|').map(p => p.trim());
        const name = parts[0] || 'Unknown Contact';
        const phone = parts[1] || '';
        const email = parts[2] || '';
        const org = parts[3] || '';

        try {
            await m.reply('📇 Generating contact card...');

            let vcf = 'BEGIN:VCARD\nVERSION:3.0\n';
            vcf += `FN:${name}\n`;
            
            // Add TEL with waid (WhatsApp ID) so it immediately links to WhatsApp on import
            if (phone) {
                const cleanPhone = phone.replace(/[^0-9]/g, ''); // Strip spaces/pluses for waid
                vcf += `TEL;type=CELL;type=VOICE;waid=${cleanPhone}:${phone}\n`;
            }
            
            if (email) vcf += `EMAIL:${email}\n`;
            if (org) vcf += `ORG:${org}\n`;
            vcf += 'END:VCARD';

            // Create temp directory in the root folder if it doesn't exist
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // Clean the name for a safe filename
            const safeName = name.replace(/[^a-zA-Z0-9]/g, '_') || 'contact';
            const filePath = path.join(tempDir, `${safeName}_${Date.now()}.vcf`);
            
            fs.writeFileSync(filePath, vcf);

            const caption = 
                `*📇 CONTACT CARD GENERATED*\n\n` +
                `*Name:* ${name}\n` +
                (phone ? `*Phone:* ${phone}\n` : '') +
                (email ? `*Email:* ${email}\n` : '') +
                (org ? `*Organization:* ${org}` : '');

            await bot.sendMessage(m.chat, {
                document: fs.readFileSync(filePath),
                fileName: `${safeName}.vcf`,
                mimetype: 'text/vcard',
                caption: caption.trim()
            }, { quoted: m });

            // Clean up the temp file after sending
            fs.unlinkSync(filePath);

        } catch (err) {
            console.error('[VCF ERROR]', err.message);
            await m.reply('❌ Failed to generate the contact card. Please try again later.');
        }
    }
};
