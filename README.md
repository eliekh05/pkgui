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
- **Single-file releases** — every GitHub Release ships a compiled standalone `.html` you can open with no install

---

## Quick start

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
| Push to `main` | Tests run → SPA builds → **auto-release if `package.json` version is new** |
| Pull request | Tests run |

### Creating a release

Bump the version in `package.json`, then push to `main`. CI will detect the new version, build artifacts, and publish a GitHub Release automatically.

```bash
npm version patch          # bumps 1.0.0 → 1.0.1 in package.json
git push origin main
```

Each release includes:
- `pkgui-{version}-bundle.html` — single compiled file, open in any browser
- `pkgui-{version}-dist.zip` — full build for self-hosting
- `pkgui-{version}-source.tar.gz` — source tarball

---

## Scripts

```bash
npm run dev      # dev server + local execution backend
npm run build    # production build → dist/
npm test         # vitest tests
npm run server   # execution backend only (e.g. with the standalone .html)
```

---

## License

MIT — see [LICENSE](LICENSE)
