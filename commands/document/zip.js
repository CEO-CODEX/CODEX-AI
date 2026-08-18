
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

module.exports = {
    name: 'zip',
    aliases: ['tozip', 'archive'],
    category: 'documents',
    reactions: { start: '📄', success: '✅' },
    description: 'Build a .zip archive by queuing files one by one.',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        const sender = m.sender;

        // Initialize global queue per user
        if (!global.zipQueues) global.zipQueues = {};
        if (!global.zipQueues[sender]) global.zipQueues[sender] = [];

        const queue = global.zipQueues[sender];
        const cmd = args[0] ? args[0].toLowerCase() : null;

        // 1. HELP / LIST
        if (!cmd || cmd === 'list') {
            let msg = `*📦 ZIP BUILDER*\n\n`;
            msg += `*Items in queue:* ${queue.length}\n\n`;

            if (queue.length === 0) {
                msg += '_Queue is empty._\n\n';
            } else {
                // Cleanly display existing items, handling sparse arrays
                for (let i = 0; i < queue.length; i++) {
                    const item = queue[i];
                    if (item) {
                        msg += `*${i + 1}.* ${item.name || 'unnamed.' + item.ext}\n`;
                    } else {
                        msg += `*${i + 1}.* _[Empty Slot]_\n`;
                    }
                }
                msg += '\n';
            }

            msg += '*Commands:*\n';
            msg += `• ${prefix}zip <number> → Add replied media (e.g., ${prefix}zip 1)\n`;
            msg += `• ${prefix}zip remove <number> → Remove item\n`;
            msg += `• ${prefix}zip clear → Empty queue\n`;
            msg += `• ${prefix}zip push → Create & send .zip file\n\n`;
            msg += `_Reply to a file/media with ${prefix}zip 1 to start._`;

            return await m.reply(msg);
        }

        // 2. CLEAR QUEUE
        if (cmd === 'clear') {
            global.zipQueues[sender] = [];
            return await m.reply('*🧹 Zip queue cleared!*');
        }

        // 3. REMOVE ITEM
        if (cmd === 'remove') {
            const num = parseInt(args[1], 10);
            if (!num || num < 1 || num > queue.length) {
                return await m.reply(`❌ Invalid number! You currently have ${queue.length} items in the queue.`);
            }
            
            queue.splice(num - 1, 1);
            
            // Clean up any trailing empty slots caused by splice
            while (queue.length > 0 && !queue[queue.length - 1]) queue.pop();
            
            return await m.reply(`*🗑️ Item ${num} removed!*\nQueue now has ${queue.length} items.`);
        }

        // 4. PUSH / CREATE ZIP
        if (cmd === 'push') {
            // Filter out empty slots in case the user skipped numbers (e.g., zip 1, then zip 3)
            const validItems = queue.filter(item => item !== undefined && item !== null);
            
            if (validItems.length === 0) {
                return await m.reply(`❌ Your queue is empty! Add files first with *${prefix}zip 1*, *${prefix}zip 2*, etc.`);
            }

            await m.reply('📦 Zipping files...');

            // Create temp directory in the root folder if it doesn't exist
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const zipName = `archive_${Date.now()}.zip`;
            const zipPath = path.join(tempDir, zipName);
            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 6 } });

            archive.pipe(output);

            for (const item of validItems) {
                archive.append(item.buffer, { name: item.name });
            }

            await new Promise((resolve, reject) => {
                output.on('close', resolve);
                archive.on('error', reject);
                archive.finalize();
            });

            if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 100) {
                if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                return await m.reply('❌ Zipping failed - the archive was empty or invalid.');
            }

            const zipBuffer = fs.readFileSync(zipPath);

            await bot.sendMessage(m.chat, {
                document: zipBuffer,
                mimetype: 'application/zip',
                fileName: zipName,
                caption: `*📦 ZIP ARCHIVE GENERATED*\n\n*Total Files:* ${validItems.length}`
            }, { quoted: m });

            // Cleanup the temp file
            fs.unlinkSync(zipPath);
            
            // Auto-clear the user's queue after a successful push
            global.zipQueues[sender] = []; 
            return;
        }

        // 5. ADD ITEM (.zip 1, .zip 2, etc.)
        const index = parseInt(cmd, 10);
        if (isNaN(index) || index < 1) {
            return await m.reply(`❌ Use *${prefix}zip <number>* (e.g., ${prefix}zip 1) while replying to a file to add it.`);
        }

        const quoted = m.quoted;
        if (!quoted) {
            return await m.reply(`❌ Please reply to a media message or document when using *${prefix}zip ${index}*.`);
        }

        // Check if message type has downloadable content
        const isDownloadable = quoted.mimetype || 
            quoted.mtype === 'documentMessage' ||
            quoted.mtype === 'imageMessage' ||
            quoted.mtype === 'videoMessage' ||
            quoted.mtype === 'audioMessage' ||
            quoted.mtype === 'stickerMessage' ||
            quoted.type === 'document' ||
            quoted.type === 'image' ||
            quoted.type === 'video';

        if (!isDownloadable) {
            return await m.reply('❌ The replied message does not contain downloadable media or a file.');
        }

        let buffer;
        try {
            buffer = await quoted.download();
        } catch (err) {
            return await m.reply('❌ Failed to download the replied file.');
        }

        if (!buffer || buffer.length < 100) {
            return await m.reply('❌ The downloaded file is empty or corrupted.');
        }

        let ext = 'bin';
        const mime = quoted.mimetype || '';
        
        // Try extracting real extension from original filename if it's a document
        if (quoted.fileName) {
            const parts = quoted.fileName.split('.');
            if (parts.length > 1) ext = parts[parts.length - 1];
        } else {
            // Fallback to MIME type guessing
            if (mime.startsWith('image/')) ext = mime.split('/')[1] || 'jpg';
            else if (mime.startsWith('video/')) ext = 'mp4';
            else if (mime.startsWith('audio/')) ext = 'mp3';
            else if (mime === 'image/webp') ext = 'webp';
            else if (mime.includes('pdf')) ext = 'pdf';
        }

        // Clean up the extension if it has extra MIME parameters (e.g., "jpeg; codecs=...")
        ext = ext.split(';')[0];

        const itemName = `file_${index}.${ext}`;
        const item = {
            buffer,
            name: itemName,
            ext
        };

        // Overwrite or place at specific index
        queue[index - 1] = item;

        await m.reply(`*✅ Added as item #${index}* (${itemName})\n\nQueue now has ${queue.length} item(s).\n_Use ${prefix}zip push to create the zip._`);
    }
};
                   
