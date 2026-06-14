/**
 * pkgui — Main Entry Point
 * Wires sidebar, toolbar, terminal, and events together
 */

import './style.css'
import { PkguiTerminal } from './terminal.js'
import {
  PACKAGE_MANAGERS,
  OS_FAMILIES,
  OS_DEFAULTS,
  detectOS,
  getManagersForOS,
  getManagerById,
} from './managers.js'

// Expose managers to terminal engine (avoids circular imports)
window.__pkgui_managers = {
  PACKAGE_MANAGERS,
  OS_FAMILIES,
  OS_DEFAULTS,
  detectOS,
  getManagersForOS,
  getManagerById,
}

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  currentManager: null,
  currentOS: null,
  activeTab: 'all',
  searchQuery: '',
  lastCmd: '',
  sidebarOpen: true,
  theme: localStorage.getItem('pkgui-theme') || 'dark',
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id)
const el = {
  app: $('app'),
  sidebar: $('sidebar'),
  managerList: $('manager-list'),
  managerSearch: $('manager-search'),
  osTabs: $('os-tabs'),
  detectedOs: $('detected-os'),
  osIcon: $('os-icon'),
  osName: $('os-name'),
  btnDetect: $('btn-detect'),
  btnSidebarToggle: $('btn-sidebar-toggle'),
  currentManagerName: $('current-manager-name'),
  quickActions: $('quick-actions'),
  pkgInput: $('pkg-input'),
  btnClear: $('btn-clear'),
  btnCopyLast: $('btn-copy-last'),
  outputPanel: $('output-panel'),
  outputCmd: $('output-cmd'),
  btnCopyCmd: $('btn-copy-cmd'),
  btnCloseOutput: $('btn-close-output'),
  compareModal: $('compare-modal'),
  comparePkgName: $('compare-pkg-name'),
  compareBody: $('compare-body'),
  btnCloseCompare: $('btn-close-compare'),
  versionTag: $('version-tag'),
}

const OS_META = {
  linux:   { icon: '🐧', label: 'Linux' },
  macos:   { icon: '🍎', label: 'macOS' },
  windows: { icon: '🪟', label: 'Windows' },
  bsd:     { icon: '😈', label: 'BSD' },
  unix:    { icon: '🖥️', label: 'Unix' },
  cross:   { icon: '🌐', label: 'Cross-platform' },
  lang:    { icon: '🔤', label: 'Language' },
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  // Guard: verify all expected DOM elements are present
  const missing = Object.entries(el).filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) {
    console.warn(`[pkgui] Missing DOM elements: ${missing.join(', ')}. Check index.html for matching ids.`)
  }

  // Apply saved theme
  applyTheme(state.theme)
  el.versionTag.textContent = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '1.0.0'

  // Detect OS
  state.currentOS = detectOS()
  updateOSBanner(state.currentOS)

  // Render sidebar
  renderManagerList()

  // Init terminal
  const term = new PkguiTerminal($('terminal'), {
    theme: state.theme,
    onCommand: (cmd) => { state.lastCmd = cmd },
  })
  window.__pkgui_term = term

  // Trigger OS detect in terminal after short delay
  setTimeout(() => {
    term.writeCommand('detect')
  }, 600)

  // Wire events
  wireEvents(term)
}

// ─── OS Banner ────────────────────────────────────────────────────────────────
function updateOSBanner(os) {
  const meta = OS_META[os] || { icon: '🖥️', label: os }
  el.osIcon.textContent = meta.icon
  el.osName.textContent = meta.label
}

