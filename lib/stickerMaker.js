const fs   = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { Sticker } = require('wa-sticker-formatter');

/**
 * bufferToSticker(buffer, { pack, author, isVideo })
 * Converts an image or short video buffer into a WhatsApp-ready webp sticker
 * buffer (with pack/author EXIF metadata baked in via wa-sticker-formatter).
 */
async function bufferToSticker(buffer, { pack = 'CODEX AI', author = 'CODEX', isVideo = false } = {}) {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const input  = path.join(tempDir, `mk_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    const output = input + '.webp';
    fs.writeFileSync(input, buffer);

    try {
        const cmd = isVideo
            ? `ffmpeg -y -i "${input}" -t 5 -vf "fps=12,scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p" -c:v libwebp -lossless 0 -q:v 60 -loop 0 -an -preset default -compression_level 6 "${output}"`
            : `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p" -c:v libwebp -lossless 0 -q:v 80 -an "${output}"`;

        await new Promise((resolve, reject) => {
            exec(cmd, (err) => err ? reject(err) : resolve());
        });

        const webp = fs.readFileSync(output);
        const sticker = new Sticker(webp, { pack, author, type: 'full', quality: 70 });
        return await sticker.toBuffer();
    } finally {
        try { if (fs.existsSync(input))  fs.unlinkSync(input); }  catch {}
        try { if (fs.existsSync(output)) fs.unlinkSync(output); } catch {}
    }
}

module.exports = { bufferToSticker };
