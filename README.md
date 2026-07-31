<div align="center">

<img src="https://cdn.kord.live/serve/UrtTy3IkVnmE.jpg" alt="CODEX AI Banner" width="100%">

<img src="./assets/rolling-circle.svg" width="80" alt="loading spinner">

<img src="https://i.imgur.com/dBaSKWF.gif" height="18" width="100%">

<a href="https://git.io/typing-svg">
  <img src="https://readme-typing-svg.demolab.com?font=Ribeye&size=28&pause=1000&color=1F51FF&center=true&vCenter=true&width=910&height=70&repeat=true&lines=CODEX+AI;A+MULTIFUNCTIONAL+WHATSAPP+BOT+BUILT+WITH+BAILEYS.;AI+HYPER+SPEED+POWERED.;FULL+STACK+ACTIVE+AND+INTACT+GROUP+MANAGERS.;ALWAYS+ACTIVE+AND+ONLINE.;DON%27T+FORGET+TO+STAR+AND+FORK+MY+REPO.;BUILT+AND+FOUNDED+BY+CODEX." alt="Typing SVG" />
</a>

<img src="https://i.imgur.com/dBaSKWF.gif" height="18" width="100%">

<img src="https://cdn.jsdelivr.net/gh/CEO-CODEX/CODEX-AI@main/.github/assets/codex-orb.svg" width="160" height="160" alt="CODEX AI orb">

# ⚉ C O D E X — A I

<em>Your WhatsApp. Supercharged.</em>

<br>

<img src="https://img.shields.io/github/stars/CEO-CODEX/CODEX-AI?style=for-the-badge&color=FFD700&logo=github" alt="Stars"/>
<img src="https://img.shields.io/github/forks/CEO-CODEX/CODEX-AI?style=for-the-badge&color=00BFFF&logo=github" alt="Forks"/>
<img src="https://img.shields.io/github/issues/CEO-CODEX/CODEX-AI?style=for-the-badge&color=FF6B6B&logo=github" alt="Issues"/>
<img src="https://img.shields.io/github/license/CEO-CODEX/CODEX-AI?style=for-the-badge&color=2ECC71" alt="License"/>
<img src="https://img.shields.io/badge/version-3.0.0-00FFF0?style=for-the-badge" alt="Version"/>
<img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=for-the-badge&logo=node.js" alt="Node"/>
<img src="https://img.shields.io/badge/library-%40crysnovax%2Fbaileys-25D366?style=for-the-badge&logo=whatsapp" alt="Baileys"/>

</div>

---

<div align="center">

### ✦ Quick Links

