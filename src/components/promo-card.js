import { icon } from '../lib/icons.js'

/**
 * 推广/配置通用卡片组件
 * @param {Object} props
 * @param {string} props.id 容器 ID
 * @param {string} props.title 标题
 * @param {string} props.iconName 图标名
 * @param {string} props.desc 描述文字
 * @param {string} props.gradient 渐变背景
 * @param {Array} props.actions 按钮配置 [{id, label, icon, primary, onClick}]
 * @param {Array} props.links 链接配置 [{href, label, icon}]
 * @param {Object} props.extra 额外内容（如 input）
 */
export function renderPromoCard(props) {
  const { id, title, iconName, desc, gradient, actions = [], links = [], extra = '' } = props
  
  // 默认渐变色适配主题
  const defaultGradient = 'linear-gradient(135deg, var(--accent) 0%, #4f46e5 100%)'
  
  return `
    <div id="${id}" class="promo-card" style="margin-bottom:var(--space-lg);border-radius:12px;background:${gradient || defaultGradient};color:#fff;position:relative;overflow:hidden;box-shadow:var(--shadow-lg)">
      <div style="position:absolute;top:-50px;right:-50px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.1) 0%,transparent 70%);pointer-events:none"></div>
      <div style="position:absolute;bottom:-30px;left:20px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.05) 0%,transparent 70%);pointer-events:none"></div>
      <div style="padding:20px 24px 16px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;position:relative;z-index:1">
        <div style="flex:1;min-width:240px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:20px;display:flex">${icon(iconName, 22)}</span>
            <span style="font-weight:700;font-size:16px;letter-spacing:0.3px">${title}</span>
          </div>
          <div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.7">
            ${desc}
          </div>
          ${extra}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-end">
          ${actions.map(btn => `
            <button class="btn btn-sm" id="${btn.id}" style="background:${btn.primary ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.1)'};color:${btn.primary ? 'var(--accent)' : '#fff'};font-weight:700;border:none;padding:8px 22px;font-size:13px;white-space:nowrap;border-radius:8px;box-shadow:${btn.primary ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'};cursor:pointer;transition:all 0.2s">
              ${btn.icon ? icon(btn.icon, 14) + ' ' : ''}${btn.label}
            </button>
          `).join('')}
          <div style="display:flex;gap:14px;font-size:11px">
            ${links.map(link => `
              <a href="${link.href}" target="_blank" style="color:rgba(255,255,255,0.9);text-decoration:none;display:flex;align-items:center;gap:4px;opacity:0.8;transition:opacity 0.2s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8">
                ${link.icon ? icon(link.icon, 12) : ''}${link.label}
              </a>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `
}
