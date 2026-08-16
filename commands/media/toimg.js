const sharp = require('sharp');
const { quotedMessage, mimeOf, download } = require('./_utils');
module.exports = { name: 'toimg', alias: ['stickertoimg', 'toimage'], category: 'Media', desc: 'Convert a sticker to an image', execute: async (client, m, { reply }) => { const q = quotedMessage(m), mime = mimeOf(q); if (!/webp/.test(mime)) return reply('Reply to a sticker.'); try { const image = await sharp(await download(q)).png().toBuffer(); await client.sendMessage(m.chat, { image, mimetype: 'image/png' }, { quoted: m }); } catch (e) { return reply(`Failed: ${e.message}`); } } };
