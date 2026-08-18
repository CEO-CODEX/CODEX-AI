
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'ics',
    aliases: ['calendar', 'event', 'makeics'],
    category: 'documents',
    reactions: { start: '⚙️' },
    description: 'Generate a calendar event (.ics) file.',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        const input = args.join(' ').trim();
        
        if (!input) {
            return await m.reply(`Usage: ${prefix}ics Title | Location | YYYY-MM-DD | HH:MM | Duration(min)\nExample: ${prefix}ics Meeting | Office | 2026-05-10 | 14:00 | 60`);
        }

        const parts = input.split('|').map(p => p.trim());
        const title = parts[0] || 'Event';
        const location = parts[1] || '';
        const date = parts[2] || new Date().toISOString().split('T')[0];
        const time = parts[3] || '12:00';
        const duration = parseInt(parts[4], 10) || 60;

        try {
            await m.reply('📅 Generating calendar event...');

            // Create valid Date objects and ensure they are parsed correctly
            const startDate = new Date(`${date}T${time}:00`);
            if (isNaN(startDate.getTime())) {
                return await m.reply('❌ Invalid date or time format. Please use YYYY-MM-DD and HH:MM.');
            }

            const endDate = new Date(startDate.getTime() + duration * 60000);

            // Format dates to standard ICS timestamp format (YYYYMMDDTHHMMSSZ)
            const formatDateToICS = (d) => {
                return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            };

            const startFormatted = formatDateToICS(startDate);
            const endFormatted = formatDateToICS(endDate);

            // Construct the ICS file content
            let ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\n';
            ics += `DTSTART:${startFormatted}\n`;
            ics += `DTEND:${endFormatted}\n`;
            ics += `SUMMARY:${title}\n`;
            if (location) ics += `LOCATION:${location}\n`;
            ics += 'END:VEVENT\nEND:VCALENDAR';

            // Create temp directory in the root folder if it doesn't exist
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            // Clean the title for a safe filename
            const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
            const filePath = path.join(tempDir, `event_${Date.now()}.ics`);
            
            fs.writeFileSync(filePath, ics);

            const caption = 
                `*📅 CALENDAR EVENT CREATED*\n\n` +
                `*Event:* ${title}\n` +
                (location ? `*Location:* ${location}\n` : '') +
                `*Date:* ${date} at ${time}\n` +
                `*Duration:* ${duration} mins`;

            await bot.sendMessage(m.chat, {
                document: fs.readFileSync(filePath),
                fileName: `${safeTitle}.ics`,
                mimetype: 'text/calendar',
                caption: caption
            }, { quoted: m });

            // Clean up the temp file after sending
            fs.unlinkSync(filePath);

        } catch (err) {
            console.error('[ICS ERROR]', err.message);
            await m.reply('❌ Failed to generate the calendar file. Please check your inputs and try again.');
        }
    }
};
