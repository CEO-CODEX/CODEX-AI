const chalk = require("chalk");
const fs = require("fs-extra");
const { getContentType, downloadContentFromMessage } = require("./lib/baileys");
const { applyPrefix } = require("./lib/characterEngine");
const { applyFont } = require("./lib/fontEngine");

// Nigerian time helper (Africa/Lagos = UTC+1)
function nigerianTime() {
  return new Date().toLocaleTimeString("en-NG", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
function nigerianDateTime() {
  return new Date().toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

const config = require("./config.json");
const CommandHandler = require("./lib/commandHandler");
const MessageHandler = require("./lib/messageHandler");
const AntiSystems = require("./lib/antiSystems");
const AFKSystem = require("./lib/afkSystem");
const Permission = require("./lib/permission");
const Reloader = require("./lib/reloader");
const {
  startConnection,
  readMsgCache,
  writeMsgCache,
} = require("./lib/connection");

// ── Ensure dirs & DBs ─────────────────────────────────────────────────────────
["./database", "./session", "./commands", "./plugins", "./lib"].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});
[
  "./database/antilink.json",
  "./database/antispam.json",
  "./database/antitag.json",
  "./database/antigame.json",
  "./database/antigroupmention.json",
  "./database/antidelete.json",
  "./database/antiedit.json",
  "./database/variables.json",
  "./database/afk.json",
  "./database/warnings.json",
  "./database/sudo.json",
  "./database/notes.json",
  "./database/stickercmds.json",
  "./database/msgcache.json",
  "./database/muteusers.json",
  "./database/scheduledJobs.json",
  "./database/statusmention.json",
  "./database/welcome.json",
  "./database/goodbye.json",
  "./database/autoreply.json",
  "./database/autosavestatus.json",
  "./database/autoreact.json",
  "./database/autovv.json",
  "./database/vv-reactions.json",
  "./database/mention_config.json",
  "./database/antiedit.json",
  "./database/chatbotgroup.json",
  "./database/chatbotdm.json",
  "./database/chatbotglobal.json",
].forEach((db) => {
  if (!fs.existsSync(db)) {
    const defaults = {
      "./database/antiedit.json": JSON.stringify(
        { chats: {}, _globalPriv: false, _mode: "dm" },
        null,
        2,
      ),
      "./database/autosavestatus.json": JSON.stringify(
        { enabled: false, mode: "dm", target: null },
        null,
        2,
      ),
      "./database/autoreact.json": JSON.stringify(
        {
          enabled: false,
          emojis: [
            "😂",
            "🔥",
            "👍",
            "❤️",
            "😍",
            "🎉",
            "👏",
            "✨",
            "💯",
            "🙏",
            "❤️‍🔥",
            "👀",
          ],
        },
        null,
        2,
      ),
      "./database/mention_config.json": JSON.stringify(
        { active: false, action: "", emoji: "❤️‍🔥", text: "" },
        null,
        2,
      ),
      "./database/chatbotdm.json": JSON.stringify(
        { enabled: false, voice: false },
        null,
        2,
      ),
      "./database/chatbotglobal.json": JSON.stringify(
        {
          allGroupsEnabled: false,
          character: "machine",
          train:
            "You believe Messi is the greatest footballer of all time, and Ronaldo is your rival in football debates — you playfully criticize him. ONLY bring this up if someone else brings up football, Messi, or Ronaldo first — never volunteer it unprompted in unrelated conversation.",
          personality: null,
          emojiPool: [],
          emojiReactEnabled: false,
        },
        null,
        2,
      ),
    };
    fs.writeFileSync(db, defaults[db] || JSON.stringify({}, null, 2));
  }
});

// ── Buffer-safe (de)serialization for the JSON message cache ───────────────
// Media submessages carry Buffer fields (mediaKey, fileEncSha256, etc.) that
// JSON.stringify mangles by default — tag them so they round-trip correctly
// through the file-based cache and remain usable with downloadContentFromMessage.
function _serializeForCache(obj) {
  if (Buffer.isBuffer(obj))
    return { __buf: true, data: obj.toString("base64") };
  if (Array.isArray(obj)) return obj.map(_serializeForCache);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = _serializeForCache(obj[k]);
    return out;
  }
  return obj;
}
function _deserializeFromCache(obj) {
  if (
    obj &&
    typeof obj === "object" &&
    obj.__buf &&
    typeof obj.data === "string"
  ) {
    return Buffer.from(obj.data, "base64");
  }
  if (Array.isArray(obj)) return obj.map(_deserializeFromCache);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = _deserializeFromCache(obj[k]);
    return out;
  }
  return obj;
}
const _RECOVERABLE_MEDIA_TYPES = [
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "documentMessage",
  "stickerMessage",
];

