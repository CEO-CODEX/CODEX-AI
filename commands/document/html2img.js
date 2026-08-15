
const axios = require('axios');

module.exports = {
    name: 'html2img',
    aliases: ['h2i', 'htmltoimg'],
    category: 'converter',
    description: 'Convert HTML code to an image.',

    async execute(bot, m, args) {
        const prefix = bot.prefix || '.';
        let html = args.join(' ').trim();

        // Fallback to quoted message text
        if (!html && m.quoted) {
            html = (m.quoted.text || m.quoted.caption || m.quoted.body || '').trim();
        }

        if (!html) {
            return await m.reply(`Usage: ${prefix}html2img <html>\nOr reply to HTML code with: ${prefix}html2img`);
        }

        try {
            await m.reply('📄 Converting HTML to image...');

            const res = await axios.get(`https://apis.prexzyvilla.site/tools/html2img?html=${encodeURIComponent(html)}`, {
                responseType: 'arraybuffer'
            });

            const buffer = Buffer.from(res.data);

            await bot.sendMessage(m.chat, {
                image: buffer,
                caption: `*📄 HTML TO IMAGE CONVERTED*`
            }, { quoted: m });

        } catch (err) {
            console.error('[HTML2IMG ERROR]', err.message);
            await m.reply('❌ Failed to convert HTML to image. The API might be down or the HTML code might be invalid.');
        }
    }
};
