/**
 * pkgui Terminal Engine
 * Wraps xterm.js with command execution UI and ANSI color output
 */

import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'

// ─── ANSI helpers ────────────────────────────────────────────────────────
const C = {
  reset:        '\x1b[0m',
  bold:         '\x1b[1m',
  dim:          '\x1b[2m',
  red:          '\x1b[31m',
  green:        '\x1b[32m',
  yellow:       '\x1b[33m',
  blue:         '\x1b[34m',
  magenta:      '\x1b[35m',
  cyan:         '\x1b[36m',
  white:        '\x1b[37m',
  brightRed:    '\x1b[91m',
  brightGreen:  '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue:   '\x1b[94m',
  brightMagenta:'\x1b[95m',
  brightCyan:   '\x1b[96m',
  brightWhite:  '\x1b[97m',
}

// ─── xterm.js themes ───────────────────────────────────────────────────────
export const THEMES = {
  dark: {
    background: '#0d1117',
    foreground: '#e6edf3',
    cursor: '#58a6ff',
    cursorAccent: '#0d1117',
    selectionBackground: '#264f78',
    black: '#21262d', red: '#ff7b72', green: '#3fb950', yellow: '#d29922',
    blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#b1bac4',
    brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
    brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
  },
  light: {
    background: '#ffffff',
    foreground: '#1f2328',
    cursor: '#0969da',
    selectionBackground: '#0969da44',
    black: '#24292f', red: '#cf222e', green: '#116329', yellow: '#953800',
    blue: '#0969da', magenta: '#8250df', cyan: '#1b7c83', white: '#6e7781',
    brightBlack: '#57606a', brightRed: '#a40e26', brightGreen: '#1a7f37',
    brightYellow: '#633c01', brightBlue: '#218bff', brightMagenta: '#a475f9',
    brightCyan: '#3192aa', brightWhite: '#8c959f',
  },
  dracula: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selectionBackground: '#44475a',
    black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
    blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94',
    brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df',
    brightCyan: '#a4ffff', brightWhite: '#ffffff',
  },
  nord: {
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#d8dee9',
    selectionBackground: '#434c5e',
    black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
    blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
    brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b', brightBlue: '#81a1c1', brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb', brightWhite: '#eceff4',
  },
}

// ─── Local execution server ──────────────────────────────────────────────────
const EXEC_SERVER = 'http://127.0.0.1:7274'

// ─── Terminal class ────────────────────────────────────────────────────────
export class PkguiTerminal {
  constructor(container, opts = {}) {
    this.container = container
    this.theme = opts.theme || 'dark'
    this.history = []
    this.historyIndex = -1
    this.currentManager = null
    this.onCommand = opts.onCommand || null
    // Execution server state
    this._lastGeneratedCmd = null
    this._execAvailable    = false
    this._activeSession    = null
    this._activeEvtSource  = null
    this._init()
  }

  _init() {
    this.term = new Terminal({
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
      fontSize: 14,
      lineHeight: 1.4,
      theme: THEMES[this.theme],
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      convertEol: true,
      allowProposedApi: true,
    })

    this.fitAddon = new FitAddon()
    this.webLinksAddon = new WebLinksAddon()

    this.term.loadAddon(this.fitAddon)
    this.term.loadAddon(this.webLinksAddon)

    this.term.open(this.container)

    // Fit after a frame to let CSS settle
    requestAnimationFrame(() => {
      this.fitAddon.fit()
    })

    window.addEventListener('resize', () => this.fitAddon.fit())

    this._setupInput()
    this._printBanner()
    this._checkExecServer()   // non-blocking — updates _execAvailable
  }

