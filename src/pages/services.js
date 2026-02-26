/**
 * 服务管理页面
 * 服务启停 + 更新检测 + 配置备份管理
 */
import { api } from '../lib/tauri-api.js'
import { toast } from '../components/toast.js'

let _delegated = false

export async function render() {
  const page = document.createElement('div')
  page.className = 'page'

  page.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">服务管理</h1>
      <p class="page-desc">管理 OpenClaw 服务、检查更新、配置备份</p>
    </div>
    <div id="version-bar"></div>
    <div id="services-list">加载中...</div>
    <div class="config-section" id="backup-section">
      <div class="config-section-title">配置备份</div>
      <div id="backup-actions" style="margin-bottom:var(--space-md)">
        <button class="btn btn-primary btn-sm" data-action="create-backup">创建备份</button>
      </div>
      <div id="backup-list">加载中...</div>
    </div>
  `

  bindEvents(page)
  loadAll(page)
  return page
}

async function loadAll(page) {
  await Promise.all([
    loadVersion(page),
    loadServices(page),
    loadBackups(page),
  ])
}

// ===== 版本检测 =====

async function loadVersion(page) {
  const bar = page.querySelector('#version-bar')
  try {
    const info = await api.getVersionInfo()
    const ver = info.current || '未知'
    bar.innerHTML = `
      <div class="stat-cards" style="margin-bottom:var(--space-lg)">
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">当前版本</span>
          </div>
          <div class="stat-card-value">${ver}</div>
          <div class="stat-card-meta">${info.update_available ? '有新版本可用' : '已是最新版本'}</div>
        </div>
      </div>
    `
  } catch (e) {
    bar.innerHTML = `<div class="stat-card" style="margin-bottom:var(--space-lg)"><div class="stat-card-label">版本信息加载失败</div></div>`
  }
}

// ===== 服务列表 =====

async function loadServices(page) {
  const container = page.querySelector('#services-list')
  try {
    const services = await api.getServicesStatus()
    renderServices(container, services)
  } catch (e) {
    container.innerHTML = `<div style="color:var(--error)">加载服务列表失败: ${e}</div>`
  }
}

function renderServices(container, services) {
  if (!services || !services.length) {
    container.innerHTML = '<div style="color:var(--text-tertiary)">暂无服务</div>'
    return
  }
  container.innerHTML = services.map(s => `
    <div class="service-card" data-label="${s.label}">
      <div class="service-info">
        <span class="status-dot ${s.running ? 'running' : 'stopped'}"></span>
        <div>
          <div class="service-name">${s.label}</div>
          <div class="service-desc">${s.description || ''}${s.pid ? ' (PID: ' + s.pid + ')' : ''}</div>
        </div>
      </div>
      <div class="service-actions">
        ${s.running
          ? `<button class="btn btn-secondary btn-sm" data-action="restart" data-label="${s.label}">重启</button>
             <button class="btn btn-danger btn-sm" data-action="stop" data-label="${s.label}">停止</button>`
          : `<button class="btn btn-primary btn-sm" data-action="start" data-label="${s.label}">启动</button>`
        }
      </div>
    </div>
  `).join('')
}

// ===== 备份管理 =====

async function loadBackups(page) {
  const list = page.querySelector('#backup-list')
  try {
    const backups = await api.listBackups()
    renderBackups(list, backups)
  } catch (e) {
    list.innerHTML = `<div style="color:var(--error)">加载备份列表失败: ${e}</div>`
  }
}

function renderBackups(container, backups) {
  if (!backups || !backups.length) {
    container.innerHTML = '<div style="color:var(--text-tertiary);padding:var(--space-md) 0">暂无备份</div>'
    return
  }
  container.innerHTML = backups.map(b => {
    const date = b.created_at ? new Date(b.created_at * 1000).toLocaleString('zh-CN') : '未知'
    const size = b.size ? (b.size / 1024).toFixed(1) + ' KB' : ''
    return `
      <div class="service-card" data-backup="${b.name}">
        <div class="service-info">
          <div>
            <div class="service-name">${b.name}</div>
            <div class="service-desc">${date}${size ? ' · ' + size : ''}</div>
          </div>
        </div>
        <div class="service-actions">
          <button class="btn btn-primary btn-sm" data-action="restore-backup" data-name="${b.name}">恢复</button>
          <button class="btn btn-danger btn-sm" data-action="delete-backup" data-name="${b.name}">删除</button>
        </div>
      </div>`
  }).join('')
}

// ===== 事件绑定（事件委托） =====

function bindEvents(page) {
  if (_delegated) return
  _delegated = true

  page.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]')
    if (!btn) return
    const action = btn.dataset.action
    btn.disabled = true

    try {
      switch (action) {
        case 'start':
        case 'stop':
        case 'restart':
          await handleServiceAction(action, btn.dataset.label, page)
          break
        case 'create-backup':
          await handleCreateBackup(page)
          break
        case 'restore-backup':
          await handleRestoreBackup(btn.dataset.name, page)
          break
        case 'delete-backup':
          await handleDeleteBackup(btn.dataset.name, page)
          break
      }
    } catch (e) {
      toast(e.toString(), 'error')
    } finally {
      btn.disabled = false
    }
  })
}

// ===== 服务操作 =====

const ACTION_LABELS = { start: '启动', stop: '停止', restart: '重启' }

async function handleServiceAction(action, label, page) {
  const fn = { start: api.startService, stop: api.stopService, restart: api.restartService }[action]
  await fn(label)
  toast(`${ACTION_LABELS[action]} ${label} 成功`, 'success')
  await loadServices(page)
}

// ===== 备份操作 =====

async function handleCreateBackup(page) {
  const result = await api.createBackup()
  toast(`备份已创建: ${result.name}`, 'success')
  await loadBackups(page)
}

async function handleRestoreBackup(name, page) {
  if (!confirm(`确定要恢复备份 "${name}" 吗？\n当前配置将自动备份后再恢复。`)) return
  await api.restoreBackup(name)
  toast('配置已恢复', 'success')
  await loadBackups(page)
}

async function handleDeleteBackup(name, page) {
  if (!confirm(`确定要删除备份 "${name}" 吗？此操作不可撤销。`)) return
  await api.deleteBackup(name)
  toast('备份已删除', 'success')
  await loadBackups(page)
}
