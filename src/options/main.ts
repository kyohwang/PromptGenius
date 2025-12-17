import { ExportBundle, ImportStrategy } from '../storage/models';
import { clearAll, getSettings, setSettings } from '../storage/repo';

type Locale = 'zh' | 'en';

const messages = {
  en: {
    title: 'Prompt Manager Settings',
    prefTitle: 'Preferences',
    importTitle: 'Import / Export',
    dangerTitle: 'Danger zone',
    prefLang: 'Preferred language',
    tone: 'Tone',
    quality: 'Quality bar',
    uiLanguage: 'UI language',
    placeholderLang: 'e.g., Chinese / English',
    placeholderTone: 'e.g., rigorous, friendly, concise',
    export: 'Export JSON (copy)',
    importLabel: 'Import',
    merge: 'Merge import',
    overwrite: 'Overwrite import',
    overwriteConfirm: 'Overwrite import will clear existing data. Continue?',
    clearConfirm: 'Are you sure you want to clear all data?',
    clearAll: 'Clear all data',
    save: 'Save',
    importPlaceholder: 'Paste exported data',
    statusSaved: 'Settings saved',
    statusExported: 'Export copied',
    statusMerge: 'Merge import complete',
    statusOverwrite: 'Overwrite import complete',
    statusCleared: 'Data cleared',
    statusImportError: 'Import failed',
    statusJsonError: 'Invalid JSON payload'
  },
  zh: {
    title: 'Prompt Manager 设置',
    prefTitle: '偏好设置',
    importTitle: '导入 / 导出',
    dangerTitle: '危险区',
    prefLang: '偏好语言',
    tone: '语气',
    quality: '质量标准',
    uiLanguage: '界面语言',
    placeholderLang: '例如：中文 / English',
    placeholderTone: '例如：严谨、友好、简洁',
    export: '导出 JSON（复制）',
    importLabel: '导入',
    merge: '合并导入',
    overwrite: '覆盖导入',
    overwriteConfirm: '覆盖导入会清空现有数据，确认继续？',
    clearConfirm: '确认清空所有数据？',
    clearAll: '清空全部数据',
    save: '保存',
    importPlaceholder: '粘贴导出数据',
    statusSaved: '设置已保存',
    statusExported: '已复制导出 JSON',
    statusMerge: '合并导入完成',
    statusOverwrite: '覆盖导入完成',
    statusCleared: '数据已清空',
    statusImportError: '导入失败',
    statusJsonError: 'JSON 解析失败'
  }
} as const;

type MessageKey = keyof typeof messages.en;

let currentLang: Locale = 'zh';

function t(key: MessageKey): string {
  return messages[currentLang][key] || key;
}

const app = document.getElementById('app')!;

const style = document.createElement('style');
style.textContent = `
  body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
  .wrap { max-width: 760px; margin: 24px auto; padding: 0 18px 40px; display: flex; flex-direction: column; gap: 16px; }
  h1 { margin: 0 0 6px 0; }
  .panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; box-shadow: 0 4px 16px rgba(15,23,42,0.06); }
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
  .field label { font-size: 13px; color: #475569; }
  .field input, .field textarea, .field select { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; font-size: 13px; font-family: inherit; }
  textarea { min-height: 140px; resize: vertical; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn { background: #2563eb; color: #fff; border: none; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-weight: 600; }
  .btn.secondary { background: #e2e8f0; color: #0f172a; }
  .btn.danger { background: #dc2626; color: #fff; }
  .status { font-size: 12px; color: #475569; }
`;
document.head.appendChild(style);

const wrap = document.createElement('div');
wrap.className = 'wrap';
app.appendChild(wrap);

const title = document.createElement('h1');
wrap.appendChild(title);

const status = document.createElement('div');
status.className = 'status';
wrap.appendChild(status);

const settingsPanel = document.createElement('div');
settingsPanel.className = 'panel';
const settingsHeading = document.createElement('h3');
settingsPanel.appendChild(settingsHeading);

const languageInput = document.createElement('input');
const toneInput = document.createElement('input');
const qualityInput = document.createElement('input');
const uiLangSelect = document.createElement('select');
['zh', 'en'].forEach((lng) => {
  const opt = document.createElement('option');
  opt.value = lng;
  opt.textContent = lng === 'zh' ? '简体中文' : 'English';
  uiLangSelect.appendChild(opt);
});

settingsPanel.append(
  createField('prefLang', languageInput),
  createField('tone', toneInput),
  createField('quality', qualityInput),
  createField('uiLanguage', uiLangSelect)
);

const settingsActions = document.createElement('div');
settingsActions.className = 'actions';
const saveSettingsBtn = document.createElement('button');
saveSettingsBtn.className = 'btn';
settingsActions.appendChild(saveSettingsBtn);
settingsPanel.appendChild(settingsActions);