// ─── Manager List Rendering ──────────────────────────────────────────────────
function renderManagerList() {
  const { activeTab, searchQuery, currentManager } = state
  const query = searchQuery.toLowerCase()

  let managers = PACKAGE_MANAGERS.filter((m) => {
    const matchesTab =
      activeTab === 'all' ||
      m.os.includes(activeTab) ||
      // Lang tab: managers whose primary OS is 'cross' (language-level tools like pip, npm, cargo…)
      // System-level cross-platform tools (nix, guix, pkgsrc) have linux/bsd as their primary OS
      (activeTab === 'lang' && m.os[0] === 'cross')
    const matchesSearch =
      !query ||
      m.id.includes(query) ||
      m.name.toLowerCase().includes(query) ||
      m.fullName.toLowerCase().includes(query) ||
      m.distros.some((d) => d.toLowerCase().includes(query)) ||
      m.os.some((o) => o.includes(query))
    return matchesTab && matchesSearch
  })

  // Group by primary OS
  const groups = {}
  managers.forEach((m) => {
    const key = m.os[0]
    if (!groups[key]) groups[key] = []
    groups[key].push(m)
  })

  const html = Object.entries(groups)
    .map(([os, mgrs]) => {
      const meta = OS_META[os] || { icon: '📦', label: os }
      const items = mgrs
        .map(
          (m, i) => `
        <div class="manager-item${currentManager?.id === m.id ? ' active' : ''}"
             data-id="${m.id}"
             style="animation-delay:${i * 18}ms"
             title="${m.fullName} — ${m.distros.join(', ')}">
          <span class="manager-item-icon">${m.icon}</span>
          <div class="manager-item-info">
            <div class="manager-item-name">${m.name}</div>
            <div class="manager-item-desc">${m.distros[0]}${m.distros.length > 1 ? ` +${m.distros.length - 1}` : ''}</div>
          </div>
          <span class="manager-item-badge">${m.id}</span>
        </div>`
        )
        .join('')

      return `
        <div class="manager-group">
          <div class="manager-group-label">${meta.icon} ${OS_FAMILIES[os] || os}</div>
          ${items}
        </div>`
    })
    .join('')

  el.managerList.innerHTML = html || `<div class="manager-list loading">No managers found</div>`

  // Attach click handlers
  el.managerList.querySelectorAll('.manager-item').forEach((item) => {
    item.addEventListener('click', () => {
      const id = item.dataset.id
      selectManager(id)
    })
  })
}

// ─── Select Manager ───────────────────────────────────────────────────────────
function selectManager(id) {
  const manager = getManagerById(id)
  if (!manager) return

  state.currentManager = manager
  el.currentManagerName.textContent = `${manager.icon} ${manager.name}`

  // Update sidebar
  renderManagerList()

  // Update terminal
  window.__pkgui_term?.setManager(manager)

  // Enable quick actions
  el.quickActions.querySelectorAll('.qa-btn').forEach((btn) => {
    const action = btn.dataset.action
    btn.classList.toggle('active', false)
    btn.style.opacity = manager.commands[action] ? '1' : '0.35'
    btn.disabled = !manager.commands[action]
  })
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  state.theme = theme
  document.documentElement.dataset.theme = theme
  localStorage.setItem('pkgui-theme', theme)

  // Update theme dot active state
  document.querySelectorAll('.theme-dot').forEach((dot) => {
    dot.classList.toggle('active', dot.dataset.theme === theme)
  })
}

// ─── Compare Modal ────────────────────────────────────────────────────────────
function openCompareModal(pkg) {
  if (!pkg) return
  el.comparePkgName.textContent = pkg

  const managers = PACKAGE_MANAGERS.filter((m) => m.commands.install)
  el.compareBody.innerHTML = managers
    .map((m) => {
      const cmd = m.commands.install(pkg)
      if (!cmd || cmd.startsWith('# Add to')) return ''
      return `
        <div class="compare-item" data-cmd="${encodeURIComponent(cmd)}">
          <span class="compare-item-icon">${m.icon}</span>
          <div class="compare-item-info">
            <div class="compare-item-name">${m.name} <span style="opacity:.5;font-weight:400">${m.fullName}</span></div>
            <div class="compare-item-cmd">${cmd}</div>
          </div>
          <span class="compare-item-copy" title="Copy">⎘</span>
        </div>`
    })
    .join('')

  el.compareModal.classList.remove('hidden')

  el.compareBody.querySelectorAll('.compare-item').forEach((item) => {
    item.addEventListener('click', () => {
      const cmd = decodeURIComponent(item.dataset.cmd)
      copyToClipboard(cmd)
      item.querySelector('.compare-item-copy').textContent = '✓'
      setTimeout(() => {
        item.querySelector('.compare-item-copy').textContent = '⎘'
      }, 1500)
    })
  })
}

function closeCompareModal() {
  el.compareModal.classList.add('hidden')
}

// ─── Clipboard ────────────────────────────────────────────────────────────────
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