[![WhatsApp Channel](https://img.shields.io/badge/Main%20Channel-Follow-25D366?style=for-the-badge&logo=whatsapp)](https://whatsapp.com/channel/0029Vb78BHmL2AU7fsANSH2y)
[![Backup Channel](https://img.shields.io/badge/Backup%20Channel-Follow-25D366?style=for-the-badge&logo=whatsapp)](https://whatsapp.com/channel/0029Vb6sMEy96H4VI2w3I50F)
[![Support Group](https://img.shields.io/badge/Support%20Group-Join-25D366?style=for-the-badge&logo=whatsapp)](https://chat.whatsapp.com/K7R4qGt8Z7E2PjWr4OvQeG)
[![Telegram Channel](https://img.shields.io/badge/Telegram%20Channel-Join-26A5E4?style=for-the-badge&logo=telegram)](https://t.me/CODEX_AIV3)
[![Telegram Group](https://img.shields.io/badge/Telegram%20Group-Join-26A5E4?style=for-the-badge&logo=telegram)](https://t.me/CODEXV3)
[![Developer](https://img.shields.io/badge/Developer-Contact-2CA5E0?style=for-the-badge&logo=telegram)](https://t.me/DEV_CODEXV3)
[![Website](https://img.shields.io/badge/Website-Visit-8A2BE2?style=for-the-badge&logo=vercel)](https://codex-ai-site.vercel.app)
[![Pairing Site](https://img.shields.io/badge/Get%20Session%20ID-Pair%20Now-FF4500?style=for-the-badge&logo=whatsapp)](https://codexai-paring-site.onrender.com/)

</div>

---

## ⚉ What is CODEX AI?

**CODEX AI** is a full-stack, multifunctional WhatsApp bot built on Node.js and a hardened Baileys fork (`@crysnovax/baileys`). It runs on your own WhatsApp number and adds AI, group management, an entire RPG-style economy, and a GTA-inspired roleplay system on top of your chats — all through a fast, plugin-driven command engine.

> Founded and built by **CODEX** 🇳🇬

---

## ⚙️ Requirements

- **Node.js** v18 or higher
- **npm**
- **FFmpeg** (bundled via `ffmpeg-static`, no manual install needed)
- A WhatsApp account (self-bot — runs on your own number)
- Recommended: a VPS or hosting panel for 24/7 uptime

> ⚠️ This project depends on the `@crysnovax/baileys` fork specifically — it will not run correctly on stock Baileys.

---

## 🚀 Deployment

### 🌐 Deploy on Render

1. Fork this repository to your own GitHub account.
2. On [Render](https://render.com), create a **New → Web Service** and connect your fork.
3. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Deploy the service once so Render has a live URL — you'll pair it in the next step.
5. Generate your session ID from the [pairing site](https://codexai-paring-site.onrender.com/), then paste it into `sessionId` in `config.json` and redeploy (or commit the change and push).
6. **Note:** Render's free tier sleeps after inactivity. The first request after idle time can take 30–60s to wake back up — this is normal, not a broken deploy. For a bot that needs to stay online 24/7, consider a paid instance or an uptime pinger.

### 🖥️ Deploy on a VPS

```bash
# Update & install prerequisites
sudo apt update && sudo apt install -y nodejs npm git

# Clone your fork
git clone https://github.com/CEO-CODEX/CODEX-AI.git codex-ai
cd codex-ai

# Install dependencies
npm install

# Configure the bot
nano config.json   # set botName, prefix, owner.number, sessionId

# Run it persistently with pm2
sudo npm install -g pm2
pm2 start index.js --name codex-ai
pm2 save
pm2 startup
```

### 🟣 Deploy on Heroku

> Heroku no longer offers a free tier — you'll need a paid dyno.

```bash
heroku login
heroku create your-codex-ai-app
git push heroku main
heroku ps:scale web=1
```

Set `sessionId` and any other values directly in `config.json` before pushing, since Heroku's filesystem resets on every deploy/dyno restart.

### 📦 Deploy on a Panel (Pterodactyl)

1. Create a new server using a **Node.js** egg (Node 18+).
2. Upload the project files via SFTP, or use the panel's **Git Pull** feature with your repo URL.
3. In the **Startup** tab, set the startup command to `node index.js`.
4. Open the console and run `npm install` once the files are in place.
5. Edit `config.json` (via the panel's file manager) to set your `sessionId` and owner details.
6. Start the server.

### 📱 Deploy on Termux

```bash
# Update Termux packages
pkg update -y && pkg upgrade -y

# Install prerequisites
pkg install -y nodejs-lts git

# Clone the repo
git clone https://github.com/CEO-CODEX/CODEX-AI.git codex-ai
cd codex-ai

# Install dependencies
npm install

# Configure the bot
nano config.json   # set botName, prefix, owner.number, sessionId

# Start the bot
node index.js
```

**Keeping it alive on your phone:**
- Run `termux-wake-lock` before starting the bot so Android doesn't kill Termux in the background.
- Disable battery optimization for Termux in your phone's Settings → Apps.
- To keep it running after you close the Termux window, start it inside `tmux`: `pkg install tmux`, then `tmux new -s codex`, run `node index.js` inside it, and detach with `Ctrl+B` then `D`. Reattach anytime with `tmux attach -t codex`.

---

## 🔑 Getting a Session ID

1. Visit the [CODEX AI Pairing Site](https://codexai-paring-site.onrender.com/).
2. Enter your WhatsApp number and follow the pairing steps.
3. Copy the session ID it gives you.
4. Paste it into the `sessionId` field of `config.json`.
5. Start the bot — it will automatically restore your session on boot.

---

<div align="center">
  <img src="https://i.imgur.com/dBaSKWF.gif" height="18" width="100%">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=00ff66&height=90&section=footer" style="margin-top:-20px;" />
  <br>
  <sub>⭐ If CODEX AI is useful to you, star and fork the repo — it helps more than you'd think.</sub>
</div>
