/**
 * 初始设置页面 — openclaw 未安装时的引导
 * 自动检测环境 → 版本选择 → 一键安装 → 自动跳转
 */
import { api } from '../lib/tauri-api.js'
import { showUpgradeModal } from '../components/modal.js'
import { toast } from '../components/toast.js'
import { setUpgrading, isMacPlatform } from '../lib/app-state.js'
import { diagnoseInstallError } from '../lib/error-diagnosis.js'
import { icon, statusIcon } from '../lib/icons.js'

export async function render() {
  const page = document.createElement('div')
  page.className = 'page setup-container'

  page.innerHTML = `
    <div class="setup-card">
      <div style="margin-bottom:var(--space-xl);text-align:center">
        <img src="/images/logo-brand.png" alt="ClawPanel" style="max-width:140px;width:100%;height:auto;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.1))">
      </div>
      
      <div style="text-align:center;margin-bottom:var(--space-xl)">
        <h1 style="font-size:1.75rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:var(--space-xs);background:linear-gradient(135deg, var(--text-primary), var(--text-secondary));-webkit-background-clip:text;-webkit-text-fill-color:transparent">
          欢迎开启 AI 时代
        </h1>
        <p style="color:var(--text-tertiary);font-size:var(--font-size-sm);line-height:1.6">
          正在为您准备 OpenClaw 智能 Agent 运行环境
        </p>
      </div>

      <div id="setup-steps"></div>

      <div style="margin-top:var(--space-xl);text-align:center;display:flex;justify-content:center;gap:12px">
        <button class="btn btn-secondary btn-sm" id="btn-recheck" style="opacity:0.7">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:4px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          重新检测环境
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-goto-assistant" style="opacity:0.7">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right:4px"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          获取 AI 帮助
        </button>
      </div>
    </div>
  `

  page.querySelector('#btn-recheck').addEventListener('click', () => runDetect(page))
  page.querySelector('#btn-goto-assistant').addEventListener('click', () => { window.location.hash = '/assistant' })
  
  runDetect(page)
  return page
}

async function runDetect(page) {
  const stepsEl = page.querySelector('#setup-steps')
  stepsEl.innerHTML = `
    <div class="stat-card loading-placeholder" style="height:48px"></div>
    <div class="stat-card loading-placeholder" style="height:48px;margin-top:8px"></div>
    <div class="stat-card loading-placeholder" style="height:48px;margin-top:8px"></div>
  `
  // 并行检测 Node.js、OpenClaw CLI、配置文件
  const [nodeRes, clawRes, configRes] = await Promise.allSettled([
    api.checkNode(),
    api.getServicesStatus(),
    api.checkInstallation(),
  ])

  const node = nodeRes.status === 'fulfilled' ? nodeRes.value : { installed: false }
  const cliOk = clawRes.status === 'fulfilled'
    && clawRes.value?.length > 0
    && clawRes.value[0]?.cli_installed !== false
  let config = configRes.status === 'fulfilled' ? configRes.value : { installed: false }

  // CLI 已装但配置缺失 → 自动创建默认配置
  if (cliOk && !config.installed) {
    try {
      const initResult = await api.initOpenclawConfig()
      if (initResult?.created) {
        // 重新检测配置
        config = await api.checkInstallation()
      }
    } catch (e) {
      console.warn('[setup] 自动初始化配置失败:', e)
    }
  }

  renderSteps(page, { node, cliOk, config })
}

function stepIcon(ok) {
  const color = ok ? 'var(--success)' : 'var(--text-tertiary)'
  return `<span style="color:${color};font-weight:700;width:18px;display:inline-block">${ok ? '✓' : '✗'}</span>`
}

