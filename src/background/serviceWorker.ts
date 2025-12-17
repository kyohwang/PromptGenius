import { exportData, getSettings, importData } from '../storage/repo';
import { ExportBundle, ImportStrategy } from '../storage/models';

const MENU_ID = 'prompt-manager-add';

const menuTitle = {
  zh: '添加到 Prompt 库…',
  en: 'Add to Prompt Library…'
} as const;

async function setupContextMenu(): Promise<void> {
  const lang = await resolveLang();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: menuTitle[lang],
      contexts: ['selection'],
      documentUrlPatterns: ['https://chatgpt.com/*', 'https://chat.openai.com/*']
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenu();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes.promptManagerState) return;
  setupContextMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  const selection = info.selectionText ?? '';
  chrome.tabs.sendMessage(tab.id, {
    type: 'OPEN_SAVE_PROMPT',
    payload: {
      title: selection.slice(0, 20) || '新建 Prompt',
      content: selection
    }
  });
});

type BackgroundRequest =
  | { type: 'PING' }
  | { type: 'EXPORT_DATA' }
  | { type: 'IMPORT_DATA'; payload: { bundle: ExportBundle; strategy: ImportStrategy } };

chrome.runtime.onMessage.addListener((msg: BackgroundRequest, _sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === 'EXPORT_DATA') {
    exportData()
      .then((bundle) => sendResponse({ ok: true, bundle }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (msg.type === 'IMPORT_DATA') {
    importData(msg.payload.bundle, msg.payload.strategy)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  return false;
});

async function resolveLang(): Promise<'zh' | 'en'> {
  try {
    const settings = await getSettings();
    return settings.uiLanguage === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}
