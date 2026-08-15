
const { Packer, Document, Paragraph, TextRun } = require('docx');

module.exports = {
    name: 'word',
    aliases: ['docx', 'toword', 'text2docx'],
    category: 'documents',
    description: 'Convert text to a .docx document.',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        let text = args.join(' ').trim();

        // Fallback to quoted message text
        if (!text && m.quoted) {
            text = (m.quoted.text || m.quoted.caption || m.quoted.body || '').trim();
        }

        if (!text) {
            return await m.reply(`Usage: ${prefix}word <text>\nOr reply to text with: ${prefix}word`);
        }

        // Limit length for safety
        if (text.length > 15000) {
            text = text.substring(0, 14997) + '...';
        }

        try {
            await m.reply('📄 Creating Word document...');

            // Better line-break handling: split text into multiple paragraphs
            const paragraphs = text.split('\n').map(line => {
                return new Paragraph({
                    children: [
                        new TextRun({
                            text: line || ' ', // Prevent completely empty paragraphs from collapsing
                            size: 24, // 12pt font
                            font: 'Arial'
                        })
                    ]
                });
            });

            // Create DOCX structure
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: paragraphs
                }]
            });

            // Generate buffer directly in memory (no temp file needed!)
            const buffer = await Packer.toBuffer(doc);
            const fileName = `document_${Date.now()}.docx`;

            await bot.sendMessage(m.chat, {
                document: buffer,
                mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                fileName: fileName,
                caption: `*📄 WORD DOCUMENT CREATED*\n\n*Text length:* ${text.length} characters`
            }, { quoted: m });

        } catch (err) {
            console.error('[WORD ERROR]', err.message);
            await m.reply('❌ Failed to create the .docx document. Please try again later.');
        }
    }
};
