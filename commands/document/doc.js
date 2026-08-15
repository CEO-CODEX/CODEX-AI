
module.exports = {
    name: 'doc',
    aliases: ['document', 'todoc', 'senddoc'],
    category: 'documents',
    description: 'Convert replied media to a document with a custom name.',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        const quoted = m.quoted;

        if (!quoted) {
            return await m.reply(`Usage: Reply to any media (image, video, audio) with *${prefix}doc [filename]*`);
        }

        const mime = quoted.mimetype || '';
        if (!mime) {
            return await m.reply('❌ No media found in the replied message.');
        }

        let fileName = args.join(' ').trim() || 'converted_file';
        
        // Clean filename & add extension based on mime
        let ext = 'file';
        if (mime.includes('image/webp')) ext = 'webp';
        else if (mime.includes('image/')) ext = 'jpg';
        else if (mime.includes('video/')) ext = 'mp4';
        else if (mime.includes('audio/')) ext = 'mp3';
        else if (mime.includes('pdf')) ext = 'pdf';

        // Ensure the filename has the correct extension
        if (!fileName.toLowerCase().endsWith(`.${ext}`)) {
            fileName += `.${ext}`;
        }

        try {
            await m.reply('📄 Preparing document...');

            // Download the replied media
            const buffer = await quoted.download();
            if (!buffer || buffer.length < 100) {
                return await m.reply('❌ Failed to download media.');
            }

            // Send it back as a document
            await bot.sendMessage(m.chat, {
                document: buffer,
                mimetype: mime,
                fileName: fileName,
                caption: `*📄 DOCUMENT CONVERTED*\n\n*Filename:* ${fileName}`
            }, { quoted: m });

        } catch (e) {
            console.error('[DOC ERROR]', e.message);
            await m.reply('❌ Failed to send as document. Please try again.');
        }
    }
};
