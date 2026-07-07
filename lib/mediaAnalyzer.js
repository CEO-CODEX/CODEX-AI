const fs   = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { downloadContentFromMessage } = require('./baileys');
const smartAI = require('./smartAI');

let sharp = null;
try { sharp = require('sharp'); } catch { sharp = null; }

async function downloadMediaBuffer(mediaMsg, cat) {
    const stream = await downloadContentFromMessage(mediaMsg, cat);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

/** Re-encodes to JPEG (vision APIs are most reliable with jpeg/png) when possible. */
async function toBase64Image(buffer) {
    if (sharp) {
        try {
            const jpeg = await sharp(buffer, { animated: false })
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: 85 })
                .toBuffer();
            return { base64: jpeg.toString('base64'), mimetype: 'image/jpeg' };
        } catch { /* fall through to raw buffer below */ }
    }
    return { base64: buffer.toString('base64'), mimetype: 'image/jpeg' };
}

async function extractVideoFrame(videoBuffer) {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const input  = path.join(tempDir, `frame_${Date.now()}.mp4`);
    const output = input + '.jpg';
    fs.writeFileSync(input, videoBuffer);
    try {
        await new Promise((resolve, reject) => {
            exec(`ffmpeg -y -i "${input}" -vf "select=eq(n\\,0)" -frames:v 1 -q:v 3 "${output}"`, (err) => err ? reject(err) : resolve());
        });
        return fs.existsSync(output) ? fs.readFileSync(output) : null;
    } catch { return null; }
    finally {
        try { if (fs.existsSync(input))  fs.unlinkSync(input); }  catch {}
        try { if (fs.existsSync(output)) fs.unlinkSync(output); } catch {}
    }
}

/** Extracts up to 25s of audio as mp3 (enough for song-ID services), or null if no audio track. */
async function extractAudioTrack(videoBuffer) {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const input  = path.join(tempDir, `aud_${Date.now()}.mp4`);
    const output = input + '.mp3';
    fs.writeFileSync(input, videoBuffer);
    try {
        await new Promise((resolve, reject) => {
            exec(`ffmpeg -y -i "${input}" -t 25 -vn -ac 1 -ar 44100 -b:a 96k "${output}"`, (err) => err ? reject(err) : resolve());
        });
        if (!fs.existsSync(output)) return null;
        const buf = fs.readFileSync(output);
        return buf.length > 2000 ? buf : null; // tiny file ≈ silent/no audio track
    } catch { return null; }
    finally {
        try { if (fs.existsSync(input))  fs.unlinkSync(input); }  catch {}
        try { if (fs.existsSync(output)) fs.unlinkSync(output); } catch {}
    }
}

/** Vision-describe an image buffer (works for static images AND the first frame of a sticker/video). */
async function describeImage({ bot, buffer, question }) {
    const { base64, mimetype } = await toBase64Image(buffer);
    return await smartAI.askVision({
        bot,
        system: 'You are CODEX AI. Describe images clearly, accurately, and concisely — ' +
                'mention key subjects, setting, mood, and any visible text. Do not invent ' +
                'details you are not confident about.',
        user: question || 'Describe this image.',
        imageBase64: base64,
        mimetype,
    });
}

module.exports = { downloadMediaBuffer, toBase64Image, extractVideoFrame, extractAudioTrack, describeImage };