function renderSteps(page, { node, cliOk, config }) {
  const stepsEl = page.querySelector('#setup-steps')
  const nodeOk = node.installed
  const allOk = nodeOk && cliOk && config.installed

  let html = ''

  // 第一步：Node.js
  html += `
    <div class="config-section" style="text-align:left;animation:fadeIn 0.5s ease">
      <div class="config-section-title" style="display:flex;align-items:center;gap:6px">
        ${stepIcon(nodeOk)} Node.js 环境
      </div>
      ${nodeOk
        ? `<p style="color:var(--success);font-size:var(--font-size-sm);margin-left:24px">已就绪 (${node.version || ''})</p>`
        : `<div style="margin-left:24px">
            <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-sm)">
              OpenClaw 基于 Node.js 运行，请先安装。
            </p>
            <div style="display:flex;gap:8px;align-items:center">
              <a class="btn btn-primary btn-sm" href="https://nodejs.org/" target="_blank" rel="noopener">立即下载</a>
              <button class="btn btn-secondary btn-sm" id="btn-scan-node" style="font-size:11px">${icon('search', 12)} 自动扫描</button>
            </div>
            <div id="scan-result" style="margin-top:12px;display:none;padding:10px;background:var(--bg-tertiary);border-radius:var(--radius-sm);font-size:var(--font-size-xs)"></div>
          </div>`
      }
    </div>
  `

  // 第二步：OpenClaw & Gateway
  html += `
    <div class="config-section" style="text-align:left;${nodeOk ? '' : 'opacity:0.4;pointer-events:none'};animation:fadeIn 0.5s ease 0.1s">
      <div class="config-section-title" style="display:flex;align-items:center;gap:6px">
        ${stepIcon(cliOk)} OpenClaw 系统
      </div>
      ${cliOk
        ? `<p style="color:var(--success);font-size:var(--font-size-sm);margin-left:24px">核心服务已安装</p>`
        : renderInstallSection()
      }
    </div>
  `

  // 第三步：配置文件
  if (cliOk) {
    html += `
      <div class="config-section" style="text-align:left;animation:fadeIn 0.5s ease 0.2s">
        <div class="config-section-title" style="display:flex;align-items:center;gap:6px">
          ${stepIcon(config.installed)} 运行环境配置
        </div>
        ${config.installed
          ? `<p style="color:var(--success);font-size:var(--font-size-sm);margin-left:24px">配置已就绪</p>`
          : `<div style="margin-left:24px">
              <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-sm)">
                初次运行需要初始化配置文件。
              </p>
              <button class="btn btn-primary btn-sm" id="btn-init-config">一键初始化</button>
            </div>`
        }
      </div>
    `
  }

  // 全部就绪 → 进入面板
  if (allOk) {
    html += `
      <div style="margin-top:var(--space-lg);animation:slideUp 0.5s ease">
        <button class="btn btn-primary btn-lg" id="btn-enter" style="min-width:240px;box-shadow:0 4px 12px rgba(var(--primary-rgb), 0.3)">
          开启 AI 探索
        </button>
      </div>
    `
  }

  stepsEl.innerHTML = html
  bindEvents(page, nodeOk, { node, cliOk, config })
}