class CODEXAI {
  constructor() {
    this.sock = null;
    this.commands = new Map();
    this.config = config;
    // ── Merge persisted setvar variables into config on every boot ────────
    try {
      const vars = JSON.parse(
        require("fs-extra").readFileSync("./database/variables.json", "utf8"),
      );
      for (const [k, v] of Object.entries(vars)) {
        // Numeric keys stored as strings — restore correct type
        const num = Number(v);
        this.config[k] = v !== "" && !isNaN(num) ? num : v;
      }
    } catch {}
    // prefix as getter so setvar PREFIX takes effect immediately without restart
    Object.defineProperty(this, "prefix", {
      get: () => this.config.prefix || ".",
      set: (v) => {
        this.config.prefix = v;
      },
      configurable: true,
    });
    this.commandHandler = new CommandHandler(this);
    this.messageHandler = new MessageHandler(this);
    this.antiSystems = new AntiSystems(this);
    this.afkSystem = new AFKSystem(this);
    this.permission = new Permission(this);
    this.reloader = new Reloader(this);
    this.totalCmds = 0;
    this.successCmds = 0;
    this.failedCmds = 0;
    this._heartbeatInterval = null;
  }

  async start() {
    console.log(chalk.cyan("\n╔════════════════════════════════════╗"));
    console.log(chalk.cyan("║       🤖 CODEX-AI V3.0              ║"));
    console.log(chalk.cyan("╚════════════════════════════════════╝"));
    const { loaded, failed } = await this.reloader.loadCommands();
    console.log(chalk.yellow(`\n📦 Commands loaded: ${chalk.bold(loaded)}`));
    if (failed > 0) console.log(chalk.red(`❌ Failed: ${failed} commands`));
    console.log("");
    await startConnection(this);
  }

  // ── Message cache ─────────────────────────────────────────────────────────
  _cacheMessage(msg) {
    try {
      const cache = readMsgCache();
      const type = getContentType(msg.message);
      const inner = msg.message[type];
      let text = "";
      if (typeof inner === "string") text = inner;
      else text = inner?.text || inner?.caption || inner?.conversation || "";
      const sender = msg.key.participant
        ? msg.key.participant.replace(/:[0-9]+@/, "@")
        : msg.key.remoteJid.replace(/:[0-9]+@/, "@");
      // Store media URL for antidelete forwarding
      const mediaUrl = inner?.url || inner?.directPath || null;

      // Full media submessage (mediaKey + co.) so a deleted/edited photo,
      // video, voice note, sticker, or doc can actually be re-downloaded
      // and resent later — not just shown as a "[Image]" placeholder.
      let media = null;
      if (
        _RECOVERABLE_MEDIA_TYPES.includes(type) &&
        inner &&
        typeof inner === "object"
      ) {
        media = { type, msg: _serializeForCache(inner) };
      }

      cache[msg.key.id] = {
        id: msg.key.id,
        chat: msg.key.remoteJid,
        sender,
        type,
        text,
        mediaUrl,
        media,
        pushName: msg.pushName || "",
        ts: Date.now(),
      };
      writeMsgCache(cache);
    } catch {}
  }

