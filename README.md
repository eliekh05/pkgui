# 📦 pkgui

> Universal Package Manager GUI — xterm.js powered terminal UI for 40+ package managers, with OS detection and command builder.

[![CI/CD](https://github.com/eliekh05/pkgui/actions/workflows/ci.yml/badge.svg)](https://github.com/eliekh05/pkgui/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

-----

## Features

- **xterm.js terminal** — full interactive terminal in the browser
- **OS detection** — detects Linux, macOS, Windows, BSD and recommends relevant managers
- **40+ package managers** — apt, dnf, pacman, brew, winget, nix, guix, flatpak, snap, pip, npm, cargo, and many more
- **Command builder** — select a manager, type a package, get the exact command to copy
- **Compare view** — see install commands for the same package across every manager (`Ctrl+K`)
- **4 themes** — Dark, Light, Dracula, Nord
- **Local execution** — optional `server.js` runs commands for real on your machine

-----

## Quick start

```bash
git clone https://github.com/eliekh05/pkgui
cd pkgui
npm install
npm run dev        # → http://localhost:5173
```

To also run real commands (not just generate them):

```bash
node server.js     # starts exec server on localhost:7274
npm run dev        # in another terminal
```

-----

## Package managers

### Linux

`apt` · `dpkg` · `dnf` · `yum` · `rpm` · `zypper` · `pacman` · `yay` · `apk` · `xbps` · `portage` · `slackpkg` · `equo` · `flatpak` · `snap` · `appimage`

### macOS

`brew` · `macports` · `mas`

### Windows

`winget` · `choco` · `scoop`

### BSD

`pkg` (FreeBSD) · `pkgsrc` (NetBSD) · `pkg_add` (OpenBSD)

### Cross-platform / Nix

`nix` · `nixos-rebuild` · `guix`

### Language

`pip` · `npm` · `yarn` · `cargo` · `gem` · `composer` · `go` · `nuget` · `conda` · `maven`

-----

## Terminal commands

```
detect              Detect OS and suggest managers
list [os]           List all managers (filter: linux / macos / windows / bsd)
use <manager>       Select active package manager
install <pkg>       Generate install command
remove <pkg>        Generate remove command
update              Generate index update command
upgrade             Generate upgrade-all command
search <query>      Generate search command
info <pkg>          Generate info command
listpkgs            Generate list-installed command
clean               Generate cleanup command
compare <pkg>       Compare install command across all managers
theme <name>        Switch theme: dark / light / dracula / nord
clear               Clear terminal
version             Show version
```

**Keyboard shortcuts:** `↑↓` history · `Ctrl+C` cancel · `Ctrl+L` clear · `Ctrl+K` compare modal · `Ctrl+/` focus search

-----

## Adding a package manager

Open `src/managers.js` and add an entry to `PACKAGE_MANAGERS`:

```js
{
  id: 'mypkg',
  name: 'MyPkg',
  fullName: 'My Package Manager',
  os: ['linux'],          // linux | macos | windows | bsd | cross
  distros: ['MyDistro'],
  icon: '📦',
  color: '#ff0000',
  detectCmd: 'which mypkg',
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

Then add a test in `src/managers.test.js` and open a PR.

-----

## Scripts

```bash
npm run dev          # development server
npm run build        # production build → dist/
npm test             # run vitest tests
node server.js       # local command execution server
```

-----

## CI/CD

- **Push to `main`** → test → build → deploy to Cloudflare Pages (preview)
- **Tag `v*.*.*`** → test → build → single-file bundle → GitHub Release → deploy production

```bash
# Create a release
git tag v1.2.0
git push origin v1.2.0
```

-----

## License

MIT — see <LICENSE>