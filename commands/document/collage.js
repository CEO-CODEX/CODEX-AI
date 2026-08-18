
const sharp = require('sharp');

module.exports = {
    name: 'collage',
    aliases: ['combine', 'merge'],
    category: 'media',
    reactions: { start: '📄', success: '✅' },
    description: 'Queue images and merge them into a customizable collage.',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        const subcommand = args[0] ? args[0].toLowerCase() : null;
        const sessionKey = `${m.sender}_${m.chat}`; // Track per user, per chat

        // Initialize global sessions map if it doesn't exist
        if (!global.collageSessions) global.collageSessions = new Map();

        // 1. ADD command
        if (subcommand === 'add') {
            const quoted = m.quoted;
            const isImage = quoted && (
                quoted.mtype === 'imageMessage' || 
                quoted.type === 'image' ||
                quoted.mimetype?.startsWith('image/')
            );

            if (!isImage) {
                return await m.reply(`❌ Please reply to an image.\nUsage: Reply to photo with *${prefix}collage add*`);
            }

            let imgBuffer;
            try {
                imgBuffer = await quoted.download();
            } catch (err) {
                return await m.reply('❌ Failed to download the image.');
            }

            if (!imgBuffer) return await m.reply('❌ The downloaded image is empty or corrupted.');

            // Get or create session
            let session = global.collageSessions.get(sessionKey);
            if (!session) {
                session = { images: [], layout: 'grid' };
                global.collageSessions.set(sessionKey, session);
            }
            
            session.images.push(imgBuffer);

            return await m.reply(`*✅ Image added!*\nTotal images: ${session.images.length}\n_Type ${prefix}collage push to generate._`);
        }

        // 2. CLEAR command (Quality of life upgrade)
        if (subcommand === 'clear') {
            global.collageSessions.delete(sessionKey);
            return await m.reply('*🧹 Collage queue cleared!*');
        }

        // 3. PUSH command (generate collage)
        if (subcommand === 'push') {
            const session = global.collageSessions.get(sessionKey);
            
            if (!session || session.images.length < 2) {
                return await m.reply(`❌ You need at least 2 images to make a collage. Use *${prefix}collage add* on replied images first.`);
            }

            // Optional layout argument
            let layout = args[1]?.toLowerCase() || session.layout || 'grid';
            if (!['grid', 'row', 'col', 'column'].includes(layout)) {
                layout = 'grid';
            }

            await m.reply('🖼️ Generating collage...');

            try {
                const images = session.images;
                const SIZE = 512;
                const GAP = 4;
                const count = images.length;
                
                const isRow = layout === 'row';
                const isCol = layout === 'col' || layout === 'column';
                const isGrid = layout === 'grid';

                // Resize all images to uniform squares
                const resized = await Promise.all(
                    images.map(buf =>
                        sharp(buf)
                            .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
                            .png()
                            .toBuffer()
                    )
                );

                let collageBuffer;

                if (isRow || (isGrid && count === 2)) {
                    // ROW LAYOUT
                    const totalW = SIZE * count + GAP * (count - 1);
                    const base = sharp({
                        create: { width: totalW, height: SIZE, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } }
                    });
                    const composites = resized.map((buf, i) => ({
                        input: buf,
                        left: i * (SIZE + GAP),
                        top: 0
                    }));
                    collageBuffer = await base.composite(composites).jpeg({ quality: 92 }).toBuffer();
                    
                } else if (isCol) {
                    // COLUMN LAYOUT
                    const totalH = SIZE * count + GAP * (count - 1);
                    const base = sharp({
                        create: { width: SIZE, height: totalH, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } }
                    });
                    const composites = resized.map((buf, i) => ({
                        input: buf,
                        left: 0,
                        top: i * (SIZE + GAP)
                    }));
                    collageBuffer = await base.composite(composites).jpeg({ quality: 92 }).toBuffer();
                    
                } else {
                    // GRID LAYOUT
                    const cols = count <= 2 ? count : 2; // Default to 2 columns for grid
                    const rows = Math.ceil(count / cols);
                    const totalW = cols * SIZE + GAP * (cols - 1);
                    const totalH = rows * SIZE + GAP * (rows - 1);
                    
                    const base = sharp({
                        create: { width: totalW, height: totalH, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } }
                    });
                    const composites = resized.map((buf, i) => ({
                        input: buf,
                        left: (i % cols) * (SIZE + GAP),
                        top: Math.floor(i / cols) * (SIZE + GAP)
                    }));
                    collageBuffer = await base.composite(composites).jpeg({ quality: 92 }).toBuffer();
                }

                await bot.sendMessage(m.chat, {
                    image: collageBuffer,
                    caption: `*🖼️ COLLAGE GENERATED*\n*Images:* ${count} | *Layout:* ${layout.toUpperCase()}`
                }, { quoted: m });

                // Clear session after successful push
                global.collageSessions.delete(sessionKey);

            } catch (err) {
                console.error('[COLLAGE PUSH ERROR]', err.message);
                await m.reply('❌ Failed to generate the collage. Please ensure all uploaded files are valid images.');
            }
            return;
        }

        // 4. No valid subcommand: show usage
        let helpText = `*🖼️ COLLAGE BUILDER*\n\n`;
        helpText += `*Usage:*\n`;
        helpText += `*1.* Reply to an image with *${prefix}collage add*\n`;
        helpText += `*2.* Repeat for 2 or more images\n`;
        helpText += `*3.* Generate with *${prefix}collage push*\n\n`;
        helpText += `*Commands:*\n`;
        helpText += `• ${prefix}collage add → Add image\n`;
        helpText += `• ${prefix}collage clear → Reset queue\n`;
        helpText += `• ${prefix}collage push [row|col|grid] → Generate\n`;
        
        return await m.reply(helpText);
    }
};
                  