function renderInstallSection() {
  const isDesktop = !!window.__TAURI_INTERNALS__

  return `
    <div style="margin-left:24px">
      <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-md)">
        尚未检测到 OpenClaw。我们将自动为您配置核心服务与网关。
      </p>
      
      <div style="background:var(--bg-tertiary);border-radius:var(--radius-md);border:1px solid var(--border-primary);overflow:hidden">
        <button class="btn btn-primary" id="btn-install" style="width:100%;padding:14px 24px;border-radius:0;font-size:var(--font-size-base);font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          智能安装
        </button>
        
        <details style="border-top:1px solid var(--border-primary)">
          <summary style="padding:12px 16px;font-size:var(--font-size-sm);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:background 0.2s;user-select:none" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m17.9 9.9h-6m-6 0H2.1m15.12 4.24l4.24 4.24M6.34 17.66l-4.24 4.24"/></svg>
            高级选项
          </summary>
          <div style="padding:16px;background:var(--bg-secondary);border-top:1px solid var(--border-primary)">
            <div style="margin-bottom:16px">
              <label style="display:block;margin-bottom:8px;font-size:var(--font-size-sm);color:var(--text-primary);font-weight:500">安装源选择</label>
              <div style="display:flex;gap:8px">
                <label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 12px;background:var(--bg-primary);border:2px solid var(--primary);border-radius:var(--radius-sm);cursor:pointer;transition:all 0.2s">
                  <input type="radio" name="install-source" value="official" checked style="width:16px;height:16px;accent-color:var(--primary)">
                  <span style="font-size:var(--font-size-sm);color:var(--text-primary);font-weight:500">官方源</span>
                </label>
                <label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 12px;background:var(--bg-primary);border:2px solid var(--border-primary);border-radius:var(--radius-sm);cursor:pointer;transition:all 0.2s">
                  <input type="radio" name="install-source" value="chinese" style="width:16px;height:16px;accent-color:var(--primary)">
                  <span style="font-size:var(--font-size-sm);color:var(--text-secondary)">备用源</span>
                </label>
              </div>
            </div>
            <div>
              <label style="display:block;margin-bottom:8px;font-size:var(--font-size-sm);color:var(--text-primary);font-weight:500">npm 镜像源</label>
              <div style="position:relative">
                <select id="registry-select" style="width:100%;padding:10px 12px;padding-right:32px;font-size:var(--font-size-sm);background:var(--bg-primary);color:var(--text-primary);border:2px solid var(--border-primary);border-radius:var(--radius-sm);cursor:pointer;appearance:none">
                  <option value="https://registry.npmmirror.com">淘宝镜像 (推荐)</option>
                  <option value="https://registry.npmjs.org">官方源</option>
                </select>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--text-tertiary)"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
          </div>
        </details>
      </div>
      
      ${isDesktop ? `
        <div style="margin-top:var(--space-md);padding:10px 12px;background:var(--bg-tertiary);border-radius:var(--radius-sm);font-size:var(--font-size-xs);color:var(--text-tertiary);line-height:1.6;display:flex;align-items:flex-start;gap:6px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="flex-shrink:0;margin-top:1px;color:var(--info)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>将自动尝试官方源，失败时自动切换至备用源并安装网关服务。</span>
        </div>` : ''}
    </div>
  `
}

function buildSetupProblemPrompt({ node, cliOk, config }) {
  const problems = []
  if (!node.installed) problems.push('- Node.js 未安装或未检测到')
  else problems.push(`- Node.js 已安装: ${node.version || '版本未知'}`)
  if (!cliOk) problems.push('- OpenClaw CLI 未安装')
  else problems.push('- OpenClaw CLI 已安装')
  if (!config.installed) problems.push('- 配置文件不存在')
  else problems.push(`- 配置文件正常: ${config.path || ''}`)

  return `我在安装 OpenClaw 时遇到问题，以下是当前检测状态：

${problems.join('\n')}

请帮我分析问题并给出解决步骤。如果需要，请使用工具帮我检查系统环境。`
}

