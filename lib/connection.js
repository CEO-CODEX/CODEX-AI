// Loaded via the CJS↔ESM bridge (index.js calls __load() before this runs).
// makeWASocket may be a default OR named export depending on Baileys version;
// the shim normalizes it so `makeWASocket` is always present.
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  proto,
  getContentType,
} = require("./baileys");
const pino = require("pino");
const chalk = require("chalk");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const readline = require("readline");
const { getVar } = require("./utils");

const SESSION_API_BASE = "https://codex-session.pxxl.run/session";

// Auto VV: intercepts view-once BEFORE smsg strips the wrapper
const { handleAutoVV, attachVVReactionListener } = require("./autoVVHandler");

const MSG_CACHE_MAX = 2000;

function readMsgCache() {
  try {
    return JSON.parse(fs.readFileSync("./database/msgcache.json", "utf8"));
  } catch {
    return {};
  }
}
function writeMsgCache(cache) {
  const keys = Object.keys(cache);
  const data =
    keys.length > MSG_CACHE_MAX
      ? Object.fromEntries(keys.slice(-MSG_CACHE_MAX).map((k) => [k, cache[k]]))
      : cache;
  fs.writeFileSync("./database/msgcache.json", JSON.stringify(data));
}

async function askPhoneNumber() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    console.log(
      chalk.cyan("\n📱 Enter your WhatsApp number to get a pairing code:"),
    );
    console.log(
      chalk.gray(
        "   Format: 2348012345678  (country code + number, no + or spaces)\n",
      ),
    );
    rl.question(chalk.yellow("Phone Number: "), (answer) => {
      rl.close();
      resolve(answer.replace(/[^0-9]/g, ""));
    });
  });
}

async function askLoginMethod() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    console.log(
      chalk.cyan("\n🔐 No saved session found. How do you want to log in?"),
    );
    console.log(
      chalk.gray("   1. Session ID   (restore a previously saved session)"),
    );
    console.log(chalk.gray("   2. Phone Number (pair a new device)\n"));
    rl.question(chalk.yellow("Choose [1/2]: "), (answer) => {
      rl.close();
      const val = String(answer || "")
        .trim()
        .toLowerCase();
      resolve(val === "1" || val.startsWith("s") ? "session" : "phone");
    });
  });
}

async function askSessionId() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    console.log(chalk.cyan("\n🆔 Enter your session ID:"));
    rl.question(chalk.yellow("Session ID: "), (answer) => {
      rl.close();
      resolve(String(answer || "").trim());
    });
  });
}

// ── Restore a session from the remote session store ────────────────────────
// Fetches https://codex.crysnovax.link/session/:id, which returns:
//   { id, data: { files: { "creds_json": { originalName, content }, ... } }, storage: {...} }
// Each entry in `data.files` is written to ./session/<originalName> so
// useMultiFileAuthState() picks it up as a normal Baileys auth file.
async function fetchAndSaveSession(sessionId) {
  const id = String(sessionId || "").trim();
  if (!id) return false;

  try {
    console.log(chalk.cyan(`\n☁️  Downloading session '${id}' from server...`));
    const { data: body } = await axios.get(`${SESSION_API_BASE}/${id}`, {
      timeout: 15000,
    });

    // Support both our /sessions/:id shape and /whatsapp/fetch-example/:id shape.
    const files = body?.data?.files || body?.data?.data?.files || {};
    const entries = Object.values(files);

    if (!entries.length) {
      console.log(chalk.red(`❌ No session files found for ID '${id}'.`));
      return false;
    }

    fs.ensureDirSync("./session");
    let written = 0;
    for (const file of entries) {
      if (!file?.originalName || file.content === undefined) continue;
      const filePath = path.join("./session", file.originalName);
      fs.writeFileSync(filePath, JSON.stringify(file.content, null, 2));
      written++;
    }

    if (!written) {
      console.log(chalk.red(`❌ Session '${id}' returned no usable files.`));
      return false;
    }

    console.log(
      chalk.green(`✅ Restored ${written} session file(s) from ID '${id}'.`),
    );
    return true;
  } catch (err) {
    const serverMessage =
      err.response?.data?.error || err.response?.data?.message;
    console.log(
      chalk.red(
        `❌ Failed to fetch session '${id}': ${serverMessage || err.message}`,
      ),
    );
    return false;
  }
}

