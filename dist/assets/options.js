"use strict";
(() => {
  // src/storage/repo.ts
  var STORAGE_KEY = "promptManagerState";
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
  async function clearAll() {
    const cleared = { folders: [], prompts: [], settings: defaultState.settings };
    await setToStorage(cleared);
  }
  async function setSettings(patch) {
    const state = await getFromStorage();
    state.settings = { ...state.settings, ...patch };
    await setToStorage(state);
    return state.settings;
  }
  async function getSettings() {
    const state = await getFromStorage();
    return state.settings;
  }

  // src/options/main.ts
  var messages = {
    en: {
      title: "Prompt Manager Settings",
      prefTitle: "Preferences",
      importTitle: "Import / Export",
      dangerTitle: "Danger zone",
      prefLang: "Preferred language",
      tone: "Tone",
      quality: "Quality bar",
      uiLanguage: "UI language",
      placeholderLang: "e.g., Chinese / English",
      placeholderTone: "e.g., rigorous, friendly, concise",
      export: "Export JSON (copy)",
      importLabel: "Import",
      merge: "Merge import",
      overwrite: "Overwrite import",
      overwriteConfirm: "Overwrite import will clear existing data. Continue?",
      clearConfirm: "Are you sure you want to clear all data?",
      clearAll: "Clear all data",
      save: "Save",
      importPlaceholder: "Paste exported data",
      statusSaved: "Settings saved",
      statusExported: "Export copied",
      statusMerge: "Merge import complete",
      statusOverwrite: "Overwrite import complete",
      statusCleared: "Data cleared",
      statusImportError: "Import failed",
      statusJsonError: "Invalid JSON payload"
    },
    zh: {
      title: "Prompt Manager \u8BBE\u7F6E",
      prefTitle: "\u504F\u597D\u8BBE\u7F6E",
      importTitle: "\u5BFC\u5165 / \u5BFC\u51FA",
      dangerTitle: "\u5371\u9669\u533A",
      prefLang: "\u504F\u597D\u8BED\u8A00",
      tone: "\u8BED\u6C14",
      quality: "\u8D28\u91CF\u6807\u51C6",
      uiLanguage: "\u754C\u9762\u8BED\u8A00",
      placeholderLang: "\u4F8B\u5982\uFF1A\u4E2D\u6587 / English",
      placeholderTone: "\u4F8B\u5982\uFF1A\u4E25\u8C28\u3001\u53CB\u597D\u3001\u7B80\u6D01",
      export: "\u5BFC\u51FA JSON\uFF08\u590D\u5236\uFF09",
      importLabel: "\u5BFC\u5165",
      merge: "\u5408\u5E76\u5BFC\u5165",
      overwrite: "\u8986\u76D6\u5BFC\u5165",
      overwriteConfirm: "\u8986\u76D6\u5BFC\u5165\u4F1A\u6E05\u7A7A\u73B0\u6709\u6570\u636E\uFF0C\u786E\u8BA4\u7EE7\u7EED\uFF1F",
      clearConfirm: "\u786E\u8BA4\u6E05\u7A7A\u6240\u6709\u6570\u636E\uFF1F",
      clearAll: "\u6E05\u7A7A\u5168\u90E8\u6570\u636E",
      save: "\u4FDD\u5B58",
      importPlaceholder: "\u7C98\u8D34\u5BFC\u51FA\u6570\u636E",
      statusSaved: "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58",
      statusExported: "\u5DF2\u590D\u5236\u5BFC\u51FA JSON",
      statusMerge: "\u5408\u5E76\u5BFC\u5165\u5B8C\u6210",
      statusOverwrite: "\u8986\u76D6\u5BFC\u5165\u5B8C\u6210",
      statusCleared: "\u6570\u636E\u5DF2\u6E05\u7A7A",
      statusImportError: "\u5BFC\u5165\u5931\u8D25",
      statusJsonError: "JSON \u89E3\u6790\u5931\u8D25"
    }
  };
  var currentLang = "zh";
  function t(key) {
    return messages[currentLang][key] || key;
  }
  var app = document.getElementById("app");
  var style = document.createElement("style");
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
  var wrap = document.createElement("div");
  wrap.className = "wrap";
  app.appendChild(wrap);
  var title = document.createElement("h1");
  wrap.appendChild(title);
  var status = document.createElement("div");
  status.className = "status";
  wrap.appendChild(status);
  var settingsPanel = document.createElement("div");
  settingsPanel.className = "panel";
  var settingsHeading = document.createElement("h3");
  settingsPanel.appendChild(settingsHeading);
  var languageInput = document.createElement("input");
  var toneInput = document.createElement("input");
  var qualityInput = document.createElement("input");
  var uiLangSelect = document.createElement("select");
  ["zh", "en"].forEach((lng) => {
    const opt = document.createElement("option");
    opt.value = lng;
    opt.textContent = lng === "zh" ? "\u7B80\u4F53\u4E2D\u6587" : "English";
    uiLangSelect.appendChild(opt);
  });
  settingsPanel.append(
    createField("prefLang", languageInput),
    createField("tone", toneInput),
    createField("quality", qualityInput),
    createField("uiLanguage", uiLangSelect)
  );
  var settingsActions = document.createElement("div");
  settingsActions.className = "actions";
  var saveSettingsBtn = document.createElement("button");
  saveSettingsBtn.className = "btn";
  settingsActions.appendChild(saveSettingsBtn);
  settingsPanel.appendChild(settingsActions);
  var importExport = document.createElement("div");
  importExport.className = "panel";
  var importHeading = document.createElement("h3");
  importExport.appendChild(importHeading);
  var exportBtn = document.createElement("button");
  exportBtn.className = "btn secondary";
  importExport.appendChild(exportBtn);
  var importArea = document.createElement("textarea");
  importExport.appendChild(createField("importLabel", importArea));
  var importActions = document.createElement("div");
  importActions.className = "actions";
  var mergeBtn = document.createElement("button");
  mergeBtn.className = "btn";
  var overwriteBtn = document.createElement("button");
  overwriteBtn.className = "btn danger";
  importActions.append(mergeBtn, overwriteBtn);
  importExport.appendChild(importActions);
  var dangerPanel = document.createElement("div");
  dangerPanel.className = "panel";
  var dangerHeading = document.createElement("h3");
  dangerPanel.appendChild(dangerHeading);
  var clearBtn = document.createElement("button");
  clearBtn.className = "btn danger";
  dangerPanel.appendChild(clearBtn);
  wrap.append(settingsPanel, importExport, dangerPanel);
  saveSettingsBtn.onclick = async () => {
    await setSettings({
      preferredLanguage: languageInput.value,
      tone: toneInput.value,
      qualityBar: qualityInput.value,
      uiLanguage: uiLangSelect.value
    });
    setLang(uiLangSelect.value);
    setStatus(t("statusSaved"));
  };
  exportBtn.onclick = async () => {
    try {
      const bundle = await requestExport();
      const text = JSON.stringify(bundle, null, 2);
      await navigator.clipboard?.writeText(text);
      setStatus(t("statusExported"));
    } catch (err) {
      setStatus(String(err));
    }
  };
  mergeBtn.onclick = () => handleImport(importArea.value, "merge");
  overwriteBtn.onclick = () => handleImport(importArea.value, "overwrite");
  clearBtn.onclick = async () => {
    if (!confirm(t("clearConfirm"))) return;
    await clearAll();
    setStatus(t("statusCleared"));
  };
  function createField(labelKey, input) {
    const div = document.createElement("div");
    div.className = "field";
    const lbl = document.createElement("label");
    lbl.dataset.key = labelKey;
    div.append(lbl, input);
    return div;
  }
  function applyTexts() {
    title.textContent = t("title");
    settingsHeading.textContent = t("prefTitle");
    importHeading.textContent = t("importTitle");
    dangerHeading.textContent = t("dangerTitle");
    saveSettingsBtn.textContent = t("save");
    exportBtn.textContent = t("export");
    mergeBtn.textContent = t("merge");
    overwriteBtn.textContent = t("overwrite");
    clearBtn.textContent = t("clearAll");
    importArea.placeholder = t("importPlaceholder");
    languageInput.placeholder = t("placeholderLang");
    toneInput.placeholder = t("placeholderTone");
    document.querySelectorAll("label[data-key]").forEach((lbl) => {
      const key = lbl.dataset.key;
      lbl.textContent = t(key);
    });
    uiLangSelect.querySelectorAll("option").forEach((opt) => {
      opt.textContent = opt.value === "zh" ? "\u7B80\u4F53\u4E2D\u6587" : "English";
    });
  }
  function setStatus(text) {
    status.textContent = text;
  }
  async function handleImport(json, strategy) {
    try {
      await requestImport(json, strategy);
      setStatus(strategy === "merge" ? t("statusMerge") : t("statusOverwrite"));
    } catch (err) {
      setStatus(String(err));
    }
  }
  async function requestExport() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "EXPORT_DATA" }, (res) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError.message);
        if (res?.ok) return resolve(res.bundle);
        reject(res?.error || t("statusImportError"));
      });
    });
  }
  async function requestImport(json, strategy) {
    return new Promise((resolve, reject) => {
      let bundle;
      try {
        bundle = JSON.parse(json);
      } catch (err) {
        reject(t("statusJsonError"));
        return;
      }
      chrome.runtime.sendMessage({ type: "IMPORT_DATA", payload: { bundle, strategy } }, (res) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError.message);
        if (res?.ok) return resolve();
        reject(res?.error || t("statusImportError"));
      });
    });
  }
  async function hydrate() {
    const settings = await getSettings();
    languageInput.value = settings.preferredLanguage || "";
    toneInput.value = settings.tone || "";
    qualityInput.value = settings.qualityBar || "";
    const lang = settings.uiLanguage === "en" ? "en" : "zh";
    uiLangSelect.value = lang;
    currentLang = lang;
    applyTexts();
  }
  function setLang(lang) {
    currentLang = lang;
    applyTexts();
  }
  applyTexts();
  hydrate().catch((err) => setStatus(String(err)));
})();
