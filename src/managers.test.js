/**
 * pkgui — Tests
 * Run with: npm test (vitest)
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import {
  PACKAGE_MANAGERS,
  getManagerById,
  getManagersForOS,
  OS_DEFAULTS,
} from './managers.js'

// Mock browser globals for OS detection
beforeAll(() => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', platform: 'Linux x86_64' },
    writable: true,
    configurable: true,
  })
})

describe('PACKAGE_MANAGERS registry', () => {
  it('has at least 30 managers', () => {
    expect(PACKAGE_MANAGERS.length).toBeGreaterThanOrEqual(30)
  })

  it('every manager has required fields', () => {
    for (const m of PACKAGE_MANAGERS) {
      expect(m.id, `${m.id} missing id`).toBeTruthy()
      expect(m.name, `${m.id} missing name`).toBeTruthy()
      expect(m.fullName, `${m.id} missing fullName`).toBeTruthy()
      expect(Array.isArray(m.os), `${m.id} os must be array`).toBe(true)
      expect(m.os.length, `${m.id} os must not be empty`).toBeGreaterThan(0)
      expect(Array.isArray(m.distros), `${m.id} distros must be array`).toBe(true)
      expect(m.commands, `${m.id} missing commands`).toBeTruthy()
      expect(m.homepage, `${m.id} missing homepage`).toBeTruthy()
    }
  })

  it('all manager ids are unique', () => {
    const ids = PACKAGE_MANAGERS.map((m) => m.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('every icon is a non-empty string', () => {
    for (const m of PACKAGE_MANAGERS) {
      expect(typeof m.icon).toBe('string')
      expect(m.icon.length).toBeGreaterThan(0)
    }
  })
})

describe('getManagerById', () => {
  it('returns apt by id', () => {
    const m = getManagerById('apt')
    expect(m).toBeTruthy()
    expect(m.name).toBe('APT')
  })

  it('returns undefined for unknown id', () => {
    expect(getManagerById('nonexistent')).toBeUndefined()
  })

  it('finds brew', () => {
    const m = getManagerById('brew')
    expect(m.name).toBe('Homebrew')
  })
})

describe('getManagersForOS', () => {
  it('returns linux managers including apt, dnf, pacman, apk', () => {
    const managers = getManagersForOS('linux')
    const ids = managers.map((m) => m.id)
    expect(ids).toContain('apt')
    expect(ids).toContain('dnf')
    expect(ids).toContain('pacman')
    expect(ids).toContain('apk')
  })

  it('returns macOS managers including brew and macports', () => {
    const managers = getManagersForOS('macos')
    const ids = managers.map((m) => m.id)
    expect(ids).toContain('brew')
    expect(ids).toContain('macports')
  })

  it('returns windows managers including winget and choco', () => {
    const managers = getManagersForOS('windows')
    const ids = managers.map((m) => m.id)
    expect(ids).toContain('winget')
    expect(ids).toContain('choco')
  })

  it('cross-platform managers appear in all OS lists', () => {
    const linuxIds = getManagersForOS('linux').map((m) => m.id)
    const macIds = getManagersForOS('macos').map((m) => m.id)
    expect(linuxIds).toContain('pip')
    expect(macIds).toContain('pip')
    expect(linuxIds).toContain('npm')
    expect(macIds).toContain('npm')
  })
})

describe('Command generation', () => {
  it('apt install generates correct command', () => {
    const apt = getManagerById('apt')
    expect(apt.commands.install('curl')).toBe('sudo apt install curl')
    expect(apt.commands.remove('curl')).toBe('sudo apt remove curl')
    expect(apt.commands.update()).toBe('sudo apt update')
  })

  it('brew install generates correct command', () => {
    const brew = getManagerById('brew')
    expect(brew.commands.install('wget')).toBe('brew install wget')
    expect(brew.commands.clean()).toBe('brew cleanup')
  })

  it('pacman install generates correct command', () => {
    const pacman = getManagerById('pacman')
    expect(pacman.commands.install('neovim')).toBe('sudo pacman -S neovim')
    expect(pacman.commands.upgrade()).toBe('sudo pacman -Syu')
  })

  it('pip generates correct command', () => {
    const pip = getManagerById('pip')
    expect(pip.commands.install('requests')).toBe('pip install requests')
  })

  it('cargo install generates correct command', () => {
    const cargo = getManagerById('cargo')
    expect(cargo.commands.install('ripgrep')).toBe('cargo install ripgrep')
  })

  it('winget generates correct command', () => {
    const winget = getManagerById('winget')
    expect(winget.commands.install('Git.Git')).toBe('winget install Git.Git')
    expect(winget.commands.upgrade()).toBe('winget upgrade --all')
  })

  it('nix install generates correct command', () => {
    const nix = getManagerById('nix')
    expect(nix.commands.install('hello')).toBe('nix-env -iA nixpkgs.hello')
  })

  it('flatpak install uses flathub', () => {
    const flatpak = getManagerById('flatpak')
    expect(flatpak.commands.install('org.gimp.GIMP')).toBe('flatpak install flathub org.gimp.GIMP')
  })

  it('snap install generates correct command', () => {
    const snap = getManagerById('snap')
    expect(snap.commands.install('code')).toBe('sudo snap install code')
  })

  it('dnf generates correct commands', () => {
    const dnf = getManagerById('dnf')
    expect(dnf.commands.install('vim')).toBe('sudo dnf install vim')
    expect(dnf.commands.clean()).toContain('dnf')
  })

  it('apk generates correct commands', () => {
    const apk = getManagerById('apk')
    expect(apk.commands.install('bash')).toBe('apk add bash')
    expect(apk.commands.update()).toBe('apk update')
  })

  it('xbps generates correct commands', () => {
    const xbps = getManagerById('xbps')
    expect(xbps.commands.install('fish')).toBe('sudo xbps-install -S fish')
  })

  it('guix generates correct commands', () => {
    const guix = getManagerById('guix')
    expect(guix.commands.install('emacs')).toBe('guix install emacs')
    expect(guix.commands.clean()).toBe('guix gc')
  })

  it('choco generates correct commands', () => {
    const choco = getManagerById('choco')
    expect(choco.commands.install('7zip')).toBe('choco install 7zip -y')
  })

  it('scoop generates correct commands', () => {
    const scoop = getManagerById('scoop')
    expect(scoop.commands.install('git')).toBe('scoop install git')
    expect(scoop.commands.upgrade()).toBe('scoop update *')
  })
})

describe('OS_DEFAULTS', () => {
  it('has defaults for linux, macos, windows, bsd', () => {
    expect(OS_DEFAULTS.linux).toBeTruthy()
    expect(OS_DEFAULTS.macos).toBeTruthy()
    expect(OS_DEFAULTS.windows).toBeTruthy()
    expect(OS_DEFAULTS.bsd).toBeTruthy()
  })

  it('linux defaults include apt', () => {
    expect(OS_DEFAULTS.linux).toContain('apt')
  })

  it('macos defaults include brew', () => {
    expect(OS_DEFAULTS.macos).toContain('brew')
  })

  it('all default ids resolve to real managers', () => {
    for (const [os, ids] of Object.entries(OS_DEFAULTS)) {
      for (const id of ids) {
        const m = getManagerById(id)
        expect(m, `OS_DEFAULTS.${os} contains unknown id '${id}'`).toBeTruthy()
      }
    }
  })
})
