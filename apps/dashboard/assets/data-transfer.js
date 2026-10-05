import { installFeatureTooltips } from './ui-tooltip.js';
import {dashboardFetch} from '../transport.js';
const tooltipLifetime = new AbortController();
const { tooltipSurface } = installFeatureTooltips(tooltipLifetime.signal);
window.addEventListener('pagehide', event => { if (!event.persisted) tooltipLifetime.abort(); });
const zh = document.documentElement.lang.startsWith('zh');
const t = (cn, en) => zh ? cn : en;
const dialog = document.querySelector('#data-dialog');
const entry = document.querySelector('#data-button');
const list = document.querySelector('#data-list');
const featureNames = { notes: t('提示词库', 'Prompt Library'), sites: t('站点收藏', 'Saved Sites'), 'model-slider': t('模型窗口', 'Model Panel') };
const status = document.querySelector('#data-status');
const exportButton = document.querySelector('#data-export');
const importButton = document.querySelector('#data-import');
const input = document.querySelector('#data-file');
let bundle = null, busy = false;
entry.textContent = t('数据迁移', 'Transfer data');
document.querySelector('#data-title').textContent = t('数据迁移', 'Transfer data');
document.querySelector('#data-policy').textContent = t('仅补充缺失项，重复跳过，冲突保留本机。', 'Add missing items. Skip duplicates. Keep local conflicts.');
document.querySelector('#data-close').setAttribute('aria-label', t('关闭', 'Close'));
exportButton.querySelector('.button-label').textContent = t('导出', 'Export');
importButton.querySelector('.button-label').textContent = t('导入', 'Import');
async function request(url, data) {
  const response = await dashboardFetch(url, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {});
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}
function setBusy(value) {
  busy = value;
  exportButton.disabled = value;
  importButton.disabled = value;
  document.querySelector('#data-close').disabled = value;
  list.setAttribute('aria-busy', String(value));
}
const featureHints = {
  'model-slider': t('仅匹配相同模型标识。本机缺少的模型保留收藏，不显示选项；导入后下次启动 Codex 生效。', 'Only exact model IDs match. Missing models stay saved but hidden. Imported favorites load next time Codex starts.'),
  notes: t('包含分类、排序与使用次数。', 'Includes categories, order and usage counts.'),
  sites: t('仅迁移公网网址，导入后归为外部网址。', 'Public URLs only; imported as external links.'),
};
let hintIndex = 0;
function row(name, detail, amount, hint = '') {
  const item = document.createElement('div'); item.className = 'data-card';
  const copy = document.createElement('div'), heading = document.createElement('div'), title = document.createElement('strong'), count = document.createElement('span');
  heading.className = 'data-card-heading';
  title.textContent = name; count.textContent = amount; count.className = 'data-count';
  heading.append(title);
  if (hint) {
    const info = document.createElement('button'), icon = document.createElement('span'), tip = document.createElement('div');
    info.type = 'button'; info.className = 'data-info'; info.setAttribute('aria-label', t(`${name} 说明`, `About ${name}`));
    icon.className = 'ui-icon info-icon'; icon.setAttribute('aria-hidden', 'true'); info.append(icon);
    tooltipSurface(tip);
    tip.id = `data-hint-${++hintIndex}`; tip.className = 'data-tooltip'; tip.setAttribute('popover', 'auto'); tip.setAttribute('role', 'tooltip'); tip.textContent = hint;
    info.setAttribute('aria-describedby', tip.id); info.setAttribute('aria-expanded', 'false');
    info.addEventListener('click', () => {
      tip.togglePopover();
      if (!tip.matches(':popover-open')) return;
      const anchor = info.getBoundingClientRect(), box = tip.getBoundingClientRect();
      tip.style.left = `${Math.max(8, Math.min(anchor.left + anchor.width / 2 - box.width / 2, innerWidth - box.width - 8))}px`;
      tip.style.top = `${anchor.top - box.height - 2 >= 8 ? anchor.top - box.height - 2 : anchor.bottom + 2}px`;
    });
    tip.addEventListener('toggle', () => info.setAttribute('aria-expanded', String(tip.matches(':popover-open'))));
    heading.append(info, tip);
  }
  copy.append(heading);
  if (detail) { const desc = document.createElement('p'); desc.textContent = detail; copy.append(desc); }
  item.append(copy, count); list.append(item);
}
function showInventory(data) {
  list.replaceChildren();
  for (const feature of data.features.filter(item => item.portable)) {
    const detail = feature.id === 'notes' ? t(`${feature.categories} 个分类`, `${feature.categories} categories`) : '';
    const hint = feature.id === 'model-slider' && !feature.initialized
      ? t('旧收藏在新版模型窗口首次启动后收录。', 'Legacy favorites are collected when the updated slider first starts.') + ' ' + featureHints[feature.id]
      : featureHints[feature.id];
    row(featureNames[feature.id] || feature.id, detail, t(`${feature.count} 项`, `${feature.count} items`), hint);
  }
}
function showPreview(data) {
  list.replaceChildren();
  for (const feature of data.features) row(featureNames[feature.id] || feature.id, t(`${feature.duplicate} 项重复 · ${feature.conflict} 项冲突，保留本机${feature.categoriesAdded ? ` · 新增 ${feature.categoriesAdded} 个分类` : ''}`, `${feature.duplicate} duplicates · ${feature.conflict} conflicts kept locally${feature.categoriesAdded ? ` · ${feature.categoriesAdded} new categories` : ''}`), t(`新增 ${feature.added} 项`, `${feature.added} new`), featureHints[feature.id]);
  if (!data.features.length) row(t('空文件', 'Empty file'), t('没有可导入的数据', 'No data to import'), '0');
}
entry.addEventListener('click', async () => {
  if (busy) return;
  bundle = null; input.value = ''; importButton.querySelector('.button-label').textContent = t('导入', 'Import');
  status.textContent = t('正在读取本机数据…', 'Reading local data…');
  list.replaceChildren(); dialog.showModal(); setBusy(true);
  try { showInventory(await request('/api/data')); status.textContent = ''; }
  catch { status.textContent = t('无法读取数据。请关闭后重试。', 'Could not read data. Close and try again.'); }
  finally { setBusy(false); }
});
document.querySelector('#data-close').addEventListener('click', () => { if (!busy) dialog.close(); });
dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
exportButton.addEventListener('click', async () => {
  setBusy(true); status.textContent = t('正在导出…', 'Exporting…');
  try {
    const data = await request('/api/data/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `minecodex-${new Intl.DateTimeFormat('sv-SE').format(new Date())}.mcx.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = t('已导出', 'Exported');
  } catch { status.textContent = t('导出失败，请重试。文件最多支持 16 MB。', 'Export failed. Try again. Files are limited to 16 MB.'); }
  finally { setBusy(false); }
});
input.addEventListener('change', async () => {
  const file = input.files[0]; if (!file) return;
  bundle = null; setBusy(true); importButton.querySelector('.button-label').textContent = t('导入', 'Import');
  try {
    if (file.size > 16 * 1024 * 1024) throw new Error('size');
    const data = JSON.parse(await file.text());
    const preview = await request('/api/data/preview', data);
    bundle = data; showPreview(preview);
    status.textContent = file.name;
    importButton.querySelector('.button-label').textContent = t('确认导入', 'Confirm import');
  } catch { status.textContent = t('文件无效或超过 16 MB', 'Invalid file or larger than 16 MB'); }
  finally { input.value = ''; setBusy(false); }
});
importButton.addEventListener('click', async () => {
  if (!bundle) { input.click(); return; }
  setBusy(true); status.textContent = t('正在导入…', 'Importing…');
  try {
    const result = await request('/api/data/import', bundle);
    list.replaceChildren();
    for (const feature of result.features) row(featureNames[feature.id] || feature.id, feature.status === 'failed' ? t('可重试', 'Retry available') : t(`跳过 ${feature.duplicate} 项重复 · 保留 ${feature.conflict} 项冲突${feature.categoriesAdded ? ` · 新增 ${feature.categoriesAdded} 个分类` : ''}`, `${feature.duplicate} duplicates skipped · ${feature.conflict} conflicts kept${feature.categoriesAdded ? ` · ${feature.categoriesAdded} new categories` : ''}`), feature.status === 'failed' ? t('失败', 'Failed') : t(`新增 ${feature.added} 项`, `${feature.added} added`), featureHints[feature.id]);
    status.textContent = result.complete ? t('导入完成', 'Import complete') : t('部分失败，请重试', 'Partially imported. Retry.');
    if (result.complete) bundle = null;
    importButton.querySelector('.button-label').textContent = result.complete ? t('导入', 'Import') : t('重试导入', 'Retry import');
  } catch { status.textContent = t('未能确认结果，请重试', 'Could not confirm the result. Retry.'); }
  finally { setBusy(false); }
});