const importExport = document.createElement('div');
importExport.className = 'panel';
const importHeading = document.createElement('h3');
importExport.appendChild(importHeading);
const exportBtn = document.createElement('button');
exportBtn.className = 'btn secondary';
importExport.appendChild(exportBtn);

const importArea = document.createElement('textarea');
importExport.appendChild(createField('importLabel', importArea));

const importActions = document.createElement('div');
importActions.className = 'actions';
const mergeBtn = document.createElement('button');
mergeBtn.className = 'btn';
const overwriteBtn = document.createElement('button');
overwriteBtn.className = 'btn danger';
importActions.append(mergeBtn, overwriteBtn);
importExport.appendChild(importActions);

const dangerPanel = document.createElement('div');
dangerPanel.className = 'panel';
const dangerHeading = document.createElement('h3');
dangerPanel.appendChild(dangerHeading);
const clearBtn = document.createElement('button');
clearBtn.className = 'btn danger';
dangerPanel.appendChild(clearBtn);

wrap.append(settingsPanel, importExport, dangerPanel);

saveSettingsBtn.onclick = async () => {
  await setSettings({
    preferredLanguage: languageInput.value,
    tone: toneInput.value,
    qualityBar: qualityInput.value,
    uiLanguage: uiLangSelect.value as Locale
  });
  setLang(uiLangSelect.value as Locale);
  setStatus(t('statusSaved'));
};

exportBtn.onclick = async () => {
  try {
    const bundle = await requestExport();
    const text = JSON.stringify(bundle, null, 2);
    await navigator.clipboard?.writeText(text);
    setStatus(t('statusExported'));
  } catch (err) {
    setStatus(String(err));
  }
};

mergeBtn.onclick = () => handleImport(importArea.value, 'merge');
overwriteBtn.onclick = () => handleImport(importArea.value, 'overwrite');

clearBtn.onclick = async () => {
  if (!confirm(t('clearConfirm'))) return;
  await clearAll();
  setStatus(t('statusCleared'));
};

function createField(labelKey: MessageKey, input: HTMLElement): HTMLElement {
  const div = document.createElement('div');
  div.className = 'field';
  const lbl = document.createElement('label');
  lbl.dataset.key = labelKey;
  div.append(lbl, input);
  return div;
}

function applyTexts(): void {
  title.textContent = t('title');
  settingsHeading.textContent = t('prefTitle');
  importHeading.textContent = t('importTitle');
  dangerHeading.textContent = t('dangerTitle');
  saveSettingsBtn.textContent = t('save');
  exportBtn.textContent = t('export');
  mergeBtn.textContent = t('merge');
  overwriteBtn.textContent = t('overwrite');
  clearBtn.textContent = t('clearAll');
  importArea.placeholder = t('importPlaceholder');
  languageInput.placeholder = t('placeholderLang');
  toneInput.placeholder = t('placeholderTone');

  document.querySelectorAll<HTMLLabelElement>('label[data-key]').forEach((lbl) => {
    const key = lbl.dataset.key as MessageKey;
    lbl.textContent = t(key);
  });
  uiLangSelect.querySelectorAll('option').forEach((opt) => {
    opt.textContent = opt.value === 'zh' ? '简体中文' : 'English';
  });
}

function setStatus(text: string): void {
  status.textContent = text;
}

async function handleImport(json: string, strategy: ImportStrategy): Promise<void> {
  try {
    await requestImport(json, strategy);
    setStatus(strategy === 'merge' ? t('statusMerge') : t('statusOverwrite'));
  } catch (err) {
    setStatus(String(err));
  }
}

async function requestExport(): Promise<ExportBundle> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'EXPORT_DATA' }, (res) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError.message);
      if (res?.ok) return resolve(res.bundle as ExportBundle);
      reject(res?.error || t('statusImportError'));
    });
  });
}

async function requestImport(json: string, strategy: ImportStrategy): Promise<void> {
  return new Promise((resolve, reject) => {
    let bundle: ExportBundle;
    try {
      bundle = JSON.parse(json);
    } catch (err) {
      reject(t('statusJsonError'));
      return;
    }
    chrome.runtime.sendMessage({ type: 'IMPORT_DATA', payload: { bundle, strategy } }, (res) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError.message);
      if (res?.ok) return resolve();
      reject(res?.error || t('statusImportError'));
    });
  });
}

async function hydrate(): Promise<void> {
  const settings = await getSettings();
  languageInput.value = settings.preferredLanguage || '';
  toneInput.value = settings.tone || '';
  qualityInput.value = settings.qualityBar || '';
  const lang = settings.uiLanguage === 'en' ? 'en' : 'zh';
  uiLangSelect.value = lang;
  currentLang = lang;
  applyTexts();
}

function setLang(lang: Locale): void {
  currentLang = lang;
  applyTexts();
}

applyTexts();
hydrate().catch((err) => setStatus(String(err)));