// ─── Quick Action Handler ────────────────────────────────────────────────────
function handleQuickAction(action) {
  const term = window.__pkgui_term
  if (!term) return

  const pkg = el.pkgInput.value.trim()

  if (['install', 'remove', 'search', 'info'].includes(action) && !pkg) {
    el.pkgInput.focus()
    el.pkgInput.classList.add('shake')
    setTimeout(() => el.pkgInput.classList.remove('shake'), 500)
    return
  }

  const cmd = action === 'list' ? 'listpkgs' : `${action}${pkg ? ' ' + pkg : ''}`
  term.writeCommand(cmd)
}

// ─── Wire Events ─────────────────────────────────────────────────────────────
function wireEvents(term) {
  // Sidebar toggle
  el.btnSidebarToggle.addEventListener('click', () => {
    state.sidebarOpen = !state.sidebarOpen
    el.sidebar.classList.toggle('collapsed', !state.sidebarOpen)
  })

  // OS detection re-run
  el.btnDetect.addEventListener('click', () => {
    state.currentOS = detectOS()
    updateOSBanner(state.currentOS)
    term.writeCommand('detect')
  })

  // Manager search
  el.managerSearch.addEventListener('input', (e) => {
    state.searchQuery = e.target.value
    renderManagerList()
  })

  // OS filter tabs
  el.osTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.os-tab')
    if (!tab) return
    state.activeTab = tab.dataset.os
    document.querySelectorAll('.os-tab').forEach((t) => t.classList.remove('active'))
    tab.classList.add('active')
    renderManagerList()
  })

  // Quick action buttons
  el.quickActions.addEventListener('click', (e) => {
    const btn = e.target.closest('.qa-btn')
    if (!btn || btn.disabled) return
    handleQuickAction(btn.dataset.action)
  })

  // Package input — Enter key runs search
  el.pkgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const action = state.currentManager ? 'install' : 'search'
      handleQuickAction(action)
    }
    // Ctrl+K opens compare
    if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      openCompareModal(el.pkgInput.value.trim() || 'curl')
    }
  })

  // Clear terminal
  el.btnClear.addEventListener('click', () => term.clear())

  // Copy last command
  el.btnCopyLast.addEventListener('click', async () => {
    if (state.lastCmd) {
      await copyToClipboard(state.lastCmd)
      el.btnCopyLast.textContent = '✓'
      setTimeout(() => { el.btnCopyLast.textContent = '⎘' }, 1500)
    }
  })

  // Output panel
  el.btnCloseOutput.addEventListener('click', () => el.outputPanel.classList.add('hidden'))
  el.btnCopyCmd.addEventListener('click', async () => {
    await copyToClipboard(el.outputCmd.textContent)
    el.btnCopyCmd.textContent = 'Copied!'
    setTimeout(() => { el.btnCopyCmd.textContent = 'Copy' }, 1500)
  })

  // Compare modal
  el.btnCloseCompare.addEventListener('click', closeCompareModal)
  el.compareModal.querySelector('.modal-backdrop').addEventListener('click', closeCompareModal)

  // Theme switcher
  document.querySelectorAll('.theme-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      const theme = dot.dataset.theme
      applyTheme(theme)
      term.writeCommand(`theme ${theme}`)
    })
  })

  // Terminal events
  window.addEventListener('pkgui:manager-changed', (e) => {
    state.currentManager = e.detail
    el.currentManagerName.textContent = `${e.detail.icon} ${e.detail.name}`
    renderManagerList()
  })

  window.addEventListener('pkgui:os-detected', (e) => {
    updateOSBanner(e.detail.os)
  })

  window.addEventListener('pkgui:command-generated', (e) => {
    const { cmd } = e.detail
    state.lastCmd = cmd
    el.outputCmd.textContent = cmd
    el.outputPanel.classList.remove('hidden')
  })

  window.addEventListener('pkgui:theme-changed', (e) => {
    applyTheme(e.detail)
  })

  // Terminal 'compare' command → open visual modal
  window.addEventListener('pkgui:compare-requested', (e) => {
    openCompareModal(e.detail)
  })

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+/ — focus search
    if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      el.managerSearch.focus()
    }
    // Escape — close modals
    if (e.key === 'Escape') {
      closeCompareModal()
    }
    // Ctrl+K — compare
    if (e.key === 'k' && (e.ctrlKey || e.metaKey) && document.activeElement !== el.pkgInput) {
      e.preventDefault()
      openCompareModal(el.pkgInput.value.trim() || 'curl')
    }
  })
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init)