// Persist a manually-entered session ID into config.json so future startups
// auto-restore it via fetchAndSaveSession() without asking in the terminal again.
function persistSessionId(bot, sessionId) {
  try {
    bot.config.sessionId = sessionId;
    fs.writeFileSync("./config.json", JSON.stringify(bot.config, null, 2));
    console.log(
      chalk.green(
        "\n💾 Session ID saved to config.json — you won't be asked again.\n",
      ),
    );
  } catch (err) {
    console.log(
      chalk.yellow(
        `\n⚠️  Could not save session ID to config.json: ${err.message}\n`,
      ),
    );
  }
}

async function startConnection(bot) {
  // Clean up any existing event listeners to prevent duplicates on reconnect
  if (bot.sock) {
    try {
      bot.sock.ev.removeAllListeners();
    } catch {}
    try {
      bot.sock.end();
    } catch {}
  }
  if (bot._heartbeatInterval) {
    clearInterval(bot._heartbeatInterval);
    bot._heartbeatInterval = null;
  }

  let { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();
  let hasSession = !!state.creds?.me?.id;

  let phoneNumber = "";

  if (!hasSession) {
    // ── 1. Session ID configured in config.json — fetch it automatically ────
    const configSessionId = String(bot.config.sessionId || "").trim();
    if (configSessionId) {
      const ok = await fetchAndSaveSession(configSessionId);
      if (ok) {
        ({ state, saveCreds } = await useMultiFileAuthState("./session"));
        hasSession = !!state.creds?.me?.id;
      }
      if (!hasSession) {
        console.log(
          chalk.red(
            "\n❌ Failed to restore session from the sessionId in config.json.\n",
          ),
        );
      }
    }

    // ── 2. Nothing configured / configured session failed — ask in terminal ──
    if (!hasSession) {
      const method = await askLoginMethod();

      if (method === "session") {
        const id = await askSessionId();
        const ok = id && (await fetchAndSaveSession(id));
        if (ok) {
          ({ state, saveCreds } = await useMultiFileAuthState("./session"));
          hasSession = !!state.creds?.me?.id;
          if (hasSession) persistSessionId(bot, id);
        }
        if (!hasSession) {
          console.log(
            chalk.yellow(
              "\n⚠️  Could not restore that session. Falling back to phone number pairing.\n",
            ),
          );
          phoneNumber = await askPhoneNumber();
          if (phoneNumber.length < 7) {
            console.log(
              chalk.red("\n❌ Invalid phone number. Please restart.\n"),
            );
            process.exit(1);
          }
        }
      } else {
        phoneNumber = await askPhoneNumber();
        if (phoneNumber.length < 7) {
          console.log(
            chalk.red("\n❌ Invalid phone number. Please restart.\n"),
          );
          process.exit(1);
        }
      }
    }
  }

  // ── Random browser fingerprint (CRYSNOVA anti-ban pattern) ────────────────
  const _BROWSERS = [
    ["macOS", "Safari",  "14.0.0"],
    ["macOS", "Chrome",  "95.0.4638"],
    ["Ubuntu", "Firefox", "95.0"],
    ["Ubuntu", "Chrome",  "95.0.4638"],
  ];
  const _browser = _BROWSERS[Math.floor(Math.random() * _BROWSERS.length)];

  bot.sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: state,
    browser: _browser,
    generateHighQualityLinkPreview: false,   // off — avoids unnecessary server calls
    syncFullHistory: false,                  // CRITICAL: never sync full history
    markOnlineOnConnect: bot.config.alwaysOnline || false,
    getMessage: async () => proto.Message.fromObject({}),
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: undefined,        // no timeout — CRYSNOVA pattern
    keepAliveIntervalMs: 10000,              // 10s keep-alive — more responsive
    retryRequestDelayMs: 2000,              // conservative retry delay
    maxMsgRetryCount: 5,
    fireInitQueries: true,
    shouldSyncHistoryMessage: () => false,
    patchMessageBeforeSending: (msg) => msg,
  });

  // ── Secure Meta Service Label & AI Badge (crysnovax/baileys) ─────────────
  // Wrapped at the socket level once, so EVERY outgoing message gets both
  // flags — whether sent via bot.sendMessage(...) or directly via
  // bot.sock.sendMessage(...). Both are toggleable via dedicated commands.
  //
  // - SECURE_META_SERVICE: Flag "This account uses a secured service from Meta
  //   to manage this chat". Defaults ON. Toggle with .metasecure on|off.
  // - AI_BADGE: Shows 🤖 in DMs only. Defaults ON. Toggle with .aibadge on|off.
  const _origSendMessage = bot.sock.sendMessage.bind(bot.sock);
  bot.sock.sendMessage = async (jid, content, options = {}) => {
    try {
      if (content && typeof content === 'object') {
        // Secure Meta Service Label — ON by default, applies to ALL messages
        const secureEnabled = getVar(bot, "SECURE_META_SERVICE", true);
        if (secureEnabled) {
          content.secureMetaServiceLabel = true;
        }

        // AI badge — DMs only (crysnovax/baileys), ON by default
        const aiEnabled = getVar(bot, "AI_BADGE", true);
        const jidStr = typeof jid === "string" ? jid : Array.isArray(jid) ? jid[0] : "";
        const isPrivateChat =
          !!jidStr &&
          (jidStr.endsWith("@s.whatsapp.net") || jidStr.endsWith("@lid")) &&
          !jidStr.includes("@g.us");
        if (aiEnabled && isPrivateChat && content.ai === undefined) {
          content.ai = true;
        }
      }
    } catch {}
    return _origSendMessage(jid, content, options);
  };

  if (!hasSession && phoneNumber) {
    setTimeout(async () => {
      try {
        const code = await bot.sock.requestPairingCode(phoneNumber);
        console.log(chalk.green("\n╔════════════════════════════════════╗"));
        console.log(chalk.green("║      🔐 YOUR PAIRING CODE           ║"));
        console.log(chalk.green("╚════════════════════════════════════╝"));
        console.log(
          chalk.white(
            `\n   Code ➜  ${chalk.bold.bgGreen.black(`  ${code}  `)}\n`,
          ),
        );
        console.log(chalk.yellow("   Steps:"));
        console.log(
          chalk.white("   1. Open WhatsApp → Settings → Linked Devices"),
        );
        console.log(chalk.white('   2. Tap "Link a Device"'));
        console.log(chalk.white('   3. Tap "Link with phone number instead"'));
        console.log(chalk.white(`   4. Enter: ${chalk.bold(code)}`));
        console.log(chalk.gray("\n   ⏳ Waiting...\n"));
      } catch (err) {
        console.log(chalk.red("\n❌ Pairing code failed:", err.message));
        setTimeout(() => startConnection(bot).catch(console.error), 5000);
      }
    }, 3000);
  }

  bot.sock.ev.on("creds.update", saveCreds);

  // ── Connection state ──────────────────────────────────────────────────────
  bot.sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, receivedPendingNotifications } = update;

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = code === DisconnectReason.loggedOut;
      const reason =
        lastDisconnect?.error?.output?.payload?.message ||
        lastDisconnect?.error?.message ||
        "Unknown";
      console.log(chalk.red(`\n⚠️  Disconnected: ${reason} (code: ${code})`));
      if (isLoggedOut) {
        console.log(
          chalk.red("🚪 Logged out. Delete /session folder and restart.\n"),
        );
        process.exit(0);
      }
      console.log(chalk.yellow("🔄 Reconnecting in 5s...\n"));
      setTimeout(() => startConnection(bot).catch(console.error), 5000);
    } else if (connection === "open") {
      const B = chalk.bold.blue;
      const W = chalk.bold.white;
      const now = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: true, timeZone: "Africa/Lagos"
      });
      console.log('');
      console.log(B('  ╔══════════════════════════════════════════════╗'));
      console.log(B('  ║') + W('           ✅  CODEX AI  CONNECTED            ') + B('║'));
      console.log(B('  ╠══════════════════════════════════════════════╣'));
      console.log(B('  ║') + chalk.cyan(`  🤖  Bot     : ${chalk.bold(bot.config.botName || 'CODEX AI')}`.padEnd(47)) + B('║'));
      console.log(B('  ║') + chalk.cyan(`  🔑  Prefix  : ${chalk.bold(bot.prefix)}`.padEnd(47)) + B('║'));
      console.log(B('  ║') + chalk.cyan(`  🌐  Mode    : ${chalk.bold((bot.config.mode || 'private').toUpperCase())}`.padEnd(47)) + B('║'));
      console.log(B('  ║') + chalk.cyan(`  📦  CMDs    : ${chalk.bold(bot.successCmds)} loaded`.padEnd(47)) + B('║'));
      console.log(B('  ║') + chalk.cyan(`  🕐  Time    : ${chalk.bold(now)}`.padEnd(47)) + B('║'));
      console.log(B('  ╚══════════════════════════════════════════════╝'));
      console.log('');

      // Attach VV reaction listener ONCE after connection
      attachVVReactionListener(bot.sock);

      // ── Persisted job scheduler (lock/unlock/mute/unmute timers) ──────
      try { require("./scheduler").init(bot); } catch (e) { console.error("[scheduler init]", e.message); }

      // ── Mute-core node-cron scheduler ──────────────────────────────────
      try { require("./mute-core").init(bot); } catch (e) { console.error("[mute-core init]", e.message); }

      // ── Auto-follow channels — fires once per process lifetime ────────────
      // When someone pairs/deploys this bot, the connected account will
      // automatically follow BOTH CODEX channels. count:'once' means no
      // duplicate follows.
      //
      // NOTE: automated follows right after pairing can look like bot/spam
      // behaviour to WhatsApp, so we (1) wait a bit after connecting and
      // (2) space the two follows apart to look more natural.
      if (!bot._channelFollowSent) {
        bot._channelFollowSent = true;
        const AUTO_FOLLOW_CHANNELS = [
          '120363424151910491@newsletter',
          '120363425299923811@newsletter',
        ];
        setTimeout(async () => {
          try {
            const ownerNum = (typeof bot.config.owner === 'object'
              ? bot.config.owner?.number : bot.config.owner) || '';
            const ownerJid = ownerNum.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            for (const channelId of AUTO_FOLLOW_CHANNELS) {
              await bot.sock.sendMessage(ownerJid, {
                followMe:  true,
                channelId,
                count:     'once',
              }).catch(() => {});
              // small gap between the two follows
              await new Promise((r) => setTimeout(r, 2500));
            }
          } catch {}
        }, 8000);
      }

      // ── Startup message — ONE TIME ONLY per process lifetime ───────────
      // Fires on the first successful connection. A reconnect (e.g. after a
      // brief network drop) re-enters this block but does NOT re-send the
      // startup message. This was previously causing the message to be sent
      // multiple times, which looked like spam.
      if (!bot._startupSent) {
        bot._startupSent = true;
        setTimeout(
          () => bot.sendStartupMessage().catch((e) => console.error("Startup msg:", e.message)),
          3000,
        );
      }
    }
  });

  // ── Messages ──────────────────────────────────────────────────────────────
  bot.sock.ev.on("messages.upsert", async ({ type, messages }) => {
    // 'notify' = incoming messages from others
    // 'append' = messages sent by the bot/owner themselves (including group commands)
    // We need BOTH so the owner can run commands from groups
    if (type !== "notify" && type !== "append") return;
    for (const msg of messages) {
      try {
        if (!msg.message) continue;

        // ── Status: auto-view, auto-react (CRYSNOVA style), auto-save, anti-group-mention ──
        if (msg.key.remoteJid === "status@broadcast") {
          const svCfg = bot.config.statusView || {};
          const srCfg = bot.config.statusReact || {};

          const posterJid = msg.key.participant || msg.key.remoteJid;
          const posterNum = posterJid.split("@")[0];

          // Cache the status so a later deletion can be restored by anti-delete
          if (!msg.key.fromMe) {
            try { bot._cacheMessage(msg); } catch {}
          }

          // ── Auto View — check both config and autostatus.json DB ──
          let _statusDb = {};
          try {
            _statusDb = JSON.parse(
              require("fs").readFileSync("./database/autostatus.json", "utf8"),
            );
          } catch {}
          const _viewEnabled =
            svCfg.enabled !== false ||
            _statusDb.autoView ||
            _statusDb.autoview ||
            _statusDb.statusView?.enabled;
          const _reactEnabled =
            srCfg.enabled ||
            _statusDb.autoReact ||
            _statusDb.autoreact ||
            _statusDb.statusReact?.enabled;
          // STATUS_EMOJI from variables.json overrides emoji
          let _statusEmoji = srCfg.emoji || _statusDb.reactEmoji || null;
          try {
            const _vars = JSON.parse(
              require("fs").readFileSync("./database/variables.json", "utf8"),
            );
            if (_vars.STATUS_EMOJI) _statusEmoji = _vars.STATUS_EMOJI;
          } catch {}

          if (_viewEnabled) {
            const readKey = {
              remoteJid: "status@broadcast",
              id: msg.key.id,
              participant: posterJid,
              fromMe: false,
            };
            await bot.sock.readMessages([readKey]).catch(() => {});
            try {
              if (bot.sock.sendReceipt)
                await bot.sock.sendReceipt(
                  "status@broadcast",
                  posterJid,
                  [msg.key.id],
                  "read",
                );
            } catch {}
            try {
              if (bot.sock.sendReadReceipt)
                await bot.sock.sendReadReceipt("status@broadcast", posterJid, [
                  msg.key.id,
                ]);
            } catch {}
            console.log(`[STATUS] Viewed: ${posterNum}`);
          }

          // ── Auto React to Status (CRYSNOVA: random emoji pool) ────
          if (_reactEnabled) {
            // Random emoji pool — same as CRYSNOVA statusHandler
            const STATUS_EMOJIS = [
              "❤️‍🔥",
              "🔥",
              "💯",
              "😍",
              "👏",
              "✨",
              "😂",
              "🥰",
              "👀",
              "🎉",
              "💪",
              "⚡",
              "📑",
              "🙀",
              "😢",
              "❌",
              "😩",
              "👾",
              "🙏",
              "🤗",
              "🥏",
            ];
            // Emoji selection:
            //   • a specific emoji set by the user (setstatusemoji) → use it
            //   • the literal "random" → pick from the pool below
            //   • nothing set → default to the WhatsApp green heart 💚
            let emoji;
            if (_statusEmoji && _statusEmoji !== "random") {
              emoji = _statusEmoji;
            } else if (_statusEmoji === "random") {
              emoji =
                STATUS_EMOJIS[Math.floor(Math.random() * STATUS_EMOJIS.length)];
            } else {
              emoji = "💚";
            }

            await new Promise((r) => setTimeout(r, 600 + Math.random() * 1200));
            await bot.sock
              .sendMessage(posterJid, {
                react: { text: emoji, key: msg.key },
              })
              .catch(() => {});
            console.log(`[STATUS] Reacted ${emoji} to: ${posterNum}`);
          }

          // ── Auto Save Status (CRYSNOVA ASS feature) ──────────────
          try {
            const assConfig = (() => {
              const fs = require("fs-extra");
              try {
                return JSON.parse(
                  fs.readFileSync("./database/autosavestatus.json", "utf8"),
                );
              } catch {}
              return { enabled: false, mode: "dm", target: null };
            })();

            if (assConfig.enabled && msg.message) {
              const { downloadContentFromMessage } = require("./baileys");
              const type = Object.keys(msg.message).find((k) =>
                ["imageMessage", "videoMessage", "audioMessage"].includes(k),
              );
              if (type) {
                let targetJid = bot.config.owner.number;
                if (assConfig.mode === "number" || assConfig.mode === "chat") {
                  targetJid = assConfig.target || targetJid;
                }
                const mediaMsg = msg.message[type];
                const cat = type.replace("Message", "");
                const stream = await downloadContentFromMessage(mediaMsg, cat);
                let buffer = Buffer.alloc(0);
                for await (const chunk of stream)
                  buffer = Buffer.concat([buffer, chunk]);
                const caption = mediaMsg?.caption || "";
                const sendType =
                  type === "videoMessage"
                    ? "video"
                    : type === "imageMessage"
                      ? "image"
                      : "audio";
                await bot.sock
                  .sendMessage(targetJid, {
                    [sendType]: buffer,
                    ...(caption ? { caption } : {}),
                    ...(sendType === "audio"
                      ? { mimetype: "audio/mpeg", ptt: false }
                      : {}),
                  })
                  .catch(() => {});
                console.log(
                  `[ASS] Saved status from ${posterNum} → ${targetJid.split("@")[0]}`,
                );
              }
            }
          } catch {}

          // ── Anti-Group Mention ────────────────────────────────────
          try {
            const type = getContentType(msg.message);
            let inner = msg.message[type];
            if (
              type === "viewOnceMessage" ||
              type === "viewOnceMessageV2" ||
              type === "viewOnceMessageV2Extension"
            ) {
              const innerType = getContentType(inner?.message || {});
              inner = inner?.message?.[innerType];
            }
            const mentioned = inner?.contextInfo?.mentionedJid || [];
            for (const jid of mentioned) {
              if (jid.endsWith("@g.us")) {
                await bot.antiSystems
                  .checkStatusGroupMention(posterJid, jid)
                  .catch(() => {});
              }
            }
          } catch {}
          continue;
        }

        // Cache all non-own messages
        if (!msg.key.fromMe) bot._cacheMessage(msg);

        // ── Anti-Delete: protocolMessage type 0 (revoke) ─────────────
        if (msg.message?.protocolMessage?.type === 0) {
          await bot
            ._handleAntiDelete(
              msg.message.protocolMessage.key,
              msg.key.remoteJid,
            )
            .catch(() => {});
          continue;
        }

        // ── Anti-Edit: protocolMessage type 14 ───────────────────────
        if (msg.message?.protocolMessage?.type === 14) {
          await bot
            ._handleAntiEdit(
              msg.message.protocolMessage.key,
              msg.message.protocolMessage.editedMessage,
              msg.key.remoteJid,
            )
            .catch(() => {});
          continue;
        }

        // ── fromMe handling ──────────────────────────────────────────────
        // This is a self-bot: the owner IS the bot number.
        // Messages from the owner's phone come in as fromMe=true.
        // We must process them — that's how DM commands work.
        // Only block fromMe messages that have no text (delivery receipts etc).
        if (msg.key.fromMe) {
          const type = getContentType(msg.message || {});
          const inner = msg.message?.[type];
          const txt =
            typeof inner === "string"
              ? inner
              : inner?.text || inner?.caption || inner?.conversation || "";
          // Skip receipts, reactions, protocol messages — no text = not a command
          if (!txt && type !== "stickerMessage") continue;
        }

        // Auto VV — must run BEFORE messageHandler.handle() because
        // smsg() inside handle() unwraps the viewOnce wrapper.
        // handleAutoVV inspects the raw Baileys message directly.
        await handleAutoVV(bot.sock, msg).catch(() => {});

        await bot.messageHandler.handle(msg).catch(console.error);
      } catch (err) {
        console.error("Message loop error:", err.message);
      }
    }
  });

  // ── Message updates (fallback for delete/edit detection) ─────────────────
  // ── messages.delete — Anti-Delete ───────────────────────────────────────
  bot.sock.ev.on("messages.delete", async (item) => {
    try {
      const keys = item.keys || (item.key ? [item.key] : []);
      for (const key of keys) {
        // status@broadcast is allowed through — _handleAntiDelete decides
        // whether deleted statuses should be restored (based on config).
        await bot
          ._handleAntiDelete(key, key.remoteJid)
          .catch((e) => console.log("[AD]", e.message));
      }
    } catch (e) {
      console.log("[messages.delete]", e.message);
    }
  });

  bot.sock.ev.on("messages.update", async (updates) => {
    for (const { key, update: upd } of updates) {
      try {
        if (key.remoteJid === "status@broadcast") {
          let _statusDb = {};
          try {
            _statusDb = JSON.parse(
              require("fs").readFileSync("./database/autostatus.json", "utf8"),
            );
          } catch {}
          const svCfg = bot.config.statusView || {};
          const _viewEnabled =
            svCfg.enabled !== false || _statusDb.autoView || _statusDb.autoview;
          if (_viewEnabled) {
            const readKey = {
              remoteJid: "status@broadcast",
              id: key.id,
              participant: key.participant || key.remoteJid,
            };
            await bot.sock.readMessages([readKey]).catch(() => {});
          }
          continue;
        }
        // ── Anti-Edit: message.update with editedMessage inside ──────
        const isEdit =
          upd?.message?.protocolMessage?.type === 14 ||
          upd?.message?.editedMessage ||
          upd?.message?.protocolMessage?.editedMessage;
        if (isEdit) {
          await bot
            ._handleAntiEdit(key, upd, key.remoteJid)
            .catch((e) => console.log("[AE]", e.message));
          continue;
        }
        // ── Anti-Delete via message.update (revoke protocol) ─────────
        const isRevoke =
          upd?.message?.protocolMessage?.type === 0 ||
          upd?.message?.protocolMessage?.type === 5;
        if (isRevoke) {
          const revokedKey = upd.message.protocolMessage.key || key;
          await bot
            ._handleAntiDelete(revokedKey, key.remoteJid)
            .catch((e) => console.log("[AD2]", e.message));
        }
      } catch (e) {
        console.log("[messages.update]", e.message);
      }
    }
  });

  // ── Group updates ─────────────────────────────────────────────────────────
  bot.sock.ev.on("group-participants.update", async (update) => {
    console.log(
      chalk.gray(
        `[group-participants.update] action=${update?.action} participants=${(update?.participants || []).length} group=${update?.id}`,
      ),
    );
    await bot.handleGroupUpdate(update).catch(console.error);
  });

  // ── Calls: use LID-safe call.from ─────────────────────────────────────────
  bot.sock.ev.on("call", async (calls) => {
    const cfg = bot.config.antiCall;
    if (!cfg || cfg === false) return;
    const mode = typeof cfg === "object" ? cfg.mode || "default" : "default";

    for (const call of calls) {
      if (call.status !== "offer") continue;

      const callerJid = call.from;
      const callerNum = callerJid.split("@")[0];
      const time = new Date().toLocaleTimeString("en-NG", {
        timeZone: "Africa/Lagos",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      // Reject call
      await bot.sock.rejectCall(call.id, callerJid).catch(() => {});

      if (mode === "block") {
        // Try all known Baileys block methods for compatibility
        try {
          await bot.sock.updateBlockStatus(callerJid, "block");
        } catch (_) {}
        try {
          await bot.sock.blockContact(callerJid);
        } catch (_) {}
        try {
          await bot.sock.sendMessage(callerJid, {
            text: `Calls are not allowed. You have been blocked.\nTime: ${time} (NG)`,
          });
        } catch (_) {}
      } else {
        await bot
          .sendMessage(callerJid, {
            text: `Calls are not accepted. Please send a message instead.\nTime: ${time} (NG)`,
          })
          .catch(() => {});
      }

      // Forward to owner DM
      await bot
        .sendMessage(bot.config.owner.number, {
          text: `ANTI-CALL\n\nCaller: @${callerNum}\nTime: ${time} (NG)\nAction: ${mode === "block" ? "Rejected & Blocked" : "Rejected"}`,
          mentions: [callerJid],
        })
        .catch(() => {});
    }
  });
}

module.exports = { startConnection, readMsgCache, writeMsgCache };
