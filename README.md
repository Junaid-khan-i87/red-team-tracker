# 🎯 Red Team Tracker & Study Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node: >=18](https://img.shields.io/badge/Node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![Status: Active](https://img.shields.io/badge/Status-Active%20Open%20Source-orange.svg)](#)
[![Theme: GitHub Primer](https://img.shields.io/badge/Theme-GitHub%20Primer-black.svg)](#)

> A distraction-free, self-hosted web command center and Markdown studio designed for a **90-Day Red Team & Offensive Security specialization journey**.
> Zero databases. Zero build tools. Built for **30–45 minutes of daily deliberate practice**.

---

## 💡 Why I Built This

Most people who want to break into Red Teaming or advanced offensive security get stuck in the exact same trap: **Tutorial Hell**.

You bookmark 200 YouTube videos, buy three 40-hour courses, open 40 browser tabs, and promise yourself you'll study 6 hours on the weekend. By Day 14, you're burnt out, your notes are scattered across Notion, Obsidian, and random `.txt` files on your desktop, and you haven't written a single exploit or diagnostic script.

I built **Red Team Tracker** to enforce a different philosophy:
**Consistency beats cramming.**

Instead of chaotic binge-learning, this tool breaks the offensive security learning curve into **90 manageable daily steps** (30 minutes each), provides a focused daily task checklist, and pairs it with an in-browser Markdown studio to document what you learn immediately.

---

## ✨ Features

- **📊 90-Day Interactive Matrix**: Visual overview of all 90 days. Quickly check off days, monitor your streak, and see what's next.
- **✍️ Focus Markdown Studio**:
  - Live split-pane editor with syntax highlighting (`highlight.js`).
  - **Zen Fullscreen Mode** (`Esc` to exit) to eliminate all desktop distractions.
  - Quick view modes: `Split`, `Edit Only`, `Preview Only`.
  - Auto-draft saving every 5 seconds to prevent accidental work loss.
- **📋 Daily Micro-Tasks Checklist**:
  - Every day is broken into 3 actionable blocks:
    1. *Study / Theory* (15 min)
    2. *Hands-on Lab / Terminal practice* (10 min)
    3. *Document understanding* (5 min)
- **🔒 Privacy First & Client-Side Vault**:
  - Your notes stay in your hands. Stored directly in your browser's `localStorage`.
  - Zero database or cloud setup required.
  - Export your entire note vault anytime as a timestamped JSON file.
- **🔄 Direct GitHub REST Sync (Optional)**:
  - Connect your personal GitHub repository with a fine-grained Personal Access Token.
  - Commit notes and push study logs directly from the Studio into your GitHub repo via GitHub's REST API.
  - *No server-side credentials*: tokens are kept strictly in your local browser storage.
- **🌓 Light & Dark GitHub Primer Theme**:
  - High-contrast, clean typography designed for long reading and late-night terminal sessions.
- **📱 100% Responsive Design**:
  - Full mobile drawer support for reading and checking off tasks on phones and tablets.
  - Single-row desktop toolbar with collapsible header navigation.

---

## 🗺️ 90-Day Curriculum Overview

The default curriculum in `data/roadmap.json` is organized into 6 progressive phases:

| Phase | Focus Area | Days | Topics Covered |
|---|---|:---:|---|
| **Phase 1** | Technical Foundations | Days 01–15 | Network protocol mechanics, TCP/IP, DNS, routing, Wireshark, socket programming. |
| **Phase 2** | OS Internals & Security | Days 16–30 | Linux kernel, IPC, systemd, Windows NT architecture, LSASS, registry, PE formats. |
| **Phase 3** | Offensive Operations & Recon | Days 31–45 | Modern OSINT, active port scanning, DNS cache snooping, service fingerprinting. |
| **Phase 4** | Web & API Exploitation | Days 46–60 | Authentication flaws, SQLi, SSRF, IDOR, GraphQL, JWT abuse, business logic flaws. |
| **Phase 5** | Active Directory & Lateral Movement | Days 61–75 | Kerberos, BloodHound, Kerberoasting, AS-REP roasting, DCSync, pass-the-hash. |
| **Phase 6** | Evasion & Red Team Tradecraft | Days 76–90 | Antivirus/EDR evasion, process injection, AMSI bypass, C2 frameworks, reporting. |

---

## 🚀 Quick Start

### Option A: Run Locally (Node.js)

Requirements: Node.js 18+

```bash
# 1. Clone the repository
git clone https://github.com/Junaid-khan-i87/red-team-tracker.git
cd red-team-tracker

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

Visit **`http://localhost:4000`** in your browser.

---

### Option B: Run with Docker / Docker Compose

If you don't want to install Node.js locally:

```bash
# Clone and enter directory
git clone https://github.com/Junaid-khan-i87/red-team-tracker.git
cd red-team-tracker

# Start container
docker compose up -d
```

Visit **`http://localhost:4000`**.

---

### Option C: Standalone Static Mode (Zero Server)

The frontend includes self-contained scripts and fallback data:
Simply open `public/index.html` directly in any modern browser! It will run in **Offline Browser Vault** mode using `localStorage`.

---

## ⚙️ Customizing the Roadmap for Your Goals

You don't have to study Red Teaming—you can use this engine for **OSCP, Bug Bounty, Cloud Security, Web Dev, or Machine Learning**!

The entire curriculum is stored in human-readable JSON at **`data/roadmap.json`**:

```json
{
  "mission": {
    "title": "My Custom 90-Day Challenge",
    "startDate": "2026-11-16",
    "dailyMinutes": 30
  },
  "phases": [
    { "id": 1, "name": "Foundations", "weeks": [1, 2] }
  ],
  "weeks": [
    {
      "week": 1,
      "phaseId": 1,
      "title": "Core Mechanics",
      "goal": "Master fundamentals",
      "resource": "Official Documentation",
      "resourceUrl": "https://..."
    }
  ],
  "days": [
    {
      "day": 1,
      "week": 1,
      "folder": "01-networking",
      "title": "Network Mechanics & Packet Flow",
      "file": "day-01-networking.md"
    }
  ]
}
```

Edit the file, restart the server (`npm start`), and the UI automatically regenerates the matrix, week cards, and note templates.

---

## 🛠️ Architecture & Tech Stack

This project is intentionally designed with minimal moving parts:
- **Backend**: Node.js + Express (serving static assets & read-only JSON endpoint).
- **Frontend**: Vanilla JavaScript (ES6+), standard modern CSS with CSS variables.
- **Markdown & Highlight**: `marked.js` + `highlight.js` (GitHub Dark theme).
- **Icons**: `Lucide Icons`.
- **Zero build step**: No Webpack, Vite, React, or complex configuration. Edit any file and refresh your browser.

---

## 🤝 Contributing

Contributions, feedback, and suggestions are warmly welcomed!
- Found a bug or have an idea? Open an [Issue](https://github.com/Junaid-khan-i87/red-team-tracker/issues).
- Want to add a feature or improve documentation? Submit a [Pull Request](https://github.com/Junaid-khan-i87/red-team-tracker/pulls).

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.

Happy hacking & consistent learning! 🛡️⚡
