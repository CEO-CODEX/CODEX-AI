const { addExif } = require('../../library/exif');
const { quotedMessage, mimeOf, download } = require('./_utils');
module.exports = { name:'take', alias:['steal','takesticker','takes'], category:'Media', desc:'Rebrand a sticker with CODEX metadata', execute:async(sock,m,{reply,args})=>{ const q=quotedMessage(m), mime=mimeOf(q); if(!/webp/.test(mime)) return reply('Reply to a sticker.'); try { const sticker=await addExif(await download(q),'CODEX AI',args.join(' ')||'CODEX',['']); await sock.sendMessage(m.chat,{sticker},{quoted:m}); } catch(e){ return reply(`Failed: ${e.message}`); } } };
