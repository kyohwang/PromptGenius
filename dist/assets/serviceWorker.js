"use strict";
(() => {
  // src/utils/id.ts
  function generateId(prefix = "id") {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    const random = Math.random().toString(36).slice(2, 8);
    const stamp = Date.now().toString(36);
    return `${prefix}-${stamp}-${random}`;
  }

  // src/storage/repo.ts
  var STORAGE_KEY = "promptManagerState";
  var SCHEMA_VERSION = 1;
  var defaultState = {
    folders: [],
    prompts: [],
    settings: {
      preferredLanguage: "English",
      tone: "Concise and friendly",
      qualityBar: "Structured, testable, and specific outputs",
      uiLanguage: "zh"
    }
  };
  function normalizeState(state) {
    if (!state) return { ...defaultState, folders: [], prompts: [] };
    return {
      folders: state.folders ?? [],
      prompts: state.prompts ?? [],
      settings: { ...defaultState.settings, ...state.settings ?? {} }
    };
  }
  function getStore() {
    return chrome?.storage?.local ?? {};
  }
  function getFromStorage() {
    return new Promise((resolve) => {
      getStore().get([STORAGE_KEY], (result) => {
        resolve(normalizeState(result?.[STORAGE_KEY]));
      });
    });
  }
  function setToStorage(state) {
    return new Promise((resolve) => {
      getStore().set({ [STORAGE_KEY]: state }, () => resolve());
    });
  }
  async function getSettings() {
    const state = await getFromStorage();
    return state.settings;
  }
  async function exportData() {
    const state = await getFromStorage();
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      folders: state.folders,
      prompts: state.prompts,
      settings: state.settings
    };
  }
  async function importData(bundle, strategy) {
    if (strategy === "overwrite") {
      await setToStorage({
        folders: bundle.folders ?? [],
        prompts: (bundle.prompts ?? []).map((p) => ({ ...p, id: generateId("pmt") })),
        settings: bundle.settings ?? defaultState.settings
      });
      return;
    }
    const current = await getFromStorage();
    const folderIdMap = /* @__PURE__ */ new Map();
    const mergedFolders = [...current.folders];
    for (const folder of bundle.folders ?? []) {
      const newId = generateId("fld");
      folderIdMap.set(folder.id, newId);
      mergedFolders.push({ ...folder, id: newId, parentId: folder.parentId ? folderIdMap.get(folder.parentId) : folder.parentId });
    }
    const mergedPrompts = [...current.prompts];
    for (const prompt of bundle.prompts ?? []) {
      mergedPrompts.push({
        ...prompt,
        id: generateId("pmt"),
        folderId: prompt.folderId ? folderIdMap.get(prompt.folderId) : prompt.folderId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    const mergedSettings = { ...current.settings, ...bundle.settings ?? {} };
    await setToStorage({ folders: mergedFolders, prompts: mergedPrompts, settings: mergedSettings });
  }

  // src/background/serviceWorker.ts
  var MENU_ID = "prompt-manager-add";
  var menuTitle = {
    zh: "\u6DFB\u52A0\u5230 Prompt \u5E93\u2026",
    en: "Add to Prompt Library\u2026"
  };
  async function setupContextMenu() {
    const lang = await resolveLang();
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: MENU_ID,
        title: menuTitle[lang],
        contexts: ["selection"],
        documentUrlPatterns: ["https://chatgpt.com/*", "https://chat.openai.com/*"]
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
    if (area !== "local") return;
    if (!changes.promptManagerState) return;
    setupContextMenu();
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID || !tab?.id) return;
    const selection = info.selectionText ?? "";
    chrome.tabs.sendMessage(tab.id, {
      type: "OPEN_SAVE_PROMPT",
      payload: {
        title: selection.slice(0, 20) || "\u65B0\u5EFA Prompt",
        content: selection
      }
    });
  });
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "PING") {
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "EXPORT_DATA") {
      exportData().then((bundle) => sendResponse({ ok: true, bundle })).catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
    if (msg.type === "IMPORT_DATA") {
      importData(msg.payload.bundle, msg.payload.strategy).then(() => sendResponse({ ok: true })).catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
    return false;
  });
  async function resolveLang() {
    try {
      const settings = await getSettings();
      return settings.uiLanguage === "en" ? "en" : "zh";
    } catch {
      return "zh";
    }
  }
})();
