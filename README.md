# 📦 pkgui

> **Universal Package Manager GUI** — xterm.js powered terminal UI for 40+ package managers, with OS detection, command builder, and one-click copy. Deployable to Cloudflare Workers/Pages.

[![CI/CD](https://github.com/YOUR_USERNAME/pkgui/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/pkgui/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ Features

- 🖥️ **xterm.js terminal** — full interactive terminal UI in the browser
- 🔍 **OS detection** — automatically detects Linux, macOS, Windows, BSD and suggests relevant managers
- 📦 **40+ package managers** — apt, dnf, pacman, brew, winget, nix, guix, flatpak, snap, pip, npm, cargo, gem, and many more
- ⌨️ **Command builder** — select a manager, type a package name, get the exact command
- 🔀 **Compare view** — see install commands for the same package across all managers (Ctrl+K)
- 🎨 **4 themes** — Dark (GitHub), Light, Dracula, Nord
- ☁️ **Cloudflare Workers/Pages** compatible — full REST API + static SPA
- 📦 **Single-file release** — GitHub Releases include a standalone `.html` bundle (no server needed)
- 🤖 **CI/CD** — GitHub Actions builds, tests, and deploys automatically

---

## 🚀 Quick Start

### Open locally
```bash
git clone https://github.com/YOUR_USERNAME/pkgui
cd pkgui
npm install
npm run dev
# → http://localhost:5173
```

### Use the single-file bundle (no install)
Download `pkgui-x.x.x-bundle.html` from [Releases](https://github.com/YOUR_USERNAME/pkgui/releases) and open it in your browser.

### Deploy to Cloudflare Pages
```bash
npm run build:all
wrangler pages deploy dist/ --project-name=pkgui
```

---

## 📦 Supported Package Managers

### Linux
| Manager | Distros |
|---------|---------|
| `apt` | Debian, Ubuntu, Mint, Kali |
| `dpkg` | Debian, Ubuntu |
| `dnf` | Fedora, RHEL, CentOS Stream, AlmaLinux, Rocky |
| `yum` | RHEL 7, CentOS 7 |
| `rpm` | RHEL, Fedora, SUSE |
| `zypper` | openSUSE, SUSE Linux Enterprise |
| `pacman` | Arch, Manjaro, EndeavourOS, Garuda |
| `yay` | Arch (AUR) |
| `apk` | Alpine Linux |
| `xbps` | Void Linux |
| `portage` | Gentoo, Funtoo |
| `slackpkg` | Slackware |
| `equo` | Sabayon (Entropy) |
| `flatpak` | Any Linux |
| `snap` | Ubuntu + snapd distros |
| `appimage` | Any Linux |

### macOS
| Manager | Notes |
|---------|-------|
| `brew` | Homebrew (also works on Linux) |
| `macports` | MacPorts / DarwinPorts |
| `mas` | Mac App Store CLI |

### Windows
| Manager | Notes |
|---------|-------|
| `winget` | Windows 10/11 built-in |
| `choco` | Chocolatey |
| `scoop` | Scoop |

### BSD
| Manager | Distros |
|---------|---------|
| `pkg` | FreeBSD, GhostBSD |
| `pkgsrc` | NetBSD, DragonFly, macOS |
| `pkg_add` | OpenBSD |

### Cross-platform / Nix
| Manager | Notes |
|---------|-------|
| `nix` | NixOS + any platform |
| `nixos-rebuild` | NixOS system rebuild |
| `guix` | GNU Guix |

### Language-specific
| Manager | Language |
|---------|----------|
| `pip` | Python |
| `npm` | Node.js |
| `yarn` | Node.js |
| `cargo` | Rust |
| `gem` | Ruby |
| `composer` | PHP |
| `go` | Go |
| `nuget` | .NET |
| `conda` | Python/Data Science |
| `maven` | Java |

---

## ⌨️ Terminal Commands

```
detect              Detect your OS and suggest package managers
list [os]           List all managers (filter by: linux/macos/windows/bsd/cross)
use <manager>       Select active package manager
install <pkg>       Generate install command
remove <pkg>        Generate remove command
update              Generate index update command
upgrade             Generate upgrade-all command
search <query>      Generate search command
info <pkg>          Generate info command
listpkgs            List installed packages command
clean               Generate cleanup command
compare <pkg>       Compare install command across all managers
theme <name>        Switch theme: dark / light / dracula / nord
clear               Clear terminal
version             Show version
```

**Keyboard shortcuts:**
- `Ctrl+/` — focus manager search
- `Ctrl+K` — open compare modal
- `Ctrl+L` — clear terminal
- `↑↓` — command history
- `Ctrl+C` — cancel

---

## ☁️ REST API (Cloudflare Worker)

The worker exposes a JSON API alongside the SPA:

```
GET /api/managers              All managers (JSON)
GET /api/managers?os=linux     Filter by OS
GET /api/managers/:id          Single manager
GET /api/detect                OS detection from User-Agent
GET /api/command?manager=apt&action=install&pkg=curl
GET /api/compare?pkg=curl      Compare install commands
GET /health                    Health check
```

### Example
```bash
curl https://pkgui.example.com/api/command?manager=apt&action=install&pkg=curl
# → {"manager":"apt","action":"install","pkg":"curl","command":"sudo apt install curl"}

curl https://pkgui.example.com/api/detect -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64)"
# → {"os":"linux","recommended":["apt","dnf","pacman",...]}
```

---

## 🏗️ Architecture

```
pkgui/
├── src/
│   ├── managers.js        ← Package manager registry (40+ managers, all commands)
│   ├── terminal.js        ← xterm.js wrapper, ANSI colors, command engine
│   ├── main.js            ← UI wiring, sidebar, toolbar, events
│   ├── style.css          ← CSS with 4 theme variables
│   └── managers.test.js   ← Vitest tests
├── worker/
│   └── index.js           ← Cloudflare Worker (SPA + REST API)
├── scripts/
│   ├── package.js         ← Release artifact bundler
│   └── inline-bundle.js   ← Single-file HTML inliner
├── .github/workflows/
│   └── ci.yml             ← CI: test → build → deploy → release
├── index.html             ← SPA entry point
├── vite.config.js
├── wrangler.toml          ← Cloudflare config
└── vitest.config.js
```

---

## 🔄 CI/CD Pipeline

### On push to `main`
1. Lint & test
2. Build SPA + Worker
3. Deploy to Cloudflare Pages (preview URL)

### On `v*.*.*` tag
1. Lint & test
2. Build normal dist
3. Build single-file bundle (`BUNDLE_SINGLE=1`)
4. Package release artifacts (zip, worker.js, bundle.html, source.tar.gz)
5. Create GitHub Release with changelog
6. Deploy to Cloudflare Pages (production)
7. Deploy Worker API

### Creating a release
```bash
git tag v1.2.0
git push origin v1.2.0
# GitHub Actions does the rest
```

---

## 🔧 Configuration

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `CF_API_TOKEN` | Cloudflare API token (Pages + Workers write) |
| `CF_ACCOUNT_ID` | Cloudflare account ID |

### Environment Variables (Vite)
| Variable | Default | Description |
|----------|---------|-------------|
| `BUNDLE_SINGLE` | `0` | Set to `1` for single-file output |
| `VITE_VERSION` | from package.json | Override version string |

---

## 🤝 Contributing

Adding a new package manager:

1. Open `src/managers.js`
2. Add an entry to `PACKAGE_MANAGERS` array:

```js
{
  id: 'mypkg',
  name: 'MyPkg',
  fullName: 'My Package Manager',
  os: ['linux'],              // linux | macos | windows | bsd | cross
  distros: ['MyDistro'],
  icon: '📦',
  color: '#ff0000',
  detectCmd: 'which mypkg',  // or null
  commands: {
    install: (pkg) => `mypkg add ${pkg}`,
    remove:  (pkg) => `mypkg rm ${pkg}`,
    update:  ()    => `mypkg sync`,
    upgrade: ()    => `mypkg up`,
    search:  (pkg) => `mypkg search ${pkg}`,
    info:    (pkg) => `mypkg info ${pkg}`,
    list:    ()    => `mypkg list`,
    clean:   ()    => `mypkg clean`,
  },
  homepage: 'https://mypkg.example.com',
}
```

3. Add a test in `src/managers.test.js`
4. Open a PR!

---

## 📄 License

MIT © pkgui contributors