  // ── Anti-Delete (CRYSNOVA-mapped logic) ─────────────────────────────────────
  async _handleAntiDelete(revokedKey, fallbackChat) {
    try {
      const chat = revokedKey?.remoteJid || fallbackChat;
      const msgId = revokedKey?.id;
      if (!chat || !msgId) return;

      const isGroup = chat.endsWith("@g.us");
      const isPrivate = !isGroup;
      const isStatus = chat === "status@broadcast";
      if (isStatus) return;

      let db = {};
      try {
        db = JSON.parse(fs.readFileSync("./database/antidelete.json", "utf8"));
      } catch {}

      const enabledForChat = !!db[chat];
      const enabledGlobally = isPrivate && !!db._globalPriv;
      if (!enabledForChat && !enabledGlobally) return;

      const mode = db._mode || "dm";
      const ownerDM =
        (typeof this.config.owner === "object"
          ? this.config.owner?.number
          : this.config.owner) || "";
      const cache = readMsgCache();
      const cached = cache[msgId];

      const deleter = (
        revokedKey?.participant ||
        revokedKey?.remoteJid ||
        ""
      ).replace(/:[0-9]+@/, "@");
      const senderJid = cached?.sender || deleter;
      const senderNum = senderJid.split("@")[0];
      const deleterNum = deleter.split("@")[0];
      const pushName = cached?.pushName || senderNum;
      const time = nigerianTime();

      // Build message content display (mirrors CRYSNOVA getMessageContent)
      let msgContent = "(message not cached)";
      if (cached) {
        if (cached.text) msgContent = cached.text;
        else if (cached.type === "imageMessage")
          msgContent = "[Image]" + (cached.text ? ` ${cached.text}` : "");
        else if (cached.type === "videoMessage")
          msgContent = "[Video]" + (cached.text ? ` ${cached.text}` : "");
        else if (cached.type === "audioMessage") msgContent = "[Voice message]";
        else if (cached.type === "stickerMessage") msgContent = "[Sticker]";
        else if (cached.type === "documentMessage") msgContent = "[Document]";
      }

      let formatted = `*ⓘ DELETED!*
`;

      if (isGroup) {
        let groupName = "Unknown Group";
        try {
          const meta = await this.sock.groupMetadata(chat);
          groupName = meta.subject || groupName;
        } catch {}
        formatted += `_❏◦Group_ •⌲ ${groupName}
`;
        formatted += `_𓋎◦Sender_ •⌲ @${senderNum} (${pushName})
`;
        formatted += `_❏◦Deleted by_ •⌲ @${deleterNum}
`;
      } else {
        formatted += `_❏◦Chat_ •⌲ ${pushName}
`;
        formatted += `_𓋎◦Sender_ •⌲ @${senderNum}
`;
      }

      formatted += `╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ᕗ
`;
      formatted += `_*⎙ Original message:*_
☇
${msgContent}

`;
      formatted += `✐ ${time} (NG)`;

      const mentions = [senderJid];
      if (deleter && deleter !== senderJid) mentions.push(deleter);

      const dest = mode === "chat" ? chat : ownerDM;

      // ── Try to recover & resend the actual media (SUKUNA-style capture) ──
      if (cached?.media?.msg) {
        try {
          const catMap = {
            imageMessage: "image",
            videoMessage: "video",
            audioMessage: "audio",
            documentMessage: "document",
            stickerMessage: "sticker",
          };
          const cat = catMap[cached.media.type];
          if (cat) {
            const mediaMsg = _deserializeFromCache(cached.media.msg);
            const stream = await downloadContentFromMessage(mediaMsg, cat);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buf = Buffer.concat(chunks);

            if (buf.length > 0) {
              if (cat === "image") {
                await this.sendMessage(dest, {
                  image: buf,
                  caption: formatted,
                  mentions,
                }).catch(() => {});
              } else if (cat === "video") {
                await this.sendMessage(dest, {
                  video: buf,
                  caption: formatted,
                  mentions,
                }).catch(() => {});
              } else if (cat === "document") {
                await this.sendMessage(dest, {
                  document: buf,
                  mimetype: mediaMsg.mimetype || "application/octet-stream",
                  fileName: mediaMsg.fileName || "recovered_file",
                }).catch(() => {});
                await this.sendMessage(dest, {
                  text: formatted,
                  mentions,
                }).catch(() => {});
              } else if (cat === "audio") {
                await this.sendMessage(dest, {
                  audio: buf,
                  mimetype: mediaMsg.mimetype || "audio/ogg; codecs=opus",
                  ptt: !!mediaMsg.ptt,
                }).catch(() => {});
                await this.sendMessage(dest, {
                  text: formatted,
                  mentions,
                }).catch(() => {});
              } else if (cat === "sticker") {
                await this.sendMessage(dest, { sticker: buf }).catch(() => {});
                await this.sendMessage(dest, {
                  text: formatted,
                  mentions,
                }).catch(() => {});
              }
              return; // media path already covered the notice too
            }
          }
        } catch (e) {
          console.error("[AntiDelete media recovery]", e.message);
        }
      }

      // ── Fallback: text-only notice (no media cached, or recovery failed) ──
      await this.sendMessage(dest, { text: formatted, mentions }).catch(
        () => {},
      );
    } catch (err) {
      console.error("AntiDelete error:", err.message);
    }
  }

