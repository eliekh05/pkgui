# 📦 pkgui

> Universal Package Manager GUI — xterm.js powered terminal UI for 40+ package managers, with OS detection and command builder.

[![CI / CD](https://github.com/eliekh05/pkgui/actions/workflows/ci.yml/badge.svg)](https://github.com/eliekh05/pkgui/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- **xterm.js terminal** — full interactive terminal in the browser
- **OS detection** — auto-detects Linux, macOS, Windows, BSD and recommends the right managers
- **40+ package managers** — apt, dnf, pacman, brew, winget, nix, guix, flatpak, snap, pip, npm, cargo, gem, and many more
- **Command builder** — select a manager, type a package name, get the exact command
- **Compare view** — see the install command for a package across every manager (`Ctrl+K`)
- **4 themes** — Dark, Light, Dracula, Nord
- **Single-file releases** — every GitHub Release ships a standalone zip (`server.js` + UI) you can run with one command

---

## Quick start

### Install from npm

```bash
npm install -g pkgui
pkgui              # opens http://127.0.0.1:7274 with UI + exec server
```

### Develop from source

```bash
git clone https://github.com/eliekh05/pkgui
cd pkgui
npm install
npm run dev        # → http://localhost:5173 (starts exec server too)
```

---

## Package managers

### Linux
`apt` · `dpkg` · `dnf` · `yum` · `rpm` · `zypper` · `pacman` · `yay` · `apk` · `xbps` · `portage` · `slackpkg` · `equo` · `flatpak` · `snap`

### macOS
`brew` · `port` (MacPorts)

### Windows
`winget` · `choco` · `scoop`

### BSD
`pkg` (FreeBSD) · `pkgsrc` (NetBSD) · `pkg_add` (OpenBSD)

### Cross-platform / Nix
`nix` · `guix`

### Language
`pip` · `npm` · `yarn` · `cargo` · `gem` · `composer` · `go` · `nuget` · `conda`

---

## Terminal commands

```
detect              Detect OS and suggest managers
list [os]           List all managers  (linux / macos / windows / bsd)
use <manager>       Select active package manager
install <pkg>       Generate install command
remove <pkg>        Generate remove command
update              Generate index update command
upgrade             Generate upgrade-all command
search <query>      Generate search command
info <pkg>          Generate info command
listpkgs            Generate list-installed command
clean               Generate cleanup command
compare <pkg>       Compare install command across every manager
theme <name>        Switch theme: dark / light / dracula / nord
clear               Clear terminal
version             Show version
```

**Keyboard shortcuts:** `↑↓` history · `Ctrl+C` cancel · `Ctrl+L` clear · `Ctrl+K` compare modal · `Ctrl+/` focus search

---

## Adding a package manager

Edit `src/managers.js` and add to the `PACKAGE_MANAGERS` array:

```js
{
  id: 'mypkg',
  name: 'MyPkg',
  fullName: 'My Package Manager',
  os: ['linux'],          // linux | macos | windows | bsd | cross
  distros: ['MyDistro'],
  icon: '📦',
  color: '#ff0000',
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

Add a test in `src/managers.test.js` then open a PR.

---

## CI / CD

| Event | What happens |
|-------|-------------|
| Push to `main` | Tests run → SPA builds → **auto-release when there are new commits** |
| GitHub Release published | **npm publish** (`pkgui` on [npmjs.com](https://www.npmjs.com/package/pkgui)) |
| Pull request | Tests run |

### Creating a release

Just push to `main`. If there are commits since the last release, CI automatically bumps the patch version and publishes a GitHub Release (e.g. `v1.0.0` → `v1.0.1`).

```bash
git push origin main
```

To release a specific version (minor/major bump), update `version` in `package.json` before pushing.

### npm publishing (maintainers)

Uses [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC) — no long-lived `NPM_TOKEN` needed.

**One-time setup on [npmjs.com](https://www.npmjs.com):**

1. Publish `pkgui` once manually if the package does not exist yet (`npm publish --access public` with 2FA).
2. Go to **pkgui → Settings → Trusted Publisher → GitHub Actions** and add:
   - Organization or user: `eliekh05`
   - Repository: `pkgui`
   - Workflow filename: `publish-npm.yml`
   - Environment: *(leave blank)*
3. Optional: under **Publishing access**, set *Require 2FA and disallow tokens* after verifying CI publish works.

When CI creates a GitHub Release, it calls `.github/workflows/publish-npm.yml` to publish via OIDC.

Each release includes:
- `pkgui-{version}-standalone.zip` — **recommended** — unzip, run `./start` (or `node server.js`) — opens UI with exec server
- `pkgui-{version}-bundle.html` — HTML only (use standalone zip for command execution)
- `pkgui-{version}-dist.zip` — full build for self-hosting
- `pkgui-{version}-source.tar.gz` — source tarball

---

## Scripts

```bash
npm run dev      # dev server + local execution backend
npm run build    # production build → dist/
npm test         # vitest tests
npm run server   # bundled UI + exec server (opens http://127.0.0.1:7274)
npm start        # same as npm run server
```

---

## License

MIT — see [LICENSE](LICENSE)
