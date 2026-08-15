
const { PDFDocument } = require('pdf-lib');

module.exports = {
    name: 'pdf',
    aliases: ['topdf', 'imgtopdf'],
    category: 'tools',
    description: 'Build a multi-page PDF (add images one by one).',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';

        try {
            // Initialize global queue if it doesn't exist
            if (!global.pdfQueue) global.pdfQueue = {};
            const chatId = m.sender; // Track per user

            if (!global.pdfQueue[chatId]) {
                global.pdfQueue[chatId] = { pages: [] };
            }

            const queue = global.pdfQueue[chatId];
            const subCommand = args[0] ? args[0].toLowerCase() : null;

            // 1. No command = show help + queue status
            if (!subCommand) {
                let text = `*📄 PDF BUILDER*\n\n`;
                text += `*Pages in queue:* ${queue.pages.length}\n\n`;

                if (queue.pages.length > 0) {
                    queue.pages.forEach((page, i) => {
                        const type = page.mime.includes('jpeg') ? 'JPG' : 'PNG';
                        text += `*${i + 1}.* ${type} image\n`;
                    });
                } else {
                    text += '_Queue is empty._\n';
                }

                text += '\n*Commands:*\n';
                text += `• ${prefix}pdf add → Add replied image\n`;
                text += `• ${prefix}pdf del <number> → Remove page\n`;
                text += `• ${prefix}pdf clear → Clear everything\n`;
                text += `• ${prefix}pdf push → Generate & send PDF\n\n`;
                text += `_Reply to an image with ${prefix}pdf add to get started._`;
                
                return await m.reply(text);
            }

            // 2. Add an image to the queue
            if (subCommand === 'add') {
                const quoted = m.quoted;
                const isImage = quoted && (
                    quoted.mtype === 'imageMessage' || 
                    quoted.type === 'image' ||
                    quoted.mimetype?.startsWith('image/')
                );

                if (!isImage) {
                    return await m.reply(`❌ Please reply to a JPG or PNG image.\nExample: Reply to photo with *${prefix}pdf add*`);
                }

                const mimetype = quoted.mimetype || 'image/jpeg';

                if (!mimetype.includes('jpeg') && !mimetype.includes('png')) {
                    return await m.reply('❌ Only JPG and PNG images are supported for PDF conversion.');
                }

                const buffer = await quoted.download();
                if (!buffer) return await m.reply('❌ Failed to download the image.');

                queue.pages.push({ buffer, mime: mimetype });
                return await m.reply(`*✅ Page added!*\nTotal pages: ${queue.pages.length}\n_Type ${prefix}pdf push to generate._`);
            }

            // 3. Delete a specific page
            if (subCommand === 'del') {
                const pageNum = parseInt(args[1], 10);
                if (!pageNum || pageNum < 1 || pageNum > queue.pages.length) {
                    return await m.reply(`❌ Invalid page number! You currently have ${queue.pages.length} pages in the queue.`);
                }
                
                queue.pages.splice(pageNum - 1, 1);
                return await m.reply(`*🗑️ Page ${pageNum} removed!*\nRemaining pages: ${queue.pages.length}`);
            }

            // 4. Clear the queue
            if (subCommand === 'clear') {
                global.pdfQueue[chatId] = { pages: [] };
                return await m.reply('*🧹 PDF queue cleared!*');
            }

            // 5. Generate and send the PDF
            if (subCommand === 'push') {
                if (queue.pages.length === 0) {
                    return await m.reply('❌ Your queue is empty! Add some images first using *' + prefix + 'pdf add*.');
                }

                await m.reply('📄 Generating PDF...');

                const pdfDoc = await PDFDocument.create();

                for (const page of queue.pages) {
                    const pdfPage = pdfDoc.addPage([600, 842]); // Standard A4 dimensions
                    let img;

                    if (page.mime.includes('jpeg') || page.mime.includes('jpg')) {
                        img = await pdfDoc.embedJpg(page.buffer);
                    } else if (page.mime.includes('png')) {
                        img = await pdfDoc.embedPng(page.buffer);
                    }

                    const { width, height } = img;
                    // Scale the image to fit the page while maintaining aspect ratio (95% of page size)
                    const scale = Math.min((600 * 0.95) / width, (842 * 0.95) / height);
                    const imgWidth = width * scale;
                    const imgHeight = height * scale;
                    
                    // Center the image
                    const x = (600 - imgWidth) / 2;
                    const y = (842 - imgHeight) / 2;

                    pdfPage.drawImage(img, { x, y, width: imgWidth, height: imgHeight });
                }

                const pdfBytes = await pdfDoc.save();
                const pdfBuffer = Buffer.from(pdfBytes);

                await bot.sendMessage(m.chat, {
                    document: pdfBuffer,
                    mimetype: 'application/pdf',
                    fileName: `Generated_PDF_${Date.now()}.pdf`,
                    caption: `*📄 PDF GENERATED*\n\n*Total Pages:* ${queue.pages.length}`
                }, { quoted: m });

                // Clear the queue after successful generation
                global.pdfQueue[chatId] = { pages: [] };
                return;
            }

            // Fallback for unknown commands
            return await m.reply(`❌ Unknown command!\nType *${prefix}pdf* to see the menu.`);

        } catch (error) {
            console.error('[PDF ERROR]', error);
            return await m.reply('❌ Failed to process the PDF. Please ensure all queued files are valid images.');
        }
    }
};
                     