  // ── Anti-Edit (CRYSNOVA-mapped logic) ────────────────────────────────────
  async _handleAntiEdit(editedKey, editedMsg, fallbackChat) {
    try {
      const chat = editedKey?.remoteJid || fallbackChat;
      const msgId = editedKey?.id;
      if (!chat || !msgId) return;

      const isGroup = chat.endsWith("@g.us");
      const isPrivate = !isGroup;

      let db = { chats: {}, _globalPriv: false, _mode: "dm" };
      try {
        db = JSON.parse(fs.readFileSync("./database/antiedit.json", "utf8"));
      } catch {}
      if (!db.chats) db.chats = {};

      const enabledForChat = !!db.chats[chat];
      const enabledGlobally = isPrivate && !!db._globalPriv;
      if (!enabledForChat && !enabledGlobally) return;

      const mode = db._mode || "dm";
      const ownerDM =
        (typeof this.config.owner === "object"
          ? this.config.owner?.number
          : this.config.owner) || "";
      const cache = readMsgCache();
      const cached = cache[msgId];

      const editor = (
        editedKey?.participant ||
        editedKey?.remoteJid ||
        ""
      ).replace(/:[0-9]+@/, "@");
      const senderJid = cached?.sender || editor;
      const senderNum = senderJid.split("@")[0];
      const pushName = cached?.pushName || senderNum;
      const time = nigerianTime();

      // Get original text from cache
      const originalText = cached?.text || "(original not cached)";

      // Get new edited text
      let newText = "";
      try {
        const inner =
          editedMsg?.editedMessage ||
          editedMsg?.message?.editedMessage ||
          editedMsg?.protocolMessage?.editedMessage;
        newText = inner?.conversation || inner?.extendedTextMessage?.text || "";
        if (!newText) {
          // Try deeper
          const str = JSON.stringify(editedMsg || {});
          const match = str.match(/"(?:conversation|text)":"(.*?)"/);
          if (match) newText = match[1].replace(/\\n/g, "\n");
        }
      } catch {}

      let formatted = `*✎ EDITED MESSAGE*
`;

      if (isGroup) {
        let groupName = "Unknown Group";
        try {
          const meta = await this.sock.groupMetadata(chat);
          groupName = meta.subject || groupName;
        } catch {}
        formatted += `_❏◦Group_ •⌲ ${groupName}
`;
        formatted += `_𓋎◦Sender_ •⌲ @${senderNum} (${pushName})
`;
      } else {
        formatted += `_❏◦Chat_ •⌲ ${pushName}
`;
        formatted += `_𓋎◦Sender_ •⌲ @${senderNum}
`;
      }

      formatted += `╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ᕗ
`;
      formatted += `_*⎙ Before (Original):*_
☇
${originalText}

`;
      formatted += `_*✎ After (Edited):*_
☇
${newText || "(could not read new text)"}

`;
      formatted += `✐ ${time} (NG)`;

      const mentions = [senderJid];
      if (editor && editor !== senderJid) mentions.push(editor);

      const dest = mode === "chat" ? chat : ownerDM;
      await this.sendMessage(dest, { text: formatted, mentions }).catch(
        () => {},
      );

      // Update cache with new text
      if (cached && newText) {
        cache[msgId].text = newText;
        writeMsgCache(cache);
      }
    } catch (err) {
      console.error("AntiEdit error:", err.message);
    }
  }

