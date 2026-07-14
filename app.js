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
  "./database/groupEvents.json",
  "./database/muteSchedules.json",
  "./database/recurringSchedules.json",
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
    console.log(chalk.green('\n  ✦ CODEX AI V3.0 — Starting up...'));
    console.log(chalk.green('  ✦ Loading commands...\n'));
    const { loaded, failed } = await this.reloader.loadCommands();
    console.log(chalk.green(`  ✦ Commands loaded: ${loaded}`));
    if (failed > 0) console.log(chalk.red(`  ✦ Failed: ${failed} commands`));
    console.log('');
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

      const isStatus = chat === "status@broadcast";
      const isGroup = !isStatus && chat.endsWith("@g.us");
      const isPrivate = !isGroup && !isStatus;

      let db = {};
      try {
        db = JSON.parse(fs.readFileSync("./database/antidelete.json", "utf8"));
      } catch {}

      // Deleted statuses are restored to the owner DM when antidelete status
      // is enabled (.antidelete status on) OR when global anti-delete is on.
      if (isStatus) {
        const statusEnabled = !!db._status || !!db._globalPriv;
        if (!statusEnabled) return;
      } else {
        const enabledForChat = !!db[chat];
        const enabledGlobally = isPrivate && !!db._globalPriv;
        if (!enabledForChat && !enabledGlobally) return;
      }

      // Statuses always go to the owner DM (there is no "chat" to send back to)
      const mode = isStatus ? "dm" : db._mode || "dm";
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

      let formatted = isStatus ? `*ⓘ DELETED STATUS!*
` : `*ⓘ DELETED!*
`;

      if (isStatus) {
        formatted += `_❏◦Status by_ •⌲ @${senderNum} (${pushName})
`;
      } else if (isGroup) {
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

      // Get new edited text — handle every shape the edited payload arrives in:
      //   • upsert path passes protocolMessage.editedMessage directly
      //   • messages.update passes the whole update ({ message: {...} })
      //   • edits can be plain text OR an edited media caption
      let newText = "";
      try {
        const inner =
          editedMsg?.editedMessage ||
          editedMsg?.message?.editedMessage ||
          editedMsg?.protocolMessage?.editedMessage ||
          editedMsg?.message ||
          editedMsg ||
          {};
        newText =
          inner.conversation ||
          inner.extendedTextMessage?.text ||
          inner.imageMessage?.caption ||
          inner.videoMessage?.caption ||
          inner.documentMessage?.caption ||
          "";
        if (!newText) {
          // Last-resort deep scan of the serialized payload
          const str = JSON.stringify(editedMsg || {});
          const match = str.match(/"(?:conversation|text|caption)":"(.*?)"/);
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

    // JID used ONLY for the "View channel" badge on the startup message.
    // (The visible CHANNEL_LINK / GROUP_LINK below are intentionally left as-is.)
    const CHANNEL_JID = "120363424311426745@newsletter";
    const CHANNEL_LINK =
      "https://whatsapp.com/channel/0029Vb6sMEy96H4VI2w3I50F";
    const GROUP_LINK =
      "https://chat.whatsapp.com/Gmhs6wJq7R63vEcitVBrj6?s=cl&p=a&ilr=0&amv=0";
    const CODEX_IMG =
      "https://cdn.crysnovax.link/files/1782641945104-66399a32-3e86-4e1f-9a13-32c3b4031dd4.jpeg";
    const botName = c.settings?.title || c.botName || "CODEX AI";
    const prefix = c.prefix || ".";
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

    try {
      const axios = require("axios");

      // Download the startup image
      let imgBuf = null;
      try {
        const resp = await axios.get(CODEX_IMG, {
          responseType: "arraybuffer",
          timeout: 15000,
        });
        imgBuf = Buffer.from(resp.data);
      } catch (e1) {
        console.log("[Startup] image fetch failed:", e1.message);
      }

      // Send as a forwarded image message with the startup text as caption
      if (imgBuf) {
        await this.sock
          .sendMessage(ownerJid, {
            image: imgBuf,
            caption: startupText,
            // contextInfo nested here is what actually renders the "View channel" badge
            contextInfo: {
              forwardingScore: 999,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid:   CHANNEL_JID,
                newsletterName:  '𝗖𝗢𝗗𝗘𝗫 𝗩𝗘𝗥𝗜𝗙𝗜𝗘𝗗',
                serverMessageId: 143,
              },
            },
          })
          .catch(() => {});
      } else {
        await this.sock
          .sendMessage(ownerJid, {
            text: startupText,
            contextInfo: {
              forwardingScore: 999,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid:   CHANNEL_JID,
                newsletterName:  '𝗖𝗢𝗗𝗘𝗫 𝗩𝗘𝗥𝗜𝗙𝗜𝗘𝗗',
                serverMessageId: 143,
              },
            },
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
    // Read from groupEvents.json (CRYSNOVA pattern: one file, all group event config)
    let eventsDb = {};
    try { eventsDb = JSON.parse(fs.readFileSync('./database/groupEvents.json', 'utf8')); } catch {}
    const cfg = eventsDb[id] || {};

    if (action === 'add') {
      const enabled = cfg.welcomeEnabled ?? (this.config.welcome !== false);
      if (!enabled) return;

      let meta = null;
      try { meta = await this.sock.groupMetadata(id); } catch {}

      const FALLBACK_IMG = 'https://cdn.crysnovax.link/files/1783714628716-ef111032-d7c1-47b0-b9f1-35f87994171b.jpeg';

      for (const rawUser of participants) {
        const user = typeof rawUser === 'string' ? rawUser : (rawUser?.id || rawUser?.jid || '');
        if (!user) continue;

        const botNum  = (this.sock.user?.id || '').replace(/:[0-9]+@/, '@').split('@')[0].replace(/[^0-9]/g, '');
        const userNum = user.replace(/:[0-9]+@/, '@').split('@')[0].replace(/[^0-9]/g, '');
        if (botNum && userNum === botNum) continue;

        try {
          const groupName   = meta?.subject || 'the group';
          const memberCount = meta?.participants?.length ?? '?';

          const defaultMsg =
`╔════〔 𝗖𝗢𝗗𝗘𝗫 𝗔𝗜 〕════❒
║╭────────────────────◆
║│ ❒ *WELCOME:* ${groupName}
║│ ❒ *USER:* @${user.split('@')[0]}
║│ ❒ *TOTAL MEMBERS:* ${memberCount}
║│
║│ ☙ *_WELCOME TO THE GROUP_!*
║╰────────────────────◆   

 𝓬𝓸𝓭𝓮𝔁 𝓿𝓮𝓻𝓲𝓯𝓲𝓮𝓭  ✅    
 ═══════════════════❒`;

          const msg = cfg.welcome
            ? cfg.welcome
                .replace(/@user/gi,  `@${user.split('@')[0]}`)
                .replace(/\{user\}/gi,  `@${user.split('@')[0]}`)
                .replace(/\{group\}/gi, groupName)
                .replace(/\{count\}/gi, String(memberCount))
            : defaultMsg;

          let ppUrl = null;
          try { ppUrl = await this.sock.profilePictureUrl(user, 'image'); } catch {}
          const imgSrc = ppUrl || FALLBACK_IMG;
          await this.sendMessage(id, { image: { url: imgSrc }, caption: msg, mentions: [user] });
        } catch (e) { console.error('[Welcome]', e.message); }
      }

    } else if (action === 'remove') {
      // Goodbye uses goodbyeEnabled ONLY — never touches welcomeEnabled
      const enabled = cfg.goodbyeEnabled ?? (this.config.goodbye !== false);
      if (!enabled) return;

      let meta = null;
      try { meta = await this.sock.groupMetadata(id); } catch {}

      const FALLBACK_IMG = 'https://cdn.crysnovax.link/files/1783714628716-ef111032-d7c1-47b0-b9f1-35f87994171b.jpeg';

      for (const rawUser of participants) {
        const user = typeof rawUser === 'string' ? rawUser : (rawUser?.id || rawUser?.jid || '');
        if (!user) continue;

        try {
          const groupName   = meta?.subject || 'the group';
          const memberCount = meta?.participants?.length ?? '?';

          const defaultMsg =
`╔════〔 𝗖𝗢𝗗𝗘𝗫 𝗔𝗜 〕════❒
║╭────────────────────◆
║│ ❒ *GROUP:* ${groupName}
║│ ❒ *USER:* @${user.split('@')[0]}
║│ ❒ *TOTAL MEMBERS:* ${memberCount}
║│
║│ ☙ *_GOODBYE! WE'LL MISS YOU_!*
║╰────────────────────◆   

 𝓬𝓸𝓭𝓮𝔁 𝓿𝓮𝓻𝓲𝓯𝓲𝓮𝓭  ✅    
 ═══════════════════❒`;

          const msg = cfg.goodbye
            ? cfg.goodbye
                .replace(/@user/gi,  `@${user.split('@')[0]}`)
                .replace(/\{user\}/gi,  `@${user.split('@')[0]}`)
                .replace(/\{group\}/gi, groupName)
                .replace(/\{count\}/gi, String(memberCount))
            : defaultMsg;

          let ppUrl = null;
          try { ppUrl = await this.sock.profilePictureUrl(user, 'image'); } catch {}
          const imgSrc = ppUrl || FALLBACK_IMG;
          await this.sendMessage(id, { image: { url: imgSrc }, caption: msg, mentions: [user] });
        } catch (e) { console.error('[Goodbye]', e.message); }
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
