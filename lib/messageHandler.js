const { getContentType } = require("./baileys");
const fs = require("fs-extra");
// Lists re-exported so botcharacter.js / botemoji.js / setvar.js can import them from here
const { BOT_CHARACTERS, BOT_EMOJIS } = require("./characterEngine");

class MessageHandler {
  constructor(bot) {
    this.bot = bot;
  }

  // Build a 3rd argument that satisfies BOTH command signatures:
  //   execute(bot, m, args)                         → args used as a plain array
  //   execute(sock, m, { args, reply, prefix })     → destructured object
  // Returns a real Array (indexing/length intact) carrying extra properties.
  _argv(m, args) {
    const argv = Array.isArray(args) ? args.slice() : [];
    argv.args = argv;
    argv.reply = (t, o = {}) => m.reply(t, o);
    argv.prefix = this.bot.prefix;
    argv.sock = this.bot.sock;
    argv.bot = this.bot;
    return argv;
  }

  // Centralised command runner so every entry point behaves identically.
  async _run(command, m, args, cmdName) {
    return command.execute(this.bot, m, this._argv(m, args), cmdName);
  }

  async handle(msg) {
    try {
      const m = this.smsg(msg);
      if (!m) return;

      const jid = m.chat;
      const sender = m.sender;
      const text = m.text || "";

      console.log(
        `[Message] From: ${sender} in ${jid} | Text: ${text.substring(0, 50)}`,
      );

      if (jid === "status@broadcast") {
        await this._handleStatusMention(m);
        return;
      }

      // ── Auto Read ─────────────────────────────────────────────────────
      // Mark every incoming message as read if autoRead is enabled.
      // Runs before everything else, including mode/owner checks.
      if (this.bot.config.autoRead && !msg.key.fromMe) {
        await this.bot.sock.readMessages([msg.key]).catch(() => {});
      }

      // ── Owner detection ───────────────────────────────────────────────
      // PRIMARY signal: fromMe=true — always means the owner sent this.
      //   Works in GC, DM, and bot DM. LID-proof.
      // FALLBACK: digit tail-match via permission.isOwner() for cases where
      //   the message comes from a known number (non-fromMe DMs, etc.)
      const isOwner = this.bot.permission.isOwner(sender);

      // ── OWNER HARD BYPASS — if fromMe, skip ALL checks and run command ─
      // Owner commands always work regardless of mode, mute, or any other check.
      // This covers: GC commands, DM commands, AND bot DM commands.
      /*           if (isOwner) {
                const text2 = m.text || '';
                // Run AFK check first — so owner sending a message disables their AFK
                await this.bot.afkSystem.checkAFK(m).catch(() => {});
                if (!text2.startsWith(this.bot.prefix)) return;
                const args2    = text2.slice(this.bot.prefix.length).trim().split(/ +/);
                const cmdName2 = args2.shift().toLowerCase();
                const command2 = this.bot.commandHandler.getCommand(cmdName2);
                if (!command2) return;
                try {
                    // Owner bypass: run regardless of ownerOnly/adminOnly/groupOnly.
                    await this._run(command2, m, args2, cmdName2);
                } catch (err) {
                    console.error('Owner cmd error:', err);
                    await m.reply(`Error: ${err.message}`).catch(() => {});
                }
                return;
            }
*/
      // ── AFK — runs for ALL messages before any mode/mute restrictions ────
      // Must be here so AFK notifications fire even in private mode
      await this.bot.afkSystem.checkAFK(m).catch(() => {});

      // ── MODE CHECK ───────────────────────────────────────────────────
      // public  → everyone can use the bot (GC, DM, bot DM)
      // private → only owner / mods / sudo can use it (GC, DM, bot DM)
      //
      // The owner is ALREADY handled by the fromMe bypass above, so this
      // gate never blocks the owner in any context.
      //
      // IMPORTANT: private mode blocks ALL command attempts everywhere —
      // GC, incoming DMs, and messages to the bot's own DM number.
      const _mode = (this.bot.config.mode || "public").toLowerCase();
      if (_mode === "private") {
        const allowed =
          isOwner ||
          this.bot.permission.isSudo(sender) ||
          this.bot.permission.isMod(sender);
        if (!allowed) {
          // Block any command attempt (prefixed message) in all contexts
          if (text.startsWith(this.bot.prefix)) {
            // React in GC to signal private mode; stay silent in DM
            if (m.isGroup) {
              await this.bot.sock
                .sendMessage(jid, { react: { text: "⚉", key: m.key } })
                .catch(() => {});
            }
            return;
          }
          // Non-command messages (autoreply triggers, etc.) fall through
        }
      }

      // ── MUTE CHECK ────────────────────────────────────────────────────
      let muteDb = {};
      try {
        muteDb = JSON.parse(
          fs.readFileSync("./database/muteusers.json", "utf8"),
        );
      } catch {}
      const muteEntry = muteDb[this.bot.permission._clean(sender)];
      if (muteEntry) {
        if (!muteEntry.stickersOnly) return;
        if (m.type === "stickerMessage") return;
      }

      // ── AUTO REPLY ────────────────────────────────────────────────────
      if (!m.key.fromMe && (!text || !text.startsWith(this.bot.prefix))) {
        await this._handleAutoReply(m, text || "");
      }

      // ── AUTO REACT ────────────────────────────────────────────────────
      const arCfg = this.bot.config.autoReact;
      if (arCfg?.enabled && !m.key.fromMe) {
        await this.bot.sock
          .sendMessage(jid, {
            react: { text: arCfg.emoji || "❤️", key: m.key },
          })
          .catch(() => {});
      }

      // ── OWNER MENTION REACT (CRYSNOVA style) ──────────────────────
      if (!m.fromMe) {
        try {
          const mentionMod = require("../commands/bot/mention.js");
          const mentionCfg = mentionMod.mentionConfig;
          if (mentionCfg?.active) {
            const ownerNum = this.bot.permission._phone(
              this.bot.config.owner.number,
            );
            const rawMsg = msg.message || {};
            const ctxInfo =
              rawMsg.extendedTextMessage?.contextInfo ||
              rawMsg.imageMessage?.contextInfo ||
              rawMsg.videoMessage?.contextInfo ||
              {};
            const allMentions = [
              ...(ctxInfo.mentionedJid || []),
              ...(m.mentions || []),
              ...(m.msg?.contextInfo?.mentionedJid || []),
            ];
            const ownerJid = ownerNum + "@s.whatsapp.net";
            // Resolve the owner's LID once. mentionedJid / contextInfo.participant
            // are now LIDs (e.g. 2235...@lid) whose digits do NOT match the owner's
            // phone, so digit tail-matching alone always misses. We map owner PN→LID
            // and also LID-match. lidMapping methods are async and may return null
            // if Baileys hasn't stored the mapping yet — _matchOwner stays as the
            // PN-form fallback. (?. guards keep this a no-op on pre-v7 Baileys.)
            const _normLid = (j) =>
              (j || "")
                .replace(/:[0-9]+@/, "@")
                .toLowerCase()
                .trim();
            let _ownerLid = "";
            try {
              _ownerLid =
                (await this.bot.sock.signalRepository?.lidMapping?.getLIDForPN(
                  ownerJid,
                )) || "";
            } catch {}
            // REPLY-ONLY: trigger only on a genuine @mention of the owner
            // OR a direct reply to one of the owner's messages — never on
            // plain text that merely contains the owner's number.
            const _matchOwner = (j) => {
              if (!j) return false;
              if (_ownerLid && _normLid(j) === _normLid(_ownerLid)) return true;
              const phone = j
                .replace(/:[0-9]+@/, "@")
                .split("@")[0]
                .replace(/[^0-9]/g, "");
              return (
                phone &&
                (phone === ownerNum ||
                  phone.endsWith(ownerNum) ||
                  ownerNum.endsWith(phone))
              );
            };
            const isMentioned = allMentions.some(_matchOwner);
            const repliedParticipant =
              ctxInfo.participant || m.contextInfo?.participant || "";
            const isReplyToOwner = _matchOwner(repliedParticipant);
            if ((isMentioned || isReplyToOwner) && sender !== ownerJid) {
              if (mentionCfg.action === "react" && mentionCfg.emoji) {
                await this.bot.sock
                  .sendMessage(jid, {
                    react: { text: mentionCfg.emoji, key: m.key },
                  })
                  .catch(() => {});
              } else if (mentionCfg.action === "text" && mentionCfg.text) {
                await this.bot.sock
                  .sendMessage(jid, { text: mentionCfg.text }, { quoted: msg })
                  .catch(() => {});
              }
            }
          }
        } catch {}
      }

      // ── AUTOREACT — random emoji pool (CRYSNOVA style) ───────────────
      try {
        const arCfg = this.bot.config.autoReact;
        if (arCfg?.enabled && !m.key.fromMe && text) {
          let emoji = arCfg.emoji || "❤️";
          try {
            const fs = require("fs-extra");
            const arDb = JSON.parse(
              fs.readFileSync("./database/autoreact.json", "utf8"),
            );
            if (arDb.enabled && arDb.emojis?.length) {
              emoji =
                arDb.emojis[Math.floor(Math.random() * arDb.emojis.length)];
            }
          } catch {}
          await this.bot.sock
            .sendMessage(jid, { react: { text: emoji, key: m.key } })
            .catch(() => {});
        }
      } catch {}

      // ── ANTI-SYSTEMS (groups only, non-privileged) ────────────────────
      if (m.isGroup) {
        const priv = isOwner || this.bot.permission.isMod(sender);
        const adm =
          priv ||
          (await this.bot.permission.isAdmin(jid, sender, m._participantRaw));
        if (!adm) {
          const blocked = await this.bot.antiSystems.checkAll(m);
          if (blocked) return;
        }
      }

      // ── STICKER CMD ───────────────────────────────────────────────────
      if (m.type === "stickerMessage" && m.msg?.fileSha256) {
        await this._handleStickerCommand(m);
        return;
      }

      // ── DND — Do Not Disturb ──────────────────────────────────────────
      try {
        if (m.isGroup && !isOwner) {
          const _dndFs = require("fs-extra");
          const _dndDb = (() => {
            try {
              return JSON.parse(
                _dndFs.readFileSync("./database/dnd.json", "utf8"),
              );
            } catch {
              return { enabled: false };
            }
          })();
          if (_dndDb.enabled) {
            const _ownerRaw = this.bot.config.owner;
            const _ownerPhone = (
              (typeof _ownerRaw === "object" ? _ownerRaw?.number : _ownerRaw) ||
              ""
            ).replace(/[^0-9]/g, "");
            const _ownerJid = _ownerPhone + "@s.whatsapp.net";
            const _toPhone = (j) =>
              (j || "")
                .split(":")[0]
                .split("@")[0]
                .replace(/[^0-9]/g, "");
            const _normLid = (j) =>
              (j || "")
                .replace(/:[0-9]+@/, "@")
                .toLowerCase()
                .trim();
            // Resolve owner PN→LID once so LID-form mentions/replies match too.
            let _ownerLid = "";
            try {
              _ownerLid =
                (await this.bot.sock.signalRepository?.lidMapping?.getLIDForPN(
                  _ownerJid,
                )) || "";
            } catch {}
            const _isOwnerJid = (j) =>
              !!j &&
              ((!!_ownerPhone && _toPhone(j) === _ownerPhone) ||
                (!!_ownerLid && _normLid(j) === _normLid(_ownerLid)));
            // Use already-parsed m.mentions + all contextInfo sources
            const _allMentions = [
              ...(m.mentions || []),
              ...(m.contextInfo?.mentionedJid || []),
              ...(m.msg?.contextInfo?.mentionedJid || []),
            ];
            const _tagsOwner = _allMentions.some(_isOwnerJid);
            // Check if replying to owner's message
            const _quotedPart =
              m.contextInfo?.participant ||
              m.msg?.contextInfo?.participant ||
              "";
            const _repliesToOwner = _isOwnerJid(_quotedPart);
            if (_tagsOwner || _repliesToOwner) {
              await this.bot.sock
                .sendMessage(jid, { delete: m.key })
                .catch(() => {});
              const _senderName = m.pushName || sender.split("@")[0];
              const _dndMsg =
                _dndDb.customMsg ||
                `*${_senderName.toUpperCase()}* THE OWNER IS CURRENTLY ON *DO NOT DISTURB* MODE. 🔕 *STOP THE TAGS.*`;
              await this.bot.sock
                .sendMessage(jid, {
                  text: `@${sender.split("@")[0]} ${_dndMsg}`,
                  mentions: [sender],
                })
                .catch(() => {});
              return;
            }
          }
        }
      } catch (e) {
        console.log("[DND]", e.message);
      }

      // ── SETEMOJI TRIGGER ─────────────────────────────────────────────
      try {
        if (!text.startsWith(this.bot.prefix) && text.trim()) {
          const _seFs = require("fs-extra");
          const _sePath = "./database/setemoji.json";
          const _seDb = _seFs.existsSync(_sePath)
            ? JSON.parse(_seFs.readFileSync(_sePath, "utf8"))
            : {};
          const _emoji = text.trim();
          if (_seDb[_emoji]) {
            const _eParts = _seDb[_emoji].trim().split(/\s+/);
            const _eCmd = this.bot.commandHandler.getCommand(
              _eParts[0].toLowerCase(),
            );
            if (_eCmd) {
              await this._run(
                _eCmd,
                m,
                _eParts.slice(1),
                _eParts[0].toLowerCase(),
              );
              return;
            }
          }
        }
      } catch {}

      // ── CODEX AI — Chatbot (group, tag/reply-gated) & Chatbot DM ───────
      // Runs only on non-command text, never for the bot's own outgoing
      // messages (m.key.fromMe already covers that — the owner messaging
      // the bot from their own number is a legitimate chat and should NOT
      // be excluded here). Media messages (sticker/image/video) have no
      // text/caption, so they're let through on type alone.
      // Placed AFTER setemoji so an explicit emoji binding always wins over
      // the ambient AI chat (otherwise chatbotdm/mode:all would swallow a
      // bare emoji before setemoji ever got a chance to see it).
      const _isChatbotMediaType = [
        "stickerMessage",
        "imageMessage",
        "videoMessage",
        "audioMessage",
      ].includes(m.type);
      if (
        !m.key.fromMe &&
        (text.trim() || _isChatbotMediaType) &&
        !text.startsWith(this.bot.prefix)
      ) {
        try {
          const handled = await this._handleChatbotAI(m, text.trim());
          if (handled) return;
        } catch (e) {
          console.error("[CHATBOT-AI]", e.message);
        }
      }

      // ── #notename shorthand ───────────────────────────────────────────
      if (text.startsWith("#") && text.length > 1) {
        const name = text.slice(1).trim().toLowerCase();
        let db = {};
        try {
          db = JSON.parse(fs.readFileSync("./database/notes.json", "utf8"));
        } catch {}
        const note = db[jid]?.[name];
        if (note) {
          await this.bot.sendMessage(jid, {
            text: `📌 *${name.toUpperCase()}*\n\n${note.text}`,
          });
          return;
        }
      }

      // ── PREFIX CHECK ──────────────────────────────────────────────────
      if (!text.startsWith(this.bot.prefix)) return;

      const args = text.slice(this.bot.prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      const command = this.bot.commandHandler.getCommand(commandName);

      if (!command) return;

      const isMod = this.bot.permission.isMod(sender);
      const isSudo = this.bot.permission.isSudo(sender);
      const isAdmin = m.isGroup
        ? await this.bot.permission.isAdmin(jid, sender, m._participantRaw)
        : false;

      if (command.groupOnly && !m.isGroup) {
        return await m.reply("This command only works in groups!");
      }
      // Owner-only gate: owner OR mod bypass this — mod has full access
      // (including owner-only commands) in both public and private mode.
      // Sudo does NOT bypass this — sudo can use everything except
      // owner-only commands.
      if (command.ownerOnly && !isOwner && !isMod) {
        return await m.reply("🚫 Owner-only command.");
      }
      // Sudo-only gate: owner, mod, or sudo.
      if (command.sudoOnly && !isOwner && !isMod && !isSudo) {
        return await m.reply("🚫 Owner/sudo-only command.");
      }
      if (command.adminOnly && !isAdmin) {
        return await m.reply("Admin only command!");
      }

      try {
        const ctCfg = this.bot.config.cmdTyping || {};
        const crecCfg = this.bot.config.cmdRecording || {};
        // Also check variables.json (set via .autotyping / .autorecording)
        let _vars = {};
        try {
          _vars = JSON.parse(
            require("fs").readFileSync("./database/variables.json", "utf8"),
          );
        } catch {}
        const _doTyping =
          ctCfg.enabled ||
          _vars.AUTO_TYPING === true ||
          _vars.AUTO_TYPING === "true";
        const _doRecording =
          crecCfg.enabled ||
          _vars.AUTO_RECORDING === true ||
          _vars.AUTO_RECORDING === "true";
        if (_doTyping) {
          await this.bot.sock
            .sendPresenceUpdate("composing", jid)
            .catch(() => {});
          await new Promise((r) => setTimeout(r, 800));
        }
        if (_doRecording) {
          await this.bot.sock
            .sendPresenceUpdate("recording", jid)
            .catch(() => {});
          await new Promise((r) => setTimeout(r, 800));
        }

        const crCfg = this.bot.config.cmdReact || {};
        let reactKey = null;
        if (crCfg.enabled) {
          const emoji = crCfg.emoji || command.reactEmoji || "⏳";
          await this.bot.sock
            .sendMessage(jid, {
              react: { text: emoji, key: msg.key },
            })
            .catch(() => null);
          reactKey = msg.key;
        }

        await this._run(command, m, args, commandName);

        if (crCfg.enabled && reactKey) {
          const doneEmoji = crCfg.doneEmoji || command.reactDoneEmoji || "✅";
          await this.bot.sock
            .sendMessage(jid, {
              react: { text: doneEmoji, key: reactKey },
            })
            .catch(() => {});
        }

        if (ctCfg.enabled || crecCfg.enabled) {
          await this.bot.sock.sendPresenceUpdate("paused", jid).catch(() => {});
        }
      } catch (err) {
        console.error("Command error:", err);
        await m.reply(`Error: ${err.message}`);
      }
    } catch (err) {
      console.error("Message handler error:", err);
    }
  }

  /**
   * Returns a Set of every digit-string identifier WhatsApp might use to refer
   * to this bot inside a specific group (phone JID, @lid, etc). Mention/reply
   * detection by comparing a single ID form is fragile under WhatsApp's @lid
   * rollout (same root issue as the isAdmin bug) — this cross-references the
   * group's own participant list (like isAdmin/isBotAdmin do) to learn every
   * alias the group itself knows for the bot, then caches it for 10 minutes.
   */
  async _getBotIdentityCandidates(jid) {
    this._botIdCache = this._botIdCache || new Map();
    const cached = this._botIdCache.get(jid);
    if (cached && Date.now() < cached.expires) return cached.candidates;

    const _digits = (j) =>
      (j || "")
        .replace(/:[0-9]+@/, "@")
        .split("@")[0]
        .replace(/[^0-9]/g, "");
    const candidates = new Set();
    [this.bot.sock.user?.id, this.bot.sock.user?.lid].forEach((j) => {
      const d = _digits(j);
      if (d) candidates.add(d);
    });

    try {
      const meta = await this.bot.sock.groupMetadata(jid);
      const me = meta.participants.find((p) => {
        const cands = [p.id, p.lid, p.jid, p.phoneNumber]
          .map(_digits)
          .filter(Boolean);
        return cands.some((c) => candidates.has(c));
      });
      if (me) {
        [me.id, me.lid, me.jid, me.phoneNumber].forEach((j) => {
          const d = _digits(j);
          if (d) candidates.add(d);
        });
      }
    } catch (e) {
      /* groupMetadata can fail transiently — fall back to what we have */
    }

    this._botIdCache.set(jid, {
      candidates,
      expires: Date.now() + 10 * 60 * 1000,
    });
    return candidates;
  }

  async _handleChatbotAI(m, text) {
    const jid = m.chat;
    const sender = m.sender;
    const smartAI = require("./smartAI");
    const {
      buildDmSystemPrompt,
      buildGroupSystemPrompt,
    } = require("./codexPersona");
    const pending = require("./pendingMedia");
    const quoted = { quoted: { key: m.key, message: m.message } };
    const pendKey = jid + ":" + sender;

    let globalCfg = {};
    try {
      globalCfg = JSON.parse(
        fs.readFileSync("./database/chatbotglobal.json", "utf8"),
      );
    } catch {}

    let system, memKey, voiceOn;

    if (!m.isGroup) {
      // ── DM ───────────────────────────────────────────────────────────
      let db = {};
      try {
        db = JSON.parse(fs.readFileSync("./database/chatbotdm.json", "utf8"));
      } catch {}
      if (!db.enabled) return false;
      system = buildDmSystemPrompt(globalCfg);
      memKey = "dm:" + sender;
      voiceOn = !!db.voice;
    } else {
      // ── Group — tag/reply/name-gated unless mode is "all" ────────────
      let gdb = {};
      try {
        gdb = JSON.parse(
          fs.readFileSync("./database/chatbotgroup.json", "utf8"),
        );
      } catch {}
      const cfg = gdb[jid] || {};
      const enabled = globalCfg.allGroupsEnabled || cfg.enabled;
      if (!enabled) return false;

      const mode = cfg.mode || "tag";
      let triggered = mode === "all";
      if (!triggered) {
        const botCandidates = await this._getBotIdentityCandidates(jid);
        const _digits = (j) =>
          (j || "")
            .replace(/:[0-9]+@/, "@")
            .split("@")[0]
            .replace(/[^0-9]/g, "");
        const _isBot = (j) => {
          const d = _digits(j);
          return !!d && botCandidates.has(d);
        };
        const allMentions = [
          ...(m.mentions || []),
          ...(m.contextInfo?.mentionedJid || []),
          ...(m.msg?.contextInfo?.mentionedJid || []),
        ];
        const mentioned = allMentions.some(_isBot);
        const quotedPart =
          m.contextInfo?.participant || m.msg?.contextInfo?.participant || "";
        const repliedToBot = _isBot(quotedPart);
        // Fallback 1: literal "@<digits>" in the raw text, in case mentionedJid
        // is empty/mismatched but WhatsApp still rendered the mention as text.
        const textMentionDigits = [...(text || "").matchAll(/@(\d{5,})/g)].map(
          (mm) => mm[1],
        );
        const textMentioned = textMentionDigits.some((d) =>
          botCandidates.has(d),
        );
        // Fallback 2: saying the bot's name also works, regardless of JIDs.
        const namedTrigger = /\bcodex\b/i.test(text || "");
        triggered = mentioned || repliedToBot || textMentioned || namedTrigger;
      }
      // A pending "describe/sticker/gif?" follow-up still needs an answer
      // even if this particular reply doesn't re-tag the bot.
      if (!triggered && !pending.get(pendKey)) return false;

      system = buildGroupSystemPrompt(globalCfg, cfg);
      memKey = "grp:" + jid + ":" + sender;
      voiceOn = !!cfg.voice;
    }

    // ── Resolve a pending media choice first ────────────────────────────
    const pend = pending.get(pendKey);
    if (pend)
      return await this._resolvePendingMedia({
        jid,
        quoted,
        pend,
        text,
        pendKey,
      });

    // ── Voice note — transcribe, then treat as a normal text turn ──────
    if (m.type === "audioMessage" && m.msg?.ptt) {
      return await this._handleIncomingVoiceNote({
        m,
        jid,
        quoted,
        memKey,
        system,
        voiceOn,
      });
    }

    // ── Fresh sticker / image / video ───────────────────────────────────
    if (m.type === "stickerMessage")
      return await this._handleIncomingSticker({ m, jid, quoted });
    if (m.type === "imageMessage")
      return await this._handleIncomingImage({ m, jid, quoted, pendKey });
    if (m.type === "videoMessage")
      return await this._handleIncomingVideo({ m, jid, quoted, pendKey });

    if (!text || !text.trim()) return false;
    return await this._respondToText({
      m,
      jid,
      quoted,
      memKey,
      system,
      voiceOn,
      text,
    });
  }

  /** Shared by typed text AND transcribed voice notes: image-gen/lyrics intercepts → AI reply → voice-on-demand. */
  async _respondToText({ m, jid, quoted, memKey, system, voiceOn, text }) {
    const smartAI = require("./smartAI");
    const cleanText = text.replace(/@\d+/g, "").trim() || "Hi";

    // ── Image-gen intercept (e.g. "generate an image of a tiger") ───────
    try {
      const { maybeSendGeneratedImage } = require("./chatbotImageGen");
      if (
        await maybeSendGeneratedImage({
          bot: this.bot,
          jid,
          m,
          text: cleanText,
        })
      )
        return true;
    } catch {}

    // ── Lyrics request intercept (metadata + link only, never full text) ──
    try {
      const { maybeSendLyricsInfo } = require("./lyrics");
      if (await maybeSendLyricsInfo({ bot: this.bot, jid, m, text: cleanText }))
        return true;
    } catch {}

    // ── Emoji-react-when-asked (.chatbot emoji add / .chatbot emoji react on|off) ──
    const EMOJI_REACT_TRIGGER =
      /\breact(\s+to\s+(this|that|it|my\s+\w+|the\s+\w+))?\b[^.!?]{0,25}\bemoji\b|\bemoji\b[^.!?]{0,25}\breact\b|\breact\s+to\s+(this|that|it)\b|\bdrop\s+(an?\s+)?emoji\b|\bgive\s+(it|this|that)\s+(an?\s+)?(emoji\s+)?reaction\b/i;
    if (EMOJI_REACT_TRIGGER.test(cleanText)) {
      let glob = {};
      try {
        glob = JSON.parse(
          fs.readFileSync("./database/chatbotglobal.json", "utf8"),
        );
      } catch {}
      if (!glob.emojiPool || !glob.emojiPool.length) {
        await this.bot.sendMessage(
          jid,
          {
            text: `No emojis added yet. Use ${this.bot.prefix}chatbot emoji add <emojis> to add one.`,
          },
          quoted,
        );
        return true;
      }
      if (glob.emojiReactEnabled !== false) {
        const emoji =
          glob.emojiPool[Math.floor(Math.random() * glob.emojiPool.length)];
        await this.bot.sock
          .sendMessage(jid, { react: { text: emoji, key: m.key } })
          .catch(() => {});
        return true;
      }
      // emojiReactEnabled is explicitly off — fall through to a normal AI reply instead.
    }

    // ── Voice-on-demand: explicit request overrides the toggle for this turn ──
    const wantsVoice =
      /\b(voice note|voice message|send.{0,15}voice|reply.{0,15}voice|say it (out loud)?|record.{0,15}voice|audio (note|reply|message))\b/i.test(
        cleanText,
      );

    const aiReply = await smartAI
      .ask({ bot: this.bot, key: memKey, system, user: cleanText })
      .catch(() => null);
    if (!aiReply) return true; // gate matched but no AI output (key missing/rate-limited) — stay silent, don't spam

    if (voiceOn || wantsVoice) {
      try {
        const { generateVoice } = require("./ttsHelper");
        const voice = await generateVoice(aiReply);
        if (voice?.buffer) {
          await this.bot.sendMessage(
            jid,
            { audio: voice.buffer, mimetype: voice.mimetype, ptt: true },
            quoted,
          );
          return true;
        }
      } catch {}
    }
    await this.bot.sendMessage(jid, { text: aiReply }, quoted);
    return true;
  }

  async _handleIncomingVoiceNote({ m, jid, quoted, memKey, system, voiceOn }) {
    try {
      const { downloadMediaBuffer } = require("./mediaAnalyzer");
      const smartAI = require("./smartAI");

      const buf = await downloadMediaBuffer(m.msg, "audio");
      if (!buf?.length) return true;

      const transcript = await smartAI.transcribeAudio(
        this.bot,
        buf,
        m.msg?.mimetype || "audio/ogg",
      );
      if (!transcript || !transcript.trim()) {
        await this.bot.sendMessage(
          jid,
          { text: "🎤 Couldn't make out that voice note — mind trying again?" },
          quoted,
        );
        return true;
      }
      return await this._respondToText({
        m,
        jid,
        quoted,
        memKey,
        system,
        voiceOn,
        text: transcript,
      });
    } catch (e) {
      console.error("[chatbot voice-note]", e.message);
      return true;
    }
  }

  async _handleIncomingSticker({ m, jid, quoted }) {
    try {
      const { downloadMediaBuffer, describeImage } = require("./mediaAnalyzer");
      const { bufferToSticker } = require("./stickerMaker");
      const { generateImageBuffer } = require("./chatbotImageGen");

      const buf = await downloadMediaBuffer(m.msg, "sticker");
      if (!buf?.length) return true;

      const description = await describeImage({
        bot: this.bot,
        buffer: buf,
        question:
          "Briefly describe what this sticker shows (subject, expression/mood, style). Keep it to 1-2 sentences.",
      }).catch(() => null);

      if (description)
        await this.bot.sendMessage(jid, { text: `🖼️ ${description}` }, quoted);

      try {
        const prompt = description
          ? `a fun reaction sticker about: ${description}`
          : "a fun playful reaction sticker";
        const gen = await generateImageBuffer(prompt);
        if (gen?.buffer) {
          const stickerBuf = await bufferToSticker(gen.buffer, {
            pack: "CODEX AI",
            author: "CODEX",
          });
          await this.bot.sendMessage(
            jid,
            { sticker: stickerBuf, premium: 1 },
            quoted,
          );
        }
      } catch (e) {
        console.error("[chatbot sticker-reply]", e.message);
      }

      return true;
    } catch (e) {
      console.error("[chatbot sticker]", e.message);
      return true;
    }
  }

  async _handleIncomingImage({ m, jid, quoted, pendKey }) {
    try {
      const { downloadMediaBuffer } = require("./mediaAnalyzer");
      const pending = require("./pendingMedia");

      const buf = await downloadMediaBuffer(m.msg, "image");
      if (!buf?.length) return true;

      pending.set(pendKey, {
        kind: "image",
        buffer: buf,
        mimetype: m.msg?.mimetype || "image/jpeg",
      });

      await this.bot.sendMessage(
        jid,
        {
          text:
            "🖼️ Got your image! What should I do —\n\n" +
            "• *describe* it\n" +
            "• turn it into a *normal* sticker\n" +
            "• turn it into a *premium* sticker 💎\n\n" +
            "Just reply with what you want.",
        },
        quoted,
      );
      return true;
    } catch (e) {
      console.error("[chatbot image]", e.message);
      return true;
    }
  }

  async _handleIncomingVideo({ m, jid, quoted, pendKey }) {
    try {
      const { downloadMediaBuffer } = require("./mediaAnalyzer");
      const pending = require("./pendingMedia");

      const buf = await downloadMediaBuffer(m.msg, "video");
      if (!buf?.length) return true;

      pending.set(pendKey, {
        kind: "video",
        buffer: buf,
        mimetype: m.msg?.mimetype || "video/mp4",
      });

      await this.bot.sendMessage(
        jid,
        {
          text:
            "🎥 Got your video! What should I do —\n\n" +
            "• *describe* what's happening\n" +
            "• turn it into a *normal* sticker/gif\n" +
            "• turn it into a *premium* sticker 💎\n" +
            '• if it has music, say *"yes"* and I\'ll try to ID the song\n\n' +
            "Just reply with what you want.",
        },
        quoted,
      );
      return true;
    } catch (e) {
      console.error("[chatbot video]", e.message);
      return true;
    }
  }

  async _resolvePendingMedia({ jid, quoted, pend, text, pendKey }) {
    const pending = require("./pendingMedia");
    const t = (text || "").toLowerCase();

    try {
      if (pend.kind === "image") {
        if (/sticker/.test(t)) {
          const isPremium = /premium/.test(t) && !/normal/.test(t);
          const { bufferToSticker } = require("./stickerMaker");
          const stickerBuf = await bufferToSticker(pend.buffer, {
            pack: "CODEX AI",
            author: "CODEX",
          });
          const payload = isPremium
            ? { sticker: stickerBuf, premium: 1 }
            : { sticker: stickerBuf };
          await this.bot.sendMessage(jid, payload, quoted);
          pending.clear(pendKey);
          return true;
        }
        if (/gif/.test(t)) {
          await this.bot.sendMessage(
            jid,
            {
              image: pend.buffer,
              gifPlayback: true,
              caption: "🎞️ Here you go!",
            },
            quoted,
          );
          pending.clear(pendKey);
          return true;
        }
        if (/describe|what.*(is|in)|explain|analy/.test(t)) {
          const { describeImage } = require("./mediaAnalyzer");
          const description = await describeImage({
            bot: this.bot,
            buffer: pend.buffer,
            question: "Describe this image in helpful detail.",
          });
          await this.bot.sendMessage(
            jid,
            {
              text: description
                ? `🖼️ ${description}`
                : "Couldn't analyze that image right now.",
            },
            quoted,
          );
          pending.clear(pendKey);
          return true;
        }
        await this.bot.sendMessage(
          jid,
          {
            text: "Want me to *describe* it, or turn it into a *normal* or *premium* 💎 sticker?",
          },
          quoted,
        );
        return true;
      }

      if (pend.kind === "video") {
        if (/sticker|gif/.test(t)) {
          const isPremium = /premium/.test(t) && !/normal/.test(t);
          const { bufferToSticker } = require("./stickerMaker");
          const stickerBuf = await bufferToSticker(pend.buffer, {
            pack: "CODEX AI",
            author: "CODEX",
            isVideo: true,
          });
          const payload = isPremium
            ? { sticker: stickerBuf, premium: 1 }
            : { sticker: stickerBuf };
          await this.bot.sendMessage(jid, payload, quoted);
          pending.clear(pendKey);
          return true;
        }
        if (/yes|describe|song|music/.test(t)) {
          const {
            extractVideoFrame,
            extractAudioTrack,
            describeImage,
          } = require("./mediaAnalyzer");
          const { identifySong, isConfigured } = require("./musicId");

          const frame = await extractVideoFrame(pend.buffer);
          const description = frame
            ? await describeImage({
                bot: this.bot,
                buffer: frame,
                question: "Describe what is happening in this video frame.",
              })
            : null;

          const audioBuf = await extractAudioTrack(pend.buffer);
          let songLine = "";
          if (audioBuf) {
            const song = await identifySong(this.bot, audioBuf);
            if (song?.title) {
              songLine = `\n\n🎵 *Song:* ${song.title}${song.artist ? ` — ${song.artist}` : ""}`;
            } else {
              songLine = `\n\n🎵 _Couldn't identify the song${isConfigured(this.bot) ? " — no match found." : " — song-ID isn't set up yet (needs a RapidAPI key, see .aiapi status)."}_`;
            }
          }

          await this.bot.sendMessage(
            jid,
            {
              text:
                (description
                  ? `🎥 ${description}`
                  : "Couldn't analyze the video.") + songLine,
            },
            quoted,
          );
          pending.clear(pendKey);
          return true;
        }
        await this.bot.sendMessage(
          jid,
          {
            text: 'Want me to *describe* it, turn it into a *normal/premium* 💎 sticker, or — if it has music — say *"yes"* and I\'ll try to ID the song.',
          },
          quoted,
        );
        return true;
      }
    } catch (e) {
      console.error("[chatbot pending-media]", e.message);
      pending.clear(pendKey);
      return true;
    }

    pending.clear(pendKey);
    return false;
  }

  async _handleAutoReply(m, text) {
    try {
      let db = {};
      try {
        db = JSON.parse(fs.readFileSync("./database/autoreply.json", "utf8"));
      } catch {}

      // ── Tag trigger: runs ALWAYS even if autoreply is off ────────────
      // If AREPLY_NUMBER is set and that number gets tagged → send reply
      const areplyNum = this.bot.config.AREPLY_NUMBER;
      if (areplyNum && (m.mentions || []).length > 0) {
        const cleanNum = areplyNum.replace(/[^0-9]/g, "");
        const cleanTarget = cleanNum + "@s.whatsapp.net";
        // Match mentions regardless of device suffix (:12@, etc.)
        const tagged = (m.mentions || []).some((jid) => {
          const stripped = jid.replace(/:[0-9]+@/, "@");
          return (
            stripped === cleanTarget || stripped.startsWith(cleanNum + "@")
          );
        });
        if (tagged) {
          // Use AREPLY_MSG if set, otherwise fall back to first rule's reply
          let replyText =
            this.bot.config.AREPLY_MSG ||
            (db.rules?.length ? db.rules[0].reply : null);
          if (!replyText) return; // No message configured
          if (db.mode === "emoji") {
            const pool = db.emojis?.length
              ? db.emojis
              : ["😊", "👍", "🔥", "❤", "✨"];
            replyText += " " + pool[Math.floor(Math.random() * pool.length)];
          }
          await this.bot.sendMessage(
            m.chat,
            { text: replyText, mentions: [cleanTarget] },
            { quoted: { key: m.key, message: m.message } },
          );
          return;
        }
      }

      // ── Keyword trigger: only runs if autoreply is enabled ────────────
      if (!db.enabled) return;
      const lower = text.toLowerCase();
      const match = db.rules.find((r) =>
        lower.includes(r.trigger.toLowerCase()),
      );
      if (!match) return;

      let replyText = match.reply;
      if (db.mode === "emoji") {
        const pool = db.emojis?.length
          ? db.emojis
          : ["😊", "👍", "🔥", "❤", "✨"];
        replyText += " " + pool[Math.floor(Math.random() * pool.length)];
      }

      await this.bot.sendMessage(
        m.chat,
        { text: replyText },
        { quoted: { key: m.key, message: m.message } },
      );
    } catch (err) {
      console.error("AutoReply error:", err.message);
    }
  }

  async _handleStatusMention(m) {
    try {
      const cfg = this.bot.config.antiGroupMention;
      if (!cfg?.enabled) return;
      const statusMentions = m.msg?.contextInfo?.mentionedJid || [];
      if (!statusMentions.length) return;
      const dbPath = "./database/antigroupmention.json";
      let db = {};
      try {
        db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      } catch {}
      for (const jid of statusMentions) {
        if (jid.endsWith("@g.us") && db[jid]?.enabled) {
          const statusDbPath = "./database/statusmention.json";
          let statusDb = {};
          try {
            statusDb = JSON.parse(fs.readFileSync(statusDbPath, "utf8"));
          } catch {}
          if (!statusDb[jid]) statusDb[jid] = [];
          statusDb[jid].push({
            statusJid: m.key.remoteJid,
            sender: m.sender,
            time: Date.now(),
          });
          fs.writeFileSync(statusDbPath, JSON.stringify(statusDb, null, 2));
        }
      }
    } catch (err) {
      console.error("Status mention handler error:", err);
    }
  }

  async _handleStickerCommand(m) {
    try {
      // Support both hex (setcmd format) and base64
      const sha = m.msg.fileSha256;
      const idHex = Buffer.isBuffer(sha) ? sha.toString("hex") : String(sha);
      const idB64 = Buffer.isBuffer(sha) ? sha.toString("base64") : "";
      const id = idHex; // Use hex — matches setcmd output
      let db = {};
      try {
        db = JSON.parse(
          fs.readFileSync("./database/sticker_cmds.json", "utf8"),
        );
      } catch {}
      const entry = db[idHex] || db[idB64];
      if (!entry) return;

      // Note type: show the note
      if (entry.type === "note") {
        let notesDb = {};
        try {
          notesDb = JSON.parse(
            fs.readFileSync("./database/notes.json", "utf8"),
          );
        } catch {}
        const chatId = entry.chat || m.chat;
        const note = notesDb[chatId]?.[entry.noteName];
        if (!note)
          return await this.bot.sendMessage(m.chat, {
            text: `Note "${entry.noteName}" no longer exists.`,
          });
        return await this.bot.sendMessage(m.chat, {
          text: `${entry.noteName.toUpperCase()}\n\n${note.text}`,
        });
      }

      // Command type
      const cmd = this.bot.commandHandler.getCommand(entry.command);
      if (!cmd) return;
      await this._run(cmd, m, [], entry.command);
    } catch (err) {
      console.error("Sticker cmd error:", err);
    }
  }

  smsg(msg) {
    if (!msg.message) return null;
    let m = {};
    m.message = msg.message;
    m.key = msg.key;
    m.chat = msg.key.remoteJidAlt || msg.key.remoteJid;
    m.fromMe = msg.key.fromMe;
    m.id = msg.key.id;
    m.isGroup = m.chat.endsWith("@g.us");

    // ── LID/JID sender resolution ────────────────────────────────────────
    // fromMe=true always means the owner sent this message (from their phone).
    // Resolve sender directly to owner number in ALL cases (group or DM).
    // This ensures isOwner() returns true in both DM and group for owner commands.
    if (msg.key.fromMe) {
      m.sender = (
        this.bot.sock.user?.id ||
        msg.key.remoteJidAlt ||
        msg.key.remoteJid
      ).replace(/:[0-9]+@/, "@");
    } else if (m.isGroup) {
      m.sender = (
        msg.key.participantAlt ||
        msg.key.participant ||
        msg.key.remoteJidAlt ||
        msg.key.remoteJid
      ).replace(/:[0-9]+@/, "@");
    } else {
      m.sender = (msg.key.remoteJidAlt || msg.key.remoteJid || "").replace(
        /:[0-9]+@/,
        "@",
      );
    }

    m.pushName = msg.pushName || "";
    m._raw = msg; // raw Baileys message
    m._participantRaw = msg.key.participant || ""; // participant with device suffix intact

    const type = getContentType(msg.message);
    m.type = type;

    // Handle view-once messages (all variants)
    if (
      type === "viewOnceMessage" ||
      type === "viewOnceMessageV2" ||
      type === "viewOnceMessageV2Extension"
    ) {
      const innerMsg = msg.message[type]?.message || msg.message[type];
      const innerType = getContentType(innerMsg);
      m.msg = innerMsg?.[innerType];
      m.viewOnce = true;
      m.viewOnceType = innerType;
      m.viewOnceMsg = innerMsg;
      m.viewOnceRaw = msg;
    } else {
      m.msg = msg.message[type];
    }

    // Extract text — try all known locations to handle fromMe group messages
    m.text =
      typeof m.msg === "string"
        ? m.msg
        : m.msg?.text ||
          m.msg?.caption ||
          m.msg?.conversation ||
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          msg.message?.documentMessage?.caption ||
          "";

    // Pull contextInfo from every possible message type location
    const _rawMsg = msg.message || {};
    const _ctx =
      _rawMsg.extendedTextMessage?.contextInfo ||
      _rawMsg.imageMessage?.contextInfo ||
      _rawMsg.videoMessage?.contextInfo ||
      _rawMsg.documentMessage?.contextInfo ||
      _rawMsg.audioMessage?.contextInfo ||
      _rawMsg.stickerMessage?.contextInfo ||
      _rawMsg.buttonsMessage?.contextInfo ||
      (typeof m.msg === "object" ? m.msg?.contextInfo : null) ||
      {};
    m.mentions = _ctx.mentionedJid || [];
    m.contextInfo = _ctx;

    const bot = this.bot;

    // m.reply routes through bot.sendMessage so font + character/emoji all apply automatically
    m.reply = async (text, opts = {}) => {
      return await bot.sendMessage(m.chat, { text, ...opts }, { quoted: msg });
    };

    return m;
  }
}

module.exports = MessageHandler;
// Re-export lists so command files (botcharacter, botemoji, setvar) can import from here
module.exports.BOT_CHARACTERS = BOT_CHARACTERS;
module.exports.BOT_EMOJIS = BOT_EMOJIS;