function bindEvents(page, nodeOk, detectState) {
  // 打开 AI 助手
  page.querySelector('#btn-goto-assistant')?.addEventListener('click', () => {
    window.location.hash = '/assistant'
  })

  // 让 AI 帮我解决（带问题上下文）
  page.querySelector('#btn-ask-ai-help')?.addEventListener('click', () => {
    if (detectState) {
      const prompt = buildSetupProblemPrompt(detectState)
      sessionStorage.setItem('assistant-auto-prompt', prompt)
    }
    window.location.hash = '/assistant'
  })

  // 进入面板
  page.querySelector('#btn-enter')?.addEventListener('click', () => {
    // 首次安装完毕，用户期待的是直接开始对话
    // 如果没有配置模型，assistant 页面内部会处理进一步的跳转
    window.location.hash = '/assistant'
  })

  // 一键初始化配置
  page.querySelector('#btn-init-config')?.addEventListener('click', async () => {
    const btn = page.querySelector('#btn-init-config')
    btn.disabled = true
    btn.textContent = '初始化中...'
    try {
      const result = await api.initOpenclawConfig()
      if (result?.created) {
        toast('配置文件已创建', 'success')
      } else {
        toast(result?.message || '配置文件已存在', 'info')
      }
      setTimeout(() => runDetect(page), 500)
    } catch (e) {
      toast('初始化失败: ' + e, 'error')
      btn.disabled = false
      btn.textContent = '一键初始化配置'
    }
  })

  // 自动扫描 Node.js
  page.querySelector('#btn-scan-node')?.addEventListener('click', async () => {
    const btn = page.querySelector('#btn-scan-node')
    const resultEl = page.querySelector('#scan-result')
    btn.disabled = true
    btn.textContent = '扫描中...'
    resultEl.style.display = 'block'
    resultEl.innerHTML = '<span style="color:var(--text-tertiary)">正在扫描常见安装路径...</span>'
    try {
      const results = await api.scanNodePaths()
      if (results.length === 0) {
        resultEl.innerHTML = '<span style="color:var(--warning)">未找到 Node.js 安装，请手动指定路径或下载安装。</span>'
      } else {
        resultEl.innerHTML = results.map(r =>
          `<div style="display:flex;align-items:center;gap:6px;margin-top:4px">
            <span style="color:var(--success)">✓</span>
            <code style="flex:1;background:var(--bg-secondary);padding:2px 6px;border-radius:3px;font-size:11px">${r.path}</code>
            <span style="font-size:11px;color:var(--text-tertiary)">${r.version}</span>
            <button class="btn btn-primary btn-sm btn-use-path" data-path="${r.path}" style="font-size:10px;padding:2px 8px">使用</button>
          </div>`
        ).join('')
        resultEl.querySelectorAll('.btn-use-path').forEach(b => {
          b.addEventListener('click', async () => {
            await api.saveCustomNodePath(b.dataset.path)
            toast('Node.js 路径已保存，正在重新检测...', 'success')
            setTimeout(() => window.location.reload(), 500)
          })
        })
      }
    } catch (e) {
      resultEl.innerHTML = `<span style="color:var(--danger)">扫描失败: ${e}</span>`
    } finally {
      btn.disabled = false
      btn.innerHTML = `${icon('search', 12)} 自动扫描`
    }
  })

  // 手动指定路径检测
  page.querySelector('#btn-check-path')?.addEventListener('click', async () => {
    const input = page.querySelector('#input-node-path')
    const resultEl = page.querySelector('#scan-result')
    const dir = input?.value?.trim()
    if (!dir) { toast('请输入 Node.js 安装目录', 'warning'); return }
    resultEl.style.display = 'block'
    resultEl.innerHTML = '<span style="color:var(--text-tertiary)">检测中...</span>'
    try {
      const result = await api.checkNodeAtPath(dir)
      if (result.installed) {
        await api.saveCustomNodePath(dir)
        resultEl.innerHTML = `<span style="color:var(--success)">✓ 找到 Node.js ${result.version}，路径已保存</span>`
        toast('Node.js 路径已保存，正在重新检测...', 'success')
        setTimeout(() => window.location.reload(), 500)
      } else {
        resultEl.innerHTML = `<span style="color:var(--warning)">该目录下未找到 node 可执行文件，请确认路径正确。</span>`
      }
    } catch (e) {
      resultEl.innerHTML = `<span style="color:var(--danger)">检测失败: ${e}</span>`
    }
  })

  // 一键安装
  const installBtn = page.querySelector('#btn-install')
  if (!installBtn || !nodeOk) return

  installBtn.addEventListener('click', async () => {
    // 检查是否有手动选定的源，如果没有则使用智能模式
    const manualSource = page.querySelector('input[name="install-source"]:checked')?.value
    const manualRegistry = page.querySelector('#registry-select')?.value
    
    const modal = showUpgradeModal('正在安装 OpenClaw')
    let unlistenLog, unlistenProgress

    setUpgrading(true)
    
    // 内部执行安装的辅助函数
    const runInstall = async (source, registry) => {
      if (registry) {
        modal.appendLog(`设置 npm 镜像源: ${registry}`)
        try { await api.setNpmRegistry(registry) } catch {}
      }
      modal.appendLog(`正在尝试从 ${source === 'official' ? '官方源' : '备用源'} 安装...`)
      return await api.upgradeOpenclaw(source)
    }

    try {
      if (window.__TAURI_INTERNALS__) {
        try {
          const { listen } = await import('@tauri-apps/api/event')
          unlistenLog = await listen('upgrade-log', (e) => modal.appendLog(e.payload))
          unlistenProgress = await listen('upgrade-progress', (e) => modal.setProgress(e.payload))
        } catch { /* Web 模式无 Tauri event */ }
      }

      let successMsg = ''
      
      // 1. 尝试安装 OpenClaw
      try {
        // 如果用户手动指定了源，直接用手动源；否则先试官方源
        const initialSource = manualSource || 'official'
        const initialRegistry = manualRegistry || (initialSource === 'official' ? 'https://registry.npmjs.org' : 'https://registry.npmmirror.com')
        successMsg = await runInstall(initialSource, initialRegistry)
      } catch (e) {
        // 如果是智能模式且官方源失败，自动切备用源
        if (!manualSource) {
          modal.appendLog('⚠️ 官方源安装失败，正在自动切换至备用源重试...')
          modal.setProgress(10) // 重置部分进度
          successMsg = await runInstall('chinese', 'https://registry.npmmirror.com')
        } else {
          throw e // 手动模式失败直接抛出
        }
      }

      modal.setDone(successMsg)

      // 2. 自动安装 Gateway 服务
      modal.appendLog('正在安装 Gateway 服务...')
      try {
        await api.installGateway()
        modal.appendHtmlLog(`${statusIcon('ok', 14)} Gateway 服务已就绪`)
      } catch (e) {
        modal.appendHtmlLog(`${statusIcon('warn', 14)} Gateway 自动安装失败，建议稍后在设置中手动安装`)
      }

      // 3. 自动配置优化
      try {
        const config = await api.readOpenclawConfig()
        if (config) {
          let patched = false
          if (!config.gateway) config.gateway = {}
          if (!config.gateway.mode) { config.gateway.mode = 'local'; patched = true }
          if (!config.tools) config.tools = { profile: 'full', sessions: { visibility: 'all' } }; patched = true
          if (patched) {
            await api.writeOpenclawConfig(config)
            modal.appendHtmlLog(`${statusIcon('ok', 14)} 已自动优化运行配置`)
          }
        }
      } catch {}

      toast('安装成功', 'success')
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      const errStr = String(e)
      modal.appendLog(errStr)
      await new Promise(r => setTimeout(r, 150))
      const fullLog = modal.getLogText() + '\n' + errStr
      const diagnosis = diagnoseInstallError(fullLog)
      modal.setError(diagnosis.title)
      
      if (diagnosis.hint) modal.appendHtmlLog(`${statusIcon('info', 14)} ${diagnosis.hint}`)
      
      // 自动打开 AI 助手帮助解决
      if (window.__openAIDrawerWithError) {
        window.__openAIDrawerWithError({
          title: diagnosis.title,
          error: fullLog,
          scene: '智能安装失败',
          hint: '建议尝试手动指定备用源安装，或让 AI 助手协助诊断网络环境。',
        })
      }
    } finally {
      setUpgrading(false)
      unlistenLog?.()
      unlistenProgress?.()
    }
  })
}