  // ─── Input handling ───────────────────────────────────────────────────────
  _setupInput() {
    let inputBuffer = ''

    this.term.onKey(({ key, domEvent }) => {
      const code = domEvent.keyCode

      // ── Passthrough: forward all keys to the running process ──────────────
      if (this._activeSession) {
        if (code === 13) {                        // Enter
          this.term.write('\r\n')
          this._sendStdin('\n')
        } else if (code === 8) {                  // Backspace
          this.term.write('\b \b')
          this._sendStdin('\x7f')
        } else if (domEvent.ctrlKey && key === 'c') {
          this.term.write('^C\r\n')
          this._killSession()
        } else if (!domEvent.ctrlKey && !domEvent.altKey && !domEvent.metaKey && key.charCodeAt(0) >= 32) {
          this.term.write(key)                   // local echo
          this._sendStdin(key)
        }
        return                                    // never fall through to normal handling
      }

      if (code === 13) {                          // Enter
        const cmd = inputBuffer.trim()
        this.term.write('\r\n')
        if (cmd) {
          this.history.unshift(cmd)
          this.historyIndex = -1
          if (this.onCommand) this.onCommand(cmd)
          this._executeCommand(cmd)
        }
        inputBuffer = ''
        this._printPrompt()

      } else if (code === 8) {                    // Backspace
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1)
          this.term.write('\b \b')
        }

      } else if (code === 38) {                   // Arrow Up
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++
          this._replaceInput(inputBuffer, this.history[this.historyIndex])
          inputBuffer = this.history[this.historyIndex]
        }

      } else if (code === 40) {                   // Arrow Down
        if (this.historyIndex > -1) {
          this.historyIndex--
          const next = this.historyIndex === -1 ? '' : this.history[this.historyIndex]
          this._replaceInput(inputBuffer, next)
          inputBuffer = next
        }

      } else if (domEvent.ctrlKey && key === 'c') {
        this.term.write('^C\r\n')
        inputBuffer = ''
        this._printPrompt()

      } else if (domEvent.ctrlKey && key === 'l') {
        this.term.clear()
        this._printPrompt()

      } else if (!domEvent.ctrlKey && !domEvent.altKey && !domEvent.metaKey && key.charCodeAt(0) >= 32) {
        inputBuffer += key
        this.term.write(key)
      }
    })
  }

  _replaceInput(old, next) {
    this.term.write('\b'.repeat(old.length) + ' '.repeat(old.length) + '\b'.repeat(old.length))
    this.term.write(next)
  }

  // ─── Banner ─────────────────────────────────────────────────────────
  _printBanner() {
    const v = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '1.0.0'
    const lines = [
      '',
      `${C.brightCyan}${C.bold}  ██████╗ ██╗  ██╗ ██████╗ ██╗   ██╗██╗${C.reset}`,
      `${C.brightCyan}${C.bold}  ██╔══██╗██║ ██╔╝██╔════╝ ██║   ██║██║${C.reset}`,
      `${C.brightCyan}${C.bold}  ██████╔╝█████╔╝ ██║  ███╗██║   ██║██║${C.reset}`,
      `${C.brightCyan}${C.bold}  ██╔═══╝ ██╔═██╗ ██║   ██║██║   ██║██║${C.reset}`,
      `${C.brightCyan}${C.bold}  ██║     ██║  ██╗╚██████╔╝╚██████╔╝██║${C.reset}`,
      `${C.brightCyan}${C.bold}  ╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝${C.reset}`,
      '',
      `  ${C.brightWhite}Universal Package Manager GUI${C.reset}  ${C.dim}v${v}${C.reset}`,
      `  ${C.dim}40+ package managers · OS detection · xterm.js${C.reset}`,
      '',
      `  ${C.yellow}Type ${C.brightYellow}help${C.yellow} for commands · ${C.brightYellow}list${C.yellow} to see managers · ${C.brightYellow}detect${C.yellow} for OS info${C.reset}`,
      '',
    ]
    lines.forEach(l => this.term.writeln(l))
    this._printPrompt()
  }

  _printPrompt() {
    const mgr = this.currentManager
      ? `${C.brightMagenta}[${this.currentManager.name}]${C.reset} `
      : ''
    this.term.write(`${mgr}${C.brightGreen}pkgui${C.reset}${C.brightBlue}❯${C.reset} `)
  }

  // ─── Command dispatch ─────────────────────────────────────────────────────
  _executeCommand(raw) {
    const parts = raw.trim().split(/\s+/)
    const verb  = parts[0].toLowerCase()
    const args  = parts.slice(1)

    const dispatch = {
      help:     () => this._printHelp(),
      list:     () => this._printManagerList(args[0]),
      managers: () => this._printManagerList(args[0]),
      use:      () => this._cmdUse(args[0]),
      detect:   () => this._cmdDetect(),
      run:      () => this._cmdRun(),
      install:  () => this._cmdAction('install', args),
      i:        () => this._cmdAction('install', args),
      remove:   () => this._cmdAction('remove', args),
      rm:       () => this._cmdAction('remove', args),
      uninstall:() => this._cmdAction('remove', args),
      update:   () => this._cmdAction('update', args),
      upgrade:  () => this._cmdAction('upgrade', args),
      search:   () => this._cmdAction('search', args),
      s:        () => this._cmdAction('search', args),
      info:     () => this._cmdAction('info', args),
      listpkgs: () => this._cmdAction('list', args),
      clean:    () => this._cmdAction('clean', args),
      clear:    () => this.term.clear(),
      cls:      () => this.term.clear(),
      theme:    () => this._cmdTheme(args[0]),
      compare:  () => this._cmdCompare(args),
      version:  () => this.term.writeln(`pkgui v${typeof __VERSION__ !== 'undefined' ? __VERSION__ : '1.0.0'}`),
    }

    const fn = dispatch[verb]
    if (fn) {
      fn()
    } else {
      this.term.writeln(
        `${C.red}Unknown command: ${C.brightRed}${verb}${C.reset}  ` +
        `— type ${C.yellow}help${C.reset} for available commands`
      )
    }
  }

  // ─── Commands ─────────────────────────────────────────────────────────
  _printHelp() {
    const lines = [
      '',
      `${C.bold}${C.brightWhite}COMMANDS${C.reset}`,
      `${C.dim}────────────────────────────────────────────────${C.reset}`,
      `  ${C.brightCyan}detect${C.reset}              Detect OS and suggest package managers`,
      `  ${C.brightCyan}list ${C.dim}[os]${C.reset}         List all managers (filter: linux/macos/windows/bsd)`,
      `  ${C.brightCyan}use <manager>${C.reset}       Select active package manager`,
      '',
      `${C.bold}${C.brightWhite}PACKAGE OPERATIONS${C.reset} ${C.dim}(requires 'use' first)${C.reset}`,
      `  ${C.brightGreen}install <pkg>${C.reset}       Generate install command`,
      `  ${C.brightGreen}remove <pkg>${C.reset}        Generate remove command`,
      `  ${C.brightGreen}update${C.reset}              Generate index update command`,
      `  ${C.brightGreen}upgrade${C.reset}             Generate upgrade-all command`,
      `  ${C.brightGreen}search <query>${C.reset}      Generate search command`,
      `  ${C.brightGreen}info <pkg>${C.reset}          Generate package info command`,
      `  ${C.brightGreen}listpkgs${C.reset}            Generate list-installed command`,
      `  ${C.brightGreen}clean${C.reset}               Generate cleanup command`,
      '',
      `${C.bold}${C.brightWhite}UTILITIES${C.reset}`,
      `  ${C.yellow}compare <pkg>${C.reset}       Show install command across ALL managers`,
      `  ${C.yellow}theme <name>${C.reset}        Switch theme: dark / light / dracula / nord`,
      `  ${C.yellow}clear${C.reset}               Clear terminal (also Ctrl+L)`,
      `  ${C.yellow}version${C.reset}             Show version`,
      '',
      `${C.bold}${C.brightWhite}EXECUTION${C.reset} ${C.dim}(requires node server.js running)${C.reset}`,
      `  ${C.brightGreen}run${C.reset}                 Execute the last generated command locally`,
      `  ${C.dim}Ctrl+C cancels a running command · stdin is forwarded interactively${C.reset}`,
      '',
      `${C.dim}Keyboard: ↑↓ history · Ctrl+C cancel · Ctrl+L clear${C.reset}`,
      '',
    ]
    lines.forEach(l => this.term.writeln(l))
  }

  _printManagerList(filter) {
    const { PACKAGE_MANAGERS, OS_FAMILIES } = window.__pkgui_managers
    let managers = PACKAGE_MANAGERS
    if (filter) {
      const q = filter.toLowerCase()
      managers = managers.filter(m =>
        m.os.includes(q) || m.name.toLowerCase().includes(q) ||
        m.id.includes(q)
      )
    }

    // Group by primary OS
    const groups = {}
    managers.forEach(m => {
      const key = m.os[0]
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    })

    this.term.writeln('')
    this.term.writeln(`${C.bold}${C.brightWhite}PACKAGE MANAGERS${filter ? ` — filter: ${filter}` : ''}${C.reset}`)
    this.term.writeln(`${C.dim}${'─'.repeat(54)}${C.reset}`)

    for (const [os, mgrs] of Object.entries(groups)) {
      const label = OS_FAMILIES[os] || os
      this.term.writeln(`\r\n  ${C.bold}${C.brightYellow}${label}${C.reset}`)
      mgrs.forEach(m => {
        const active = this.currentManager?.id === m.id
          ? ` ${C.brightGreen}◀ active${C.reset}` : ''
        this.term.writeln(
          `    ${m.icon}  ${C.brightCyan}${m.id.padEnd(16)}${C.reset}${C.dim}${m.fullName}${C.reset}${active}`
        )
      })
    }

    this.term.writeln('')
    this.term.writeln(
      `  ${C.dim}${managers.length} managers shown · use ${C.reset}${C.yellow}use <id>${C.dim} to select${C.reset}`
    )
    this.term.writeln('')
  }

  _cmdUse(id) {
    if (!id) {
      this.term.writeln(`${C.red}Usage: use <manager-id>${C.reset}`)
      this.term.writeln(`${C.dim}Run ${C.yellow}list${C.dim} to see available managers${C.reset}`)
      return
    }
    const { getManagerById } = window.__pkgui_managers
    const manager = getManagerById(id)
    if (!manager) {
      this.term.writeln(`${C.red}Unknown manager: ${C.brightRed}${id}${C.reset}`)
      this.term.writeln(`${C.dim}Run ${C.yellow}list${C.dim} to see available managers${C.reset}`)
      return
    }
    this.currentManager = manager
    this.term.writeln('')
    this.term.writeln(`  ${manager.icon}  ${C.bold}${C.brightCyan}${manager.name}${C.reset}  ${C.dim}${manager.fullName}${C.reset}`)
    this.term.writeln(`  ${C.dim}Platforms: ${manager.os.join(', ')}${C.reset}`)
    this.term.writeln(`  ${C.dim}Distros:   ${manager.distros.slice(0, 4).join(', ')}${manager.distros.length > 4 ? ` +${manager.distros.length - 4} more` : ''}${C.reset}`)
    this.term.writeln(`  ${C.dim}Supports:  ${Object.keys(manager.commands).join(', ')}${C.reset}`)
    this.term.writeln(`  ${C.blue}${manager.homepage}${C.reset}`)
    this.term.writeln('')
    this.term.writeln(`  ${C.brightGreen}✓ Switched to ${manager.name}${C.reset}`)
    this.term.writeln('')
    window.dispatchEvent(new CustomEvent('pkgui:manager-changed', { detail: manager }))
  }

  _cmdDetect() {
    const { detectOS, getManagersForOS, OS_DEFAULTS } = window.__pkgui_managers
    const os = detectOS()
    const defaults = OS_DEFAULTS[os] || []
    const managers = getManagersForOS(os)

    this.term.writeln('')
    this.term.writeln(`${C.bold}${C.brightWhite}OS DETECTION${C.reset}`)
    this.term.writeln(`${C.dim}${'─'.repeat(44)}${C.reset}`)
    this.term.writeln(`  Platform:    ${C.brightCyan}${navigator.platform || '(unknown)'}${C.reset}`)
    this.term.writeln(`  Detected OS: ${C.brightGreen}${os}${C.reset}`)
    this.term.writeln('')
    this.term.writeln(`  ${C.bold}Recommended managers:${C.reset}`)
    defaults.slice(0, 6).forEach(id => {
      const m = managers.find(x => x.id === id)
      if (m) {
        this.term.writeln(
          `    ${m.icon}  ${C.brightCyan}${m.id.padEnd(14)}${C.reset}${C.dim}type: ${C.reset}${C.yellow}use ${m.id}${C.reset}`
        )
      }
    })
    this.term.writeln('')
    window.dispatchEvent(new CustomEvent('pkgui:os-detected', { detail: { os, managers } }))
  }

  _cmdAction(action, args) {
    if (!this.currentManager) {
      this.term.writeln(
        `${C.yellow}No manager selected.${C.reset} Use ${C.brightYellow}use <manager>${C.reset} first, or pick one from the sidebar.`
      )
      return
    }

    const m = this.currentManager
    const cmdFn = m.commands[action]

    if (!cmdFn) {
      this.term.writeln(`${C.yellow}⚠  ${m.name} doesn't support action: ${C.brightYellow}${action}${C.reset}`)
      this.term.writeln(`${C.dim}   Supported: ${Object.keys(m.commands).join(', ')}${C.reset}`)
      return
    }

    const pkg = args.join(' ')
    if (['install', 'remove', 'search', 'info'].includes(action) && !pkg) {
      this.term.writeln(`${C.red}Usage: ${action} <package-name>${C.reset}`)
      return
    }

    const cmd = cmdFn(pkg)
    this._displayGeneratedCommand(m, action, cmd)
  }

  _displayGeneratedCommand(manager, action, cmd) {
    const lines = cmd.split('\n')
    this.term.writeln('')
    this.term.writeln(
      `  ${manager.icon}  ${C.bold}${manager.name}${C.reset}  ${C.dim}→ ${action}${C.reset}`
    )
    this.term.writeln(`  ${C.dim}${'─'.repeat(50)}${C.reset}`)
    lines.forEach(line => {
      if (line.startsWith('#')) {
        this.term.writeln(`  ${C.dim}${line}${C.reset}`)
      } else {
        this.term.writeln(`  ${C.brightGreen}$${C.reset} ${C.brightWhite}${line}${C.reset}`)
      }
    })
    this.term.writeln('')
    // Store for 'run' command
    this._lastGeneratedCmd = cmd

    if (this._execAvailable) {
      this.term.writeln(
        `  ${C.brightGreen}↳ Type ${C.bold}run${C.reset}${C.brightGreen} and press Enter to execute locally${C.reset}`
      )
    } else {
      this.term.writeln(
        `  ${C.dim}Select text to copy · Ctrl+K to compare across all managers${C.reset}`
      )
    }
    this.term.writeln('')
    window.dispatchEvent(new CustomEvent('pkgui:command-generated', { detail: { manager: manager.id, action, cmd } }))
  }

  _cmdTheme(name) {
    if (!THEMES[name]) {
      this.term.writeln(
        `${C.red}Unknown theme.${C.reset} Options: ${Object.keys(THEMES).join(', ')}`
      )
      return
    }
    this.theme = name
    this.term.options.theme = THEMES[name]
    this.term.writeln(`${C.brightGreen}✓ Theme set to ${name}${C.reset}`)
    window.dispatchEvent(new CustomEvent('pkgui:theme-changed', { detail: name }))
  }

  _cmdCompare(args) {
    const pkg = args.join(' ')
    if (!pkg) {
      this.term.writeln(`${C.red}Usage: compare <package-name>${C.reset}`)
      return
    }
    const { PACKAGE_MANAGERS } = window.__pkgui_managers
    const managers = PACKAGE_MANAGERS.filter(m => m.commands.install)

    this.term.writeln('')
    this.term.writeln(
      `${C.bold}${C.brightWhite}INSTALL COMMANDS FOR: ${C.brightCyan}${pkg}${C.reset}`
    )
    this.term.writeln(`${C.dim}${'─'.repeat(60)}${C.reset}`)

    managers.forEach(m => {
      const cmd = m.commands.install(pkg)
      // Skip multiline/complex ones in terminal compare (show in modal)
      if (cmd.includes('\n')) return
      this.term.writeln(
        `  ${m.icon}  ${C.brightMagenta}${m.name.padEnd(14)}${C.reset} ${C.dim}${cmd}${C.reset}`
      )
    })

    this.term.writeln('')
    this.term.writeln(
      `  ${C.dim}Ctrl+K opens visual compare modal with copy buttons${C.reset}`
    )
    this.term.writeln('')

    // Open the visual modal too
    window.dispatchEvent(new CustomEvent('pkgui:compare-requested', { detail: pkg }))
  }

  // ─── Execution server integration ──────────────────────────────────────────

  async _checkExecServer() {
    // Skip exec server check in browser environment (can't reach localhost from HTTPS)
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:') {
      this._execAvailable = false
      return
    }

    try {
      const r = await fetch(`${EXEC_SERVER}/health`, {
        signal: AbortSignal.timeout(1500),
      })
      if (r.ok) {
        this._execAvailable = true
        this.term.writeln(
          `  ${C.brightGreen}✓ Exec server connected${C.reset}  ${C.dim}— type ${C.yellow}run${C.dim} after any command to execute it${C.reset}`
        )
        this.term.writeln('')
        this._printPrompt()
      }
    } catch {
      this._execAvailable = false   // server not running — silent
    }
  }

  async _cmdRun() {
    if (!this._lastGeneratedCmd) {
      this.term.writeln(
        `${C.yellow}Nothing to run.${C.reset} Generate a command first, e.g. ${C.brightYellow}install curl${C.reset}`
      )
      return
    }

    // Re-check server availability in case it was started after the app
    if (!this._execAvailable) {
      try {
        const r = await fetch(`${EXEC_SERVER}/health`, { signal: AbortSignal.timeout(1500) })
        if (r.ok) this._execAvailable = true
      } catch { /* still down */ }
    }

    if (!this._execAvailable) {
      this.term.writeln('')
      this.term.writeln(`${C.yellow}⚠  Exec server not running.${C.reset}`)
      this.term.writeln(`${C.dim}  Start it in a separate terminal:${C.reset}  ${C.brightYellow}node server.js${C.reset}`)
      this.term.writeln('')
      return
    }

    const cmd = this._lastGeneratedCmd
    this.term.writeln('')
    this.term.writeln(`  ${C.brightGreen}▶ Running:${C.reset} ${C.brightWhite}${cmd}${C.reset}`)
    this.term.writeln(`  ${C.dim}${'─'.repeat(52)}${C.reset}`)
    this.term.writeln(`  ${C.dim}Ctrl+C to cancel · stdin forwarded interactively${C.reset}`)
    this.term.writeln('')

    let resp
    try {
      resp = await fetch(`${EXEC_SERVER}/exec`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ cmd }),
      })
    } catch {
      this.term.writeln(`${C.red}✗ Could not reach exec server.${C.reset}`)
      this._printPrompt()
      return
    }

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      this.term.writeln(`${C.red}✗ ${err.error || resp.statusText}${C.reset}`)
      this._printPrompt()
      return
    }

    const { id } = await resp.json()
    this._activeSession = id

    const src = new EventSource(`${EXEC_SERVER}/exec/${id}/stream`)
    this._activeEvtSource = src

    src.addEventListener('stdout', (e) => {
      const { text } = JSON.parse(e.data)
      this.term.write(text.replace(/\n/g, '\r\n'))
    })
    src.addEventListener('stderr', (e) => {
      const { text } = JSON.parse(e.data)
      this.term.write(`${C.yellow}${text.replace(/\n/g, '\r\n')}${C.reset}`)
    })
    src.addEventListener('exit', (e) => {
      const { code } = JSON.parse(e.data)
      this.term.writeln('')
      if (code === 0) {
        this.term.writeln(`  ${C.brightGreen}✓ Completed (exit 0)${C.reset}`)
      } else {
        this.term.writeln(`  ${C.red}✗ Exited with code ${code}${C.reset}`)
      }
      this._activeSession   = null
      this._activeEvtSource = null
      src.close()
      this.term.writeln('')
      this._printPrompt()
    })
    src.addEventListener('error', () => {
      if (this._activeSession) {   // only if not already cleaned up by exit
        this.term.writeln(`\r\n  ${C.red}✗ Stream closed unexpectedly${C.reset}`)
        this._activeSession   = null
        this._activeEvtSource = null
        src.close()
        this.term.writeln('')
        this._printPrompt()
      }
    })
  }

  /** Forward a key/string to the running process stdin */
  async _sendStdin(text) {
    if (!this._activeSession) return
    try {
      await fetch(`${EXEC_SERVER}/exec/${this._activeSession}/stdin`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      })
    } catch { /* ignore — process may have exited */ }
  }

  /** Send SIGINT to the active session */
  async _killSession() {
    if (!this._activeSession) return
    const id = this._activeSession
    this._activeSession   = null
    this._activeEvtSource?.close()
    this._activeEvtSource = null
    try {
      await fetch(`${EXEC_SERVER}/exec/${id}/kill`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
    } catch { /* already gone */ }
    this.term.writeln('')
    this._printPrompt()
  }

  // ─── Public API ────────────────────────────────────────────────────────
  setManager(manager) {
    this.currentManager = manager
    this.term.writeln(
      `\r\n  ${C.brightGreen}✓ Switched to ${C.bold}${manager.name}${C.reset}\r\n`
    )
    this._printPrompt()
  }

  writeCommand(cmd) {
    // Simulate user typing + executing the command
    this.term.writeln(`\r\n${C.dim}> ${cmd}${C.reset}`)
    this._executeCommand(cmd)
    this._printPrompt()
  }

  clear() {
    this.term.clear()
    this._printPrompt()
  }

  dispose() {
    this.term.dispose()
  }

  get xterm() {
    return this.term
  }
}