  // ── Startup message ───────────────────────────────────────────────────────
  async sendStartupMessage() {
    const c = this.config;
    const fs2 = require("fs-extra");
    const getDb = (p, def) => {
      try {
        return JSON.parse(fs2.readFileSync(p, "utf8"));
      } catch {
        return def;
      }
    };
    const antiDelDb = getDb("./database/antidelete.json", {});
    const antiEditDb = getDb("./database/antiedit.json", {});
    const autoReactDb = getDb("./database/autoreact.json", {});
    const autoRepDb = getDb("./database/autoreply.json", {});
    const statusDb = getDb("./database/autostatus.json", {});

    const CHANNEL_JID = "120363425299923811@newsletter";
    const CHANNEL_LINK =
      "https://whatsapp.com/channel/0029Vb4Z7mD8KMqnVFSZIy1K";
    const GROUP_LINK =
      "https://chat.whatsapp.com/FIqZQ9u40SbH1E3zIEBfcs?mode=gi_t";
    const CODEX_IMG = "https://i.ibb.co/5W3NWVV/codex.jpg";
    const botName = c.settings?.title || c.botName || "CODEX AI";
    const prefix = c.prefix || ".";
    // owner.number can be object {number} or plain string
    const ownerNum =
      (typeof c.owner === "object" ? c.owner?.number : c.owner) || "";
    const ownerJid = ownerNum.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    const time = new Date()
      .toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Africa/Lagos",
      })
      .toLowerCase();

    const startupText = `—͟͟͞͞𖣘 *${botName.toUpperCase()}* IS ONLINE!

—͟͟͞͞𖣘 *PREFIX:* ${prefix}
—͟͟͞͞𖣘 *MODE:* ${(c.mode || "private").toUpperCase()}
—͟͟͞͞𖣘 *CMDS:* ${this.successCmds} loaded
—͟͟͞͞𖣘 *TIME:* ${time}

—͟͟͞͞𖣘 *ANTIDELETE* ${Object.keys(antiDelDb).filter((k) => !k.startsWith("_")).length > 0 ? "✓" : "✗"}
—͟͟͞͞𖣘 *ANTIEDIT* ${Object.keys(antiEditDb.chats || {}).length > 0 ? "✓" : "✗"}
—͟͟͞͞𖣘 *AUTOREACT* ${autoReactDb.enabled ? "✓" : "✗"}
—͟͟͞͞𖣘 *AUTOREPLY* ${autoRepDb.enabled ? "✓" : "✗"}
—͟͟͞͞𖣘 *AUTOSTATUS* ${statusDb.autoView || statusDb.autoview || statusDb.autoReact || statusDb.statusView?.enabled ? "✓" : "✗"}

📣 *CHANNEL:*
${CHANNEL_LINK}

🥏 *GROUP:*
${GROUP_LINK}

𝗖𝗢𝗗𝗘𝗫 𝐀𝐈 𝐕𝟑`;

    let thumbBuf = null;
    let rawImgBuf = null;
    try {
      const axios = require("axios");
      const resp = await axios.get(
        c.thumbUrl || c.settings?.thumbUrl || CODEX_IMG,
        { responseType: "arraybuffer", timeout: 10000 },
      );
      rawImgBuf = Buffer.from(resp.data);
      try {
        const sharp = require("sharp");
        thumbBuf = await sharp(rawImgBuf)
          .resize(192, 192, { fit: "cover" })
          .jpeg({ quality: 70 })
          .toBuffer();
      } catch {
        thumbBuf = rawImgBuf; // sharp unavailable — use the raw image as-is
      }
    } catch (e1) {
      console.log("[Startup] thumbnail fetch failed:", e1.message);
    }

    // Context info — newsletter forward badge (green V channel card)
    const ctxInfo = {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: CHANNEL_JID,
        newsletterName: "𝘾𝗢𝗗𝗘𝗫 𝗢𝗙𝗙𝗜𝗖𝗜𝗔𝗟 ✓",
        serverMessageId: 143,
      },
      externalAdReply: {
        title: "𝘾𝗢𝗗𝗘𝗫 𝗢𝗙𝗙𝗜𝗖𝗜𝗔𝗟 ✓",
        body: "TAP TO JOIN CHANNEL",
        sourceUrl: CHANNEL_LINK,
        mediaType: 1,
        renderLargerThumbnail: true,
        showAdAttribution: false,
        thumbnailUrl: CODEX_IMG,
        // WhatsApp clients mostly ignore thumbnailUrl for ad-reply cards and
        // need the actual embedded JPEG bytes to render anything but a blank
        // dark box — this is what was missing.
        ...(thumbBuf ? { jpegThumbnail: thumbBuf } : {}),
      },
    };

    try {
      const axios = require("axios");
      let imgBuf = rawImgBuf;
      const imgUrl = c.thumbUrl || c.settings?.thumbUrl || CODEX_IMG;
      if (!imgBuf) {
        try {
          const resp = await axios.get(imgUrl, {
            responseType: "arraybuffer",
            timeout: 10000,
          });
          imgBuf = Buffer.from(resp.data);
        } catch (e2) {
          console.log("[Startup] img fetch failed:", e2.message);
        }
      }

      // Step 1 — Send text with green channel badge (contextInfo works on text)
      await this.sock
        .sendMessage(ownerJid, {
          text: startupText,
          contextInfo: ctxInfo,
        })
        .catch(() => {});

      // Step 2 — Send image separately (clean, no caption)
      if (imgBuf) {
        await new Promise((r) => setTimeout(r, 1500));
        await this.sock
          .sendMessage(ownerJid, {
            image: imgBuf,
            caption: `🤖 *${botName}* is now online and ready.`,
          })
          .catch(() => {});
      }
    } catch (e) {
      console.log("[Startup] error:", e.message);
      try {
        await this.sock.sendMessage(ownerJid, { text: startupText });
      } catch {}
    }
  }

  // ── Group join/leave ──────────────────────────────────────────────────────
  async handleGroupUpdate({ id, participants, action }) {
    if (action === "add") {
      let db = {};
      try {
        db = JSON.parse(fs.readFileSync("./database/welcome.json", "utf8"));
      } catch {}
      const cfg = db[id];
      // per-group on/off: if explicitly set to false, skip. Global config.welcome as fallback.
      const enabled = cfg
        ? cfg.enabled !== false
        : this.config.welcome !== false;
      if (!enabled) return;

      for (const user of participants) {
        try {
          const meta = await this.sock.groupMetadata(id);
          const customText = cfg?.text || null;
          // Replace @user anywhere in the message (not just {user})
          const msg = customText
            ? customText
                .replace(/@user/gi, `@${user.split("@")[0]}`)
                .replace(/\{user\}/gi, `@${user.split("@")[0]}`)
                .replace(/\{group\}/gi, meta.subject)
                .replace(/\{count\}/gi, String(meta.participants.length))
            : `Welcome to ${meta.subject}!\n\n@${user.split("@")[0]} just joined.\nMembers: ${meta.participants.length}`;
          try {
            const ppUrl = await this.sock.profilePictureUrl(user, "image");
            await this.sock.sendMessage(id, {
              image: { url: ppUrl },
              caption: msg,
              mentions: [user],
            });
          } catch {
            await this.sendMessage(id, { text: msg, mentions: [user] });
          }
        } catch (e) {
          console.error("Welcome error:", e.message);
        }
      }
    } else if (action === "remove") {
      let db = {};
      try {
        db = JSON.parse(fs.readFileSync("./database/goodbye.json", "utf8"));
      } catch {}
      const cfg = db[id];
      const enabled = cfg
        ? cfg.enabled !== false
        : this.config.goodbye !== false;
      if (!enabled) return;

      for (const user of participants) {
        try {
          const meta = await this.sock.groupMetadata(id).catch(() => null);
          const customText = cfg?.text || null;
          const msg = customText
            ? customText
                .replace(/@user/gi, `@${user.split("@")[0]}`)
                .replace(/\{user\}/gi, `@${user.split("@")[0]}`)
                .replace(/\{group\}/gi, meta?.subject || "the group")
                .replace(
                  /\{count\}/gi,
                  String(meta?.participants?.length || "?"),
                )
            : `Goodbye @${user.split("@")[0]}! We will miss you.`;
          try {
            const ppUrl = await this.sock.profilePictureUrl(user, "image");
            await this.sock.sendMessage(id, {
              image: { url: ppUrl },
              caption: msg,
              mentions: [user],
            });
          } catch {
            await this.sendMessage(id, { text: msg, mentions: [user] });
          }
        } catch (e) {
          console.error("Goodbye error:", e.message);
        }
      }
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────
  // Single pipeline: font + character/emoji applied here for ALL commands.
  async sendMessage(jid, content, options = {}) {
    try {
      const fontNum = this.config.BOT_FONT || 0;
      // Apply font to text and caption
      if (typeof content.text === "string" && fontNum > 0)
        content.text = applyFont(content.text, fontNum);
      if (typeof content.caption === "string" && fontNum > 0)
        content.caption = applyFont(content.caption, fontNum);
      // Apply language translation to text (async — uses GPT API if key is set)
      // Apply character/emoji prefix to text and caption
      if (typeof content.text === "string")
        content.text = applyPrefix(content.text, this.config);
      if (typeof content.caption === "string")
        content.caption = applyPrefix(content.caption, this.config);

      if (this.config.autoTyping)
        await this.sock.sendPresenceUpdate("composing", jid).catch(() => {});
      if (this.config.autoRecording)
        await this.sock.sendPresenceUpdate("recording", jid).catch(() => {});
      const sent = await this.sock.sendMessage(jid, content, options);
      await this.sock.sendPresenceUpdate("paused", jid).catch(() => {});
      if (this.config.autoRead && sent?.key)
        await this.sock.readMessages([sent.key]).catch(() => {});
      return sent;
    } catch (err) {
      console.error("sendMessage error:", err.message);
    }
  }

  getCommands() {
    return this.commands;
  }
}

const bot = new CODEXAI();
bot.start().catch((err) => {
  console.error(chalk.red("Fatal startup error:"), err);
  process.exit(1);
});

module.exports = bot;
