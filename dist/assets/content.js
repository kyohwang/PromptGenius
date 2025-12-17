"use strict";
(() => {
  // src/preference/profile.ts
  function buildPreferenceProfile(settings, prompts) {
    const tone = settings.tone || "Concise, friendly, and direct";
    const language = settings.preferredLanguage || "English";
    const quality = settings.qualityBar || "Structured, verifiable, and outcome-focused";
    const tagScore = /* @__PURE__ */ new Map();
    for (const prompt2 of prompts) {
      const weight = Math.max(1, prompt2.useCount || 0);
      (prompt2.tags || []).forEach((tag) => {
        const key = tag.trim().toLowerCase();
        if (!key) return;
        tagScore.set(key, (tagScore.get(key) || 0) + weight);
      });
    }
    const topTags = Array.from(tagScore.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag]) => tag).join(", ");
    const tagLine = topTags ? `Frequently used domains/tags: ${topTags}.` : "No dominant tags yet.";
    return [
      `Language preference: ${language}.`,
      `Tone: ${tone}.`,
      `Quality bar: ${quality}.`,
      tagLine,
      "Output style: prefers numbered steps, clear acceptance criteria, and bullet point highlights.",
      "Avoid filler; prioritize concise instructions and explicit delimiters for inputs/outputs."
    ].join(" ");
  }

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
  function normalizeState(state2) {
    if (!state2) return { ...defaultState, folders: [], prompts: [] };
    return {
      folders: state2.folders ?? [],
      prompts: state2.prompts ?? [],
      settings: { ...defaultState.settings, ...state2.settings ?? {} }
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
  function setToStorage(state2) {
    return new Promise((resolve) => {
      getStore().set({ [STORAGE_KEY]: state2 }, () => resolve());
    });
  }
  async function getFolders() {
    const state2 = await getFromStorage();
    return state2.folders;
  }
  async function getPrompts() {
    const state2 = await getFromStorage();
    return state2.prompts;
  }
  async function upsertFolder(folder) {
    const state2 = await getFromStorage();
    const now = Date.now();
    const id = folder.id ?? generateId("fld");
    const entry = {
      id,
      name: folder.name,
      parentId: folder.parentId,
      createdAt: folder.id ? folder.createdAt ?? now : now
    };
    const existingIndex = state2.folders.findIndex((f) => f.id === id);
    if (existingIndex >= 0) {
      state2.folders[existingIndex] = { ...state2.folders[existingIndex], ...entry };
    } else {
      state2.folders.push(entry);
    }
    await setToStorage(state2);
    return entry;
  }
  async function upsertPrompt(prompt2) {
    const state2 = await getFromStorage();
    const now = Date.now();
    const id = prompt2.id ?? generateId("pmt");
    const existingIndex = state2.prompts.findIndex((p) => p.id === id);
    const base = {
      id,
      folderId: prompt2.folderId,
      title: prompt2.title,
      content: prompt2.content,
      tags: prompt2.tags ?? [],
      favorite: prompt2.favorite ?? false,
      useCount: prompt2.useCount ?? 0,
      lastUsedAt: prompt2.lastUsedAt,
      createdAt: prompt2.id ? prompt2.createdAt ?? now : now,
      updatedAt: now
    };
    if (existingIndex >= 0) {
      state2.prompts[existingIndex] = { ...state2.prompts[existingIndex], ...base, updatedAt: now };
    } else {
      state2.prompts.push(base);
    }
    await setToStorage(state2);
    return base;
  }
  async function deletePrompt(id) {
    const state2 = await getFromStorage();
    state2.prompts = state2.prompts.filter((p) => p.id !== id);
    await setToStorage(state2);
  }
  async function touchUseStats(id) {
    const state2 = await getFromStorage();
    const idx = state2.prompts.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const prompt2 = state2.prompts[idx];
    state2.prompts[idx] = { ...prompt2, useCount: (prompt2.useCount ?? 0) + 1, lastUsedAt: Date.now() };
    await setToStorage(state2);
  }
  async function toggleFavorite(id) {
    const state2 = await getFromStorage();
    const idx = state2.prompts.findIndex((p) => p.id === id);
    if (idx < 0) return;
    state2.prompts[idx] = { ...state2.prompts[idx], favorite: !state2.prompts[idx].favorite, updatedAt: Date.now() };
    await setToStorage(state2);
  }
  async function setSettings(patch) {
    const state2 = await getFromStorage();
    state2.settings = { ...state2.settings, ...patch };
    await setToStorage(state2);
    return state2.settings;
  }
  async function getSettings() {
    const state2 = await getFromStorage();
    return state2.settings;
  }

  // src/content/chatgptInput.ts
  var INPUT_SELECTORS = [
    "div#prompt-textarea.ProseMirror",
    "div#prompt-textarea",
    'div.ProseMirror[contenteditable="true"]',
    "textarea#prompt-textarea",
    "textarea[data-id]",
    "textarea[data-testid]",
    "textarea[aria-label]",
    'textarea[placeholder*="Send a message"]',
    'textarea[placeholder*="Message ChatGPT"]',
    "form textarea",
    'div[contenteditable="true"][data-id]',
    'div[contenteditable="true"][data-testid]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"][aria-label]'
  ];
  function findCandidate() {
    for (const selector of INPUT_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    const formFallback = Array.from(document.querySelectorAll("form")).find((form) => form.querySelector("textarea"));
    if (formFallback) return formFallback.querySelector("textarea") ?? null;
    return null;
  }
  function findChatGPTInput() {
    return findCandidate();
  }
  function readInput() {
    const el = findChatGPTInput();
    if (!el) return "";
    if (el instanceof HTMLTextAreaElement) return el.value || "";
    return el.textContent || "";
  }
  function dispatchInput(el) {
    const event = new InputEvent("input", { bubbles: true, data: el instanceof HTMLTextAreaElement ? el.value : el.textContent || "", inputType: "insertText" });
    el.dispatchEvent(event);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function findSendButton() {
    const selectors = [
      'button[data-testid="send-button"]',
      'button[aria-label*="\u53D1\u9001"]',
      'button[aria-label*="send"]',
      'form button[type="submit"]'
    ];
    for (const selector of selectors) {
      const btn = document.querySelector(selector);
      if (btn) return btn;
    }
    return null;
  }
  function writeToInput(text) {
    const el = findChatGPTInput();
    if (!el) return false;
    const applyText = (node) => {
      try {
        node.innerHTML = `<p>${escapeHtml(text)}</p>`;
      } catch {
        node.textContent = text;
      }
    };
    if (el instanceof HTMLTextAreaElement) {
      el.focus();
      el.value = text;
      try {
        el.setSelectionRange(text.length, text.length);
      } catch {
      }
      dispatchInput(el);
      return true;
    }
    el.focus();
    applyText(el);
    dispatchInput(el);
    el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    return true;
  }
  function submitInput() {
    const btn = findSendButton();
    if (!btn) return false;
    btn.click();
    return true;
  }
  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return ch;
      }
    });
  }
  function computeDefaultIconPosition() {
    const el = findChatGPTInput();
    if (!el) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      return { x: width - 120, y: height - 120 };
    }
    const rect = el.getBoundingClientRect();
    const x = rect.right + 16;
    const y = rect.top + rect.height / 2;
    return { x, y };
  }
  function watchForInput(cb) {
    const observer = new MutationObserver(() => {
      const el = findChatGPTInput();
      if (el) cb(el);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
  }

  // src/content/styles.ts
  var shadowStyles = `
:host {
  all: initial;
}
.pm-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483640;
  font-family: 'Segoe UI', 'SF Pro Display', system-ui, -apple-system, sans-serif;
  color: #0f172a;
}
.pm-orb {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: radial-gradient(circle at 20% 20%, #9ae6b4, #2563eb);
  box-shadow: 0 8px 24px rgba(0,0,0,0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  cursor: grab;
  position: fixed;
  user-select: none;
  pointer-events: auto;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  z-index: 2147483632;
}
.pm-orb:hover { transform: scale(1.05); box-shadow: 0 12px 32px rgba(0,0,0,0.22); }
.pm-orb:active { cursor: grabbing; }

.pm-radial {
  position: fixed;
  width: 180px;
  height: 180px;
  pointer-events: none;
  z-index: 2147483631;
}
.pm-radial .pm-sector {
  position: absolute;
  width: 68px;
  height: 68px;
  transform: translate(-50%, -50%);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.9);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  text-align: center;
  padding: 6px;
  pointer-events: auto;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}
.pm-radial .pm-sector:hover { background: #2563eb; transform: scale(1.03); }

.pm-drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 420px;
  background: #f8fafc;
  border-left: 1px solid #e2e8f0;
  box-shadow: -10px 0 30px rgba(15, 23, 42, 0.1);
  transform: translateX(100%);
  transition: transform 0.28s ease;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  z-index: 2147483635;
}
.pm-drawer.open { transform: translateX(0); }
.pm-drawer header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
}
.pm-drawer h2 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
.pm-close { border: none; background: transparent; font-size: 18px; cursor: pointer; color: #334155; }
.pm-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pm-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; box-shadow: 0 2px 6px rgba(15,23,42,0.03); }
.pm-section h3 { margin: 0 0 8px 0; font-size: 14px; color: #0f172a; }
.pm-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.pm-field label { font-size: 12px; color: #475569; }
.pm-field input, .pm-field textarea, .pm-field select {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  background: #f8fafc;
}
.pm-field textarea { min-height: 80px; resize: vertical; }
.pm-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.pm-btn {
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease;
  font-size: 13px;
}
.pm-btn.secondary { background: #e2e8f0; color: #0f172a; }
.pm-btn.danger { background: #dc2626; }
.pm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.pm-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25); }
.pm-list { display: flex; flex-direction: column; gap: 10px; }
.pm-item {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pm-item .pm-item-title { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.pm-tag { background: #e0f2fe; color: #0ea5e9; padding: 2px 6px; border-radius: 6px; font-size: 11px; }
.pm-badge { font-size: 11px; color: #64748b; }
.pm-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.pm-pill {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
.pm-pill.active { background: #2563eb; color: #fff; border-color: #1d4ed8; }
.pm-drawer footer { padding: 10px 14px; border-top: 1px solid #e2e8f0; background: #fff; font-size: 12px; color: #475569; }
.pm-inline { display: inline-flex; align-items: center; gap: 4px; }
.pm-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.pm-table td, .pm-table th { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
.pm-muted { color: #94a3b8; font-size: 12px; }
.pm-input-inline { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pm-toast { position: fixed; bottom: 16px; right: 16px; background: #0f172a; color: #fff; padding: 10px 12px; border-radius: 8px; box-shadow: 0 8px 20px rgba(0,0,0,0.22); font-size: 13px; }
`;

  // src/content/mount.ts
  var HOST_ID = "pm-chatgpt-prompt-manager";
  function mountShell() {
    const existing = document.getElementById(HOST_ID);
    if (existing && existing.shadowRoot) {
      const root3 = existing.shadowRoot.querySelector(".pm-root");
      return { shadow: existing.shadowRoot, root: root3 };
    }
    const host = document.createElement("div");
    host.id = HOST_ID;
    const shadow2 = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = shadowStyles;
    const root2 = document.createElement("div");
    root2.className = "pm-root";
    shadow2.append(style, root2);
    document.body.appendChild(host);
    return { shadow: shadow2, root: root2 };
  }

  // src/content/index.ts
  var messages = {
    en: {
      "menu.builder": "Builder",
      "menu.optimizer": "Optimizer",
      "menu.library": "Library",
      "menu.settings": "Settings",
      "title.builder": "Builder",
      "title.optimizer": "Optimizer",
      "title.library": "Library",
      "title.settings": "Settings",
      "title.savePrompt": "Save Prompt",
      "builder.role": "Role",
      "builder.goal": "Goal *",
      "builder.langPreference": "Language preference",
      "builder.taskType": "Task Type",
      "builder.context": "Context",
      "builder.outputSchema": "Output Schema",
      "builder.qualityBar": "Quality Bar",
      "builder.constraints": "Constraints",
      "builder.interactionContract": "Interaction Contract",
      "builder.preview": "Preview",
      "builder.write": "Write to input",
      "builder.save": "Save to library",
      "builder.previewIntro": "Design a prompt with the following blueprint:",
      "builder.previewOutro": "Respond only with the final prompt wording, concise but complete.",
      "optimizer.draft": "Current draft (never reads chat history)",
      "optimizer.profile": "Preference profile",
      "optimizer.request": "Optimization request prompt",
      "optimizer.readDraft": "Read from input box",
      "optimizer.generate": "Generate request",
      "optimizer.oneClick": "Optimize & send",
      "optimizer.pastePlaceholder": "Paste optimized prompt here, then write to input",
      "optimizer.pasteApply": "Apply to input",
      "optimizer.profileEmpty": "No preference profile yet. Load a draft or use prompts to generate one.",
      "optimizer.pasteLabel": "Paste back result",
      "optimizer.empty": "Please enter the prompt to optimize first.",
      "search.label": "Search",
      "search.placeholder": "Title / Content / Tags",
      "filter.all": "All",
      "filter.fav": "Favorites",
      "filter.recent": "Recent",
      "sort.recent": "Sort by updated",
      "sort.title": "Sort by title",
      "sort.use": "Sort by usage",
      "folder.all": "All folders",
      "folder.root": "Root",
      "folder.new": "New folder",
      "library.empty": "No prompts found",
      "library.use": "Used {count}",
      "btn.write": "Write",
      "btn.edit": "Edit",
      "btn.delete": "Delete",
      "btn.save": "Save",
      "btn.cancel": "Cancel",
      "btn.saveSettings": "Save settings",
      "btn.export": "Export JSON",
      "btn.merge": "Merge import",
      "btn.overwrite": "Overwrite import",
      "save.title": "Title",
      "save.content": "Content",
      "save.tags": "Tags",
      "save.tagsPlaceholder": "Comma separated tags",
      "save.favorite": "Favorite",
      "save.folder": "Folder",
      "settings.prefLang": "Preferred language",
      "settings.tone": "Tone",
      "settings.quality": "Quality bar",
      "settings.uiLanguage": "UI language",
      "placeholder.prefLang": "e.g., Chinese / English",
      "placeholder.tone": "e.g., rigorous, friendly, concise",
      "import.label": "Import JSON",
      "import.placeholder": "Paste exported JSON here",
      "toast.wrote": "Written to ChatGPT input",
      "toast.copy": "Input not found, copied to clipboard",
      "toast.saved": "Saved to library",
      "toast.readDraft": "Draft loaded",
      "toast.createdFolder": "Folder created",
      "toast.savedSettings": "Settings saved",
      "toast.importMerge": "Merge import complete",
      "toast.importOverwrite": "Overwrite import complete",
      "toast.exportCopied": "Export JSON copied",
      "toast.validation": "Title and content are required",
      "confirm.deletePrompt": "Delete this prompt?",
      "confirm.overwrite": "Overwrite import will clear existing data. Continue?",
      "error.export": "Export failed",
      "error.import": "Import failed",
      "error.json": "Invalid JSON payload"
    },
    zh: {
      "menu.builder": "\u751F\u6210\u5668",
      "menu.optimizer": "\u4F18\u5316\u5668",
      "menu.library": "\u5E93",
      "menu.settings": "\u8BBE\u7F6E",
      "title.builder": "\u751F\u6210\u5668",
      "title.optimizer": "\u4F18\u5316\u5668",
      "title.library": "\u5E93",
      "title.settings": "\u8BBE\u7F6E",
      "title.savePrompt": "\u4FDD\u5B58 Prompt",
      "builder.role": "\u89D2\u8272",
      "builder.goal": "\u76EE\u6807*",
      "builder.langPreference": "\u8BED\u8A00\u504F\u597D",
      "builder.taskType": "\u4EFB\u52A1\u7C7B\u578B",
      "builder.context": "\u4E0A\u4E0B\u6587",
      "builder.outputSchema": "\u8F93\u51FA\u7ED3\u6784",
      "builder.qualityBar": "\u8D28\u91CF\u6807\u51C6",
      "builder.constraints": "\u7EA6\u675F",
      "builder.interactionContract": "\u4EA4\u4E92\u7EA6\u5B9A",
      "builder.preview": "\u9884\u89C8",
      "builder.write": "\u5199\u5165\u8F93\u5165\u6846",
      "builder.save": "\u4FDD\u5B58\u5230\u5E93",
      "builder.previewIntro": "\u6839\u636E\u4EE5\u4E0B\u84DD\u56FE\u8BBE\u8BA1 Prompt\uFF1A",
      "builder.previewOutro": "\u4EC5\u8F93\u51FA\u6700\u7EC8 Prompt \u6587\u672C\uFF0C\u7B80\u6D01\u4E14\u5B8C\u6574\u3002",
      "optimizer.draft": "\u5F53\u524D\u8349\u7A3F\uFF08\u4E0D\u4F1A\u8BFB\u53D6\u5386\u53F2\u5BF9\u8BDD\uFF09",
      "optimizer.profile": "\u504F\u597D\u753B\u50CF",
      "optimizer.request": "\u4F18\u5316\u8BF7\u6C42 Prompt\uFF08\u504F\u597D\u753B\u50CF + \u8349\u7A3F\uFF09",
      "optimizer.readDraft": "\u8BFB\u53D6\u8F93\u5165\u6846\u8349\u7A3F",
      "optimizer.generate": "\u751F\u6210\u4F18\u5316\u8BF7\u6C42",
      "optimizer.oneClick": "\u4E00\u952E\u4F18\u5316\u5E76\u53D1\u9001",
      "optimizer.pastePlaceholder": "\u5C06\u4F18\u5316\u540E\u7684 Prompt \u7C98\u8D34\u5230\u8FD9\u91CC\uFF0C\u7136\u540E\u5199\u5165\u8F93\u5165\u6846",
      "optimizer.pasteApply": "\u56DE\u586B\u5199\u5165",
      "optimizer.profileEmpty": "\u6682\u65E0\u504F\u597D\u753B\u50CF\uFF0C\u53EF\u5C1D\u8BD5\u52A0\u8F7D\u8349\u7A3F\u6216\u4F7F\u7528\u8FC7\u7684 Prompt\u3002",
      "optimizer.pasteLabel": "\u56DE\u586B\u4F18\u5316\u7ED3\u679C",
      "optimizer.empty": "\u8BF7\u5148\u8F93\u5165\u5F85\u4F18\u5316\u7684\u5185\u5BB9\u3002",
      "search.label": "\u641C\u7D22",
      "search.placeholder": "\u6807\u9898 / \u5185\u5BB9 / \u6807\u7B7E",
      "filter.all": "\u5168\u90E8",
      "filter.fav": "\u6536\u85CF",
      "filter.recent": "\u6700\u8FD1\u4F7F\u7528",
      "sort.recent": "\u6309\u66F4\u65B0\u65F6\u95F4",
      "sort.title": "\u6309\u6807\u9898",
      "sort.use": "\u6309\u4F7F\u7528\u6B21\u6570",
      "folder.all": "\u6240\u6709\u76EE\u5F55",
      "folder.root": "Root",
      "folder.new": "\u65B0\u5EFA\u76EE\u5F55",
      "library.empty": "\u6682\u65E0\u5339\u914D\u7684 Prompt",
      "library.use": "\u4F7F\u7528 {count}",
      "btn.write": "\u5199\u5165",
      "btn.edit": "\u7F16\u8F91",
      "btn.delete": "\u5220\u9664",
      "btn.save": "\u4FDD\u5B58",
      "btn.cancel": "\u53D6\u6D88",
      "btn.saveSettings": "\u4FDD\u5B58\u8BBE\u7F6E",
      "btn.export": "\u5BFC\u51FA JSON",
      "btn.merge": "\u5408\u5E76\u5BFC\u5165",
      "btn.overwrite": "\u8986\u76D6\u5BFC\u5165",
      "save.title": "\u6807\u9898",
      "save.content": "\u5185\u5BB9",
      "save.tags": "\u6807\u7B7E",
      "save.tagsPlaceholder": "\u9017\u53F7\u5206\u9694\u6807\u7B7E",
      "save.favorite": "\u6536\u85CF",
      "save.folder": "\u76EE\u5F55",
      "settings.prefLang": "\u504F\u597D\u8BED\u8A00",
      "settings.tone": "\u8BED\u6C14",
      "settings.quality": "\u8D28\u91CF\u6807\u51C6",
      "settings.uiLanguage": "\u754C\u9762\u8BED\u8A00",
      "placeholder.prefLang": "\u4F8B\u5982\uFF1A\u4E2D\u6587 / English",
      "placeholder.tone": "\u4F8B\u5982\uFF1A\u4E25\u8C28\u3001\u53CB\u597D\u3001\u7B80\u6D01",
      "import.label": "\u5BFC\u5165 JSON",
      "import.placeholder": "\u7C98\u8D34\u5BFC\u51FA\u7684 JSON \u6570\u636E",
      "toast.wrote": "\u5DF2\u5199\u5165 ChatGPT \u8F93\u5165\u6846",
      "toast.copy": "\u672A\u627E\u5230\u8F93\u5165\u6846\uFF0C\u5DF2\u590D\u5236\u6587\u672C",
      "toast.saved": "\u5DF2\u4FDD\u5B58\u5230\u5E93",
      "toast.readDraft": "\u5DF2\u8BFB\u53D6\u5F53\u524D\u8349\u7A3F",
      "toast.createdFolder": "\u5DF2\u521B\u5EFA\u76EE\u5F55",
      "toast.savedSettings": "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58",
      "toast.importMerge": "\u5408\u5E76\u5BFC\u5165\u5B8C\u6210",
      "toast.importOverwrite": "\u8986\u76D6\u5BFC\u5165\u5B8C\u6210",
      "toast.exportCopied": "\u5BFC\u51FA JSON \u5DF2\u590D\u5236",
      "toast.validation": "\u6807\u9898\u548C\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A",
      "confirm.deletePrompt": "\u5220\u9664\u8BE5 Prompt\uFF1F",
      "confirm.overwrite": "\u8986\u76D6\u5BFC\u5165\u4F1A\u6E05\u7A7A\u73B0\u6709\u6570\u636E\uFF0C\u786E\u8BA4\u7EE7\u7EED\uFF1F",
      "error.export": "\u5BFC\u51FA\u5931\u8D25",
      "error.import": "\u5BFC\u5165\u5931\u8D25",
      "error.json": "JSON \u89E3\u6790\u5931\u8D25"
    }
  };
  function currentLocale() {
    return state.settings.uiLanguage === "en" ? "en" : "zh";
  }
  function builderDefaults(locale) {
    if (locale === "en") {
      return {
        role: "Expert prompt architect",
        goal: "",
        taskType: "Planning",
        context: "Provide necessary background and assumptions.",
        outputSchema: "Numbered steps, checkpoints, and acceptance criteria.",
        qualityBar: "Clear, testable, specific, with examples.",
        constraints: "Avoid ambiguity; include examples; mark inputs/outputs.",
        interactionContract: "Ask for missing info before proceeding."
      };
    }
    return {
      role: "\u4E13\u4E1A\u63D0\u793A\u8BCD\u8BBE\u8BA1\u5E08",
      goal: "",
      taskType: "\u89C4\u5212",
      context: "\u63D0\u4F9B\u5FC5\u8981\u7684\u80CC\u666F\u3001\u4F9D\u8D56\u4E0E\u5047\u8BBE\u3002",
      outputSchema: "\u5206\u70B9\u8F93\u51FA\uFF0C\u5305\u542B\u68C0\u67E5\u70B9\u548C\u9A8C\u6536\u6807\u51C6\u3002",
      qualityBar: "\u6E05\u6670\u3001\u53EF\u9A8C\u8BC1\u3001\u5177\u4F53\uFF0C\u5E76\u7ED9\u51FA\u793A\u4F8B\u3002",
      constraints: "\u907F\u514D\u542B\u7CCA\uFF1B\u6807\u6CE8\u8F93\u5165/\u8F93\u51FA\uFF1B\u5FC5\u8981\u65F6\u63D0\u4F9B\u6837\u4F8B\u3002",
      interactionContract: "\u4FE1\u606F\u4E0D\u8DB3\u65F6\u5148\u63D0\u95EE\u518D\u6267\u884C\u3002"
    };
  }
  function t(key, params) {
    const lang = currentLocale();
    let template = messages[lang][key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        template = template.replace(`{${k}}`, String(v));
      }
    }
    return template;
  }
  function applyBuilderLocale(locale) {
    const defaults = builderDefaults(locale);
    const prevDefaults = builderDefaults(lastLocaleApplied);
    const next = { ...state.builder };
    let changed = false;
    Object.keys(defaults).forEach((key) => {
      const currentVal = state.builder[key];
      if (!currentVal || currentVal === prevDefaults[key]) {
        next[key] = defaults[key];
        changed = true;
      }
    });
    if (changed) {
      state.builder = next;
    }
    lastLocaleApplied = locale;
  }
  var initialBuilder = builderDefaults("zh");
  var { shadow, root } = mountShell();
  var orb = document.createElement("div");
  var radial = document.createElement("div");
  var drawer = document.createElement("div");
  var toast = document.createElement("div");
  var state = {
    drawerOpen: false,
    radialOpen: false,
    route: "builder",
    builder: initialBuilder,
    optimizerDraft: "",
    optimizedPrompt: "",
    preferenceProfile: "",
    library: { folders: [], prompts: [] },
    searchTerm: "",
    filter: "all",
    sort: "recent",
    folderFilter: void 0,
    selectedPromptId: void 0,
    savePromptDraft: { title: "", content: "", tags: "", favorite: false },
    position: computeDefaultIconPosition(),
    settings: {}
  };
  var lastLocaleApplied = "zh";
  function setState(patch, renderNow = true) {
    state = { ...state, ...patch };
    if (renderNow) render();
  }
  function showMessage(msg, ttl = 2200) {
    state.message = msg;
    renderToast();
    setTimeout(() => {
      if (state.message === msg) {
        state.message = void 0;
        renderToast();
      }
    }, ttl);
  }
  function buildPromptPreview(fields) {
    const langPref = state.settings.preferredLanguage?.trim() || (currentLocale() === "zh" ? "\u4E2D\u6587" : "English");
    const blocks = [
      `${t("builder.role")}: ${fields.role || "Skilled assistant"}`,
      `${t("builder.goal")}: ${fields.goal || "[define goal]"}`,
      `${t("builder.langPreference")}: ${langPref}`,
      fields.taskType ? `${t("builder.taskType")}: ${fields.taskType}` : "",
      fields.context ? `${t("builder.context")}: ${fields.context}` : "",
      fields.outputSchema ? `${t("builder.outputSchema")}: ${fields.outputSchema}` : "",
      fields.qualityBar ? `${t("builder.qualityBar")}: ${fields.qualityBar}` : "",
      fields.constraints ? `${t("builder.constraints")}: ${fields.constraints}` : "",
      fields.interactionContract ? `${t("builder.interactionContract")}: ${fields.interactionContract}` : ""
    ].filter(Boolean);
    return `${t("builder.previewIntro")}
${blocks.map((b) => `- ${b}`).join("\n")}
${t("builder.previewOutro")}`;
  }
  function renderOrb() {
    orb.className = "pm-orb";
    orb.textContent = "PM";
    orb.style.left = `${state.position.x}px`;
    orb.style.top = `${state.position.y}px`;
    if (!orb.isConnected) root.appendChild(orb);
  }
  function renderRadial() {
    radial.className = "pm-radial";
    const radius = state.radialOpen ? isNearEdge(state.position) ? 60 : 80 : 0;
    const size = 2 * radius + 20;
    radial.style.width = `${size}px`;
    radial.style.height = `${size}px`;
    radial.style.left = `${Math.min(Math.max(state.position.x - radius, 4), window.innerWidth - size - 4)}px`;
    radial.style.top = `${Math.min(Math.max(state.position.y - radius, 4), window.innerHeight - size - 4)}px`;
    radial.innerHTML = "";
    radial.style.display = state.radialOpen ? "block" : "none";
    if (state.radialOpen) {
      const sectors = [
        { route: "builder", label: t("menu.builder") },
        { route: "optimizer", label: t("menu.optimizer") },
        { route: "library", label: t("menu.library") },
        { route: "settings", label: t("menu.settings") }
      ];
      sectors.forEach((sector, index) => {
        const btn = document.createElement("div");
        btn.className = "pm-sector";
        const angle = index / sectors.length * Math.PI * 2;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const center = size / 2;
        btn.style.left = `${center + x}px`;
        btn.style.top = `${center + y}px`;
        btn.textContent = sector.label;
        btn.onclick = () => {
          setState({ route: sector.route, drawerOpen: true, radialOpen: false });
        };
        radial.appendChild(btn);
      });
    }
    if (!radial.isConnected) root.appendChild(radial);
  }
  function isNearEdge(pos) {
    const { innerWidth, innerHeight } = window;
    return pos.x < 140 || pos.x > innerWidth - 140 || pos.y < 140 || pos.y > innerHeight - 140;
  }
  function renderToast() {
    toast.className = "pm-toast";
    toast.textContent = state.message || "";
    toast.style.display = state.message ? "block" : "none";
    if (!toast.isConnected) root.appendChild(toast);
  }
  function createField(label, inputEl) {
    const wrap = document.createElement("div");
    wrap.className = "pm-field";
    const lbl = document.createElement("label");
    lbl.textContent = label;
    wrap.append(lbl, inputEl);
    return wrap;
  }
  function renderBuilder(body) {
    const section = document.createElement("div");
    section.className = "pm-section";
    let previewBox;
    let writeBtn;
    let saveBtn;
    const fields = ["role", "goal", "taskType", "context", "outputSchema", "qualityBar", "constraints", "interactionContract"];
    fields.forEach((key) => {
      const isLong = ["context", "constraints", "interactionContract", "outputSchema"].includes(key);
      const input = isLong ? document.createElement("textarea") : document.createElement("input");
      input.value = state.builder[key] || "";
      input.oninput = (e) => {
        const target = e.target;
        const next = { ...state.builder, [key]: target.value };
        setState({ builder: next }, false);
        const updatedPreview = buildPromptPreview(next);
        if (previewBox) previewBox.value = updatedPreview;
        if (writeBtn) writeBtn.disabled = !next.goal.trim();
        if (saveBtn) saveBtn.disabled = !next.goal.trim();
      };
      const labels = {
        role: "builder.role",
        goal: "builder.goal",
        taskType: "builder.taskType",
        context: "builder.context",
        outputSchema: "builder.outputSchema",
        qualityBar: "builder.qualityBar",
        constraints: "builder.constraints",
        interactionContract: "builder.interactionContract"
      };
      section.appendChild(createField(t(labels[key]), input));
    });
    previewBox = document.createElement("textarea");
    previewBox.readOnly = true;
    previewBox.value = buildPromptPreview(state.builder);
    section.appendChild(createField(t("builder.preview"), previewBox));
    const actions = document.createElement("div");
    actions.className = "pm-actions";
    writeBtn = document.createElement("button");
    writeBtn.className = "pm-btn";
    writeBtn.textContent = t("builder.write");
    writeBtn.disabled = !state.builder.goal.trim();
    writeBtn.onclick = () => {
      const previewText = buildPromptPreview(state.builder);
      const ok = writeToInput(previewText);
      if (!ok) {
        navigator.clipboard?.writeText(previewText);
        showMessage(t("toast.copy"));
      } else {
        showMessage(t("toast.wrote"));
      }
    };
    saveBtn = document.createElement("button");
    saveBtn.className = "pm-btn secondary";
    saveBtn.textContent = t("builder.save");
    saveBtn.disabled = !state.builder.goal.trim();
    saveBtn.onclick = () => {
      const previewText = buildPromptPreview(state.builder);
      setState(
        {
          route: "savePrompt",
          drawerOpen: true,
          savePromptDraft: {
            title: state.builder.goal.slice(0, 50) || t("title.savePrompt"),
            content: previewText,
            tags: "builder",
            favorite: false
          }
        },
        true
      );
    };
    actions.append(writeBtn, saveBtn);
    section.appendChild(actions);
    body.appendChild(section);
  }
  function renderOptimizer(body) {
    const section = document.createElement("div");
    section.className = "pm-section";
    const draftArea = document.createElement("textarea");
    draftArea.value = state.optimizerDraft;
    draftArea.oninput = (e) => {
      setState({ optimizerDraft: e.target.value }, false);
    };
    section.appendChild(createField(t("optimizer.draft"), draftArea));
    const profileBox = document.createElement("textarea");
    profileBox.readOnly = true;
    profileBox.value = state.preferenceProfile || t("optimizer.profileEmpty");
    section.appendChild(createField(t("optimizer.profile"), profileBox));
    const optimizedBox = document.createElement("textarea");
    optimizedBox.readOnly = true;
    optimizedBox.value = state.optimizedPrompt || "";
    section.appendChild(createField(t("optimizer.request"), optimizedBox));
    const actions = document.createElement("div");
    actions.className = "pm-actions";
    const loadBtn = document.createElement("button");
    loadBtn.className = "pm-btn secondary";
    loadBtn.textContent = t("optimizer.readDraft");
    loadBtn.onclick = () => {
      const next = readInput();
      setState({ optimizerDraft: next }, false);
      draftArea.value = next;
      showMessage(t("toast.readDraft"));
    };
    const genBtn = document.createElement("button");
    genBtn.className = "pm-btn";
    genBtn.textContent = t("optimizer.oneClick");
    genBtn.onclick = () => {
      const draft = readInput().trim() || state.optimizerDraft.trim();
      if (!draft) {
        showMessage(t("optimizer.empty"));
        return;
      }
      const langPref = state.settings.uiLanguage === "en" ? "English" : "\u4E2D\u6587";
      const prefix = `\u8BF7\u7ED3\u5408\u6211\u7684\u5386\u53F2\u4F1A\u8BDD\u8BB0\u5F55\uFF0C\u5E2E\u6211\u4F18\u5316\u4E0B\u9762\u7684prompt\uFF1A\u4EA4\u4E92\u8BED\u8A00\uFF1A${langPref}\u3002`;
      const combined = `${prefix}

${draft}`;
      const ok = writeToInput(combined);
      if (!ok) {
        navigator.clipboard?.writeText(combined);
        showMessage(t("toast.copy"));
        return;
      }
      const sent = submitInput();
      if (sent) {
        showMessage(t("toast.wrote"));
      } else {
        showMessage(t("toast.copy"));
      }
    };
    actions.append(loadBtn, genBtn);
    section.appendChild(actions);
    const pasteBox = document.createElement("textarea");
    pasteBox.placeholder = t("optimizer.pastePlaceholder");
    pasteBox.oninput = (e) => {
      const value = e.target.value;
      pasteBox.dataset.value = value;
    };
    section.appendChild(createField(t("optimizer.pasteLabel"), pasteBox));
    const pasteActions = document.createElement("div");
    pasteActions.className = "pm-actions";
    const pasteBtn = document.createElement("button");
    pasteBtn.className = "pm-btn";
    pasteBtn.textContent = t("optimizer.pasteApply");
    pasteBtn.onclick = () => {
      const value = pasteBox.dataset.value || "";
      const ok = writeToInput(value);
      if (!ok) {
        navigator.clipboard?.writeText(value);
        showMessage(t("toast.copy"));
      } else {
        showMessage(t("toast.wrote"));
      }
    };
    pasteActions.appendChild(pasteBtn);
    section.appendChild(pasteActions);
    body.appendChild(section);
  }
  function folderName(folderId) {
    if (!folderId) return t("folder.root");
    const chain = [];
    let current = state.library.folders.find((f) => f.id === folderId);
    let guard = 0;
    while (current && guard < 10) {
      chain.unshift(current.name);
      current = current.parentId ? state.library.folders.find((f) => f.id === current?.parentId) : void 0;
      guard++;
    }
    return chain.join(" / ") || t("folder.root");
  }
  function filteredPrompts() {
    let list = state.library.prompts;
    if (state.filter === "favorites") list = list.filter((p) => p.favorite);
    if (state.filter === "recent") list = list.filter((p) => !!p.lastUsedAt);
    if (state.folderFilter) list = list.filter((p) => p.folderId === state.folderFilter);
    if (state.searchTerm.trim()) {
      const term = state.searchTerm.toLowerCase();
      list = list.filter((p) => {
        const tags = (p.tags || []).join(" ").toLowerCase();
        return p.title.toLowerCase().includes(term) || p.content.toLowerCase().includes(term) || tags.includes(term);
      });
    }
    if (state.sort === "title") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (state.sort === "use") list = [...list].sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0));
    if (state.sort === "recent") list = [...list].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return list;
  }
  function renderLibrary(body) {
    const section = document.createElement("div");
    section.className = "pm-section";
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = t("search.placeholder");
    search.value = state.searchTerm;
    section.appendChild(createField(t("search.label"), search));
    const filterRow = document.createElement("div");
    filterRow.className = "pm-filters";
    const filterButtons = [];
    const updateFilterButtons = () => {
      filterButtons.forEach((btn) => {
        btn.className = `pm-pill ${btn.dataset.value === state.filter ? "active" : ""}`;
      });
    };
    ["all", "favorites", "recent"].forEach((f) => {
      const pill = document.createElement("button");
      pill.dataset.value = f;
      pill.className = `pm-pill ${state.filter === f ? "active" : ""}`;
      pill.textContent = f === "all" ? t("filter.all") : f === "favorites" ? t("filter.fav") : t("filter.recent");
      pill.onclick = () => {
        setState({ filter: f }, false);
        updateFilterButtons();
        renderList();
      };
      filterButtons.push(pill);
      filterRow.appendChild(pill);
    });
    const sortSelect = document.createElement("select");
    ["recent", "title", "use"].forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s === "recent" ? t("sort.recent") : s === "title" ? t("sort.title") : t("sort.use");
      if (state.sort === s) opt.selected = true;
      sortSelect.appendChild(opt);
    });
    sortSelect.onchange = (e) => {
      setState({ sort: e.target.value }, false);
      renderList();
    };
    filterRow.appendChild(sortSelect);
    const folderSelect = document.createElement("select");
    const rootOpt = document.createElement("option");
    rootOpt.value = "";
    rootOpt.textContent = t("folder.all");
    if (!state.folderFilter) rootOpt.selected = true;
    folderSelect.appendChild(rootOpt);
    state.library.folders.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = folderName(f.id);
      if (state.folderFilter === f.id) opt.selected = true;
      folderSelect.appendChild(opt);
    });
    folderSelect.onchange = (e) => {
      const val = e.target.value;
      setState({ folderFilter: val || void 0 }, false);
      renderList();
    };
    filterRow.appendChild(folderSelect);
    const addFolderBtn = document.createElement("button");
    addFolderBtn.className = "pm-btn secondary";
    addFolderBtn.textContent = t("folder.new");
    addFolderBtn.onclick = async () => {
      const name = prompt(t("folder.new"));
      if (!name) return;
      await upsertFolder({ name, parentId: state.folderFilter });
      await refreshLibrary();
      showMessage(t("toast.createdFolder"));
    };
    filterRow.appendChild(addFolderBtn);
    section.appendChild(filterRow);
    const list = document.createElement("div");
    list.className = "pm-list";
    const renderList = () => {
      list.innerHTML = "";
      const prompts = filteredPrompts();
      if (!prompts.length) {
        const empty = document.createElement("div");
        empty.className = "pm-muted";
        empty.textContent = t("library.empty");
        list.appendChild(empty);
        return;
      }
      prompts.forEach((p) => {
        const item = document.createElement("div");
        item.className = "pm-item";
        const titleRow = document.createElement("div");
        titleRow.className = "pm-item-title";
        const title = document.createElement("div");
        title.textContent = p.title;
        const meta = document.createElement("div");
        meta.className = "pm-inline";
        const favToggle = document.createElement("button");
        favToggle.className = "pm-btn secondary";
        favToggle.textContent = p.favorite ? "\u2605" : "\u2606";
        favToggle.onclick = async () => {
          await toggleFavorite(p.id);
          await refreshLibrary();
        };
        meta.appendChild(favToggle);
        titleRow.append(title, meta);
        item.appendChild(titleRow);
        const tagRow = document.createElement("div");
        tagRow.className = "pm-inline";
        if (p.tags?.length) {
          p.tags.forEach((t2) => {
            const tag = document.createElement("span");
            tag.className = "pm-tag";
            tag.textContent = t2;
            tagRow.appendChild(tag);
          });
        }
        const badge = document.createElement("span");
        badge.className = "pm-badge";
        badge.textContent = `${folderName(p.folderId)} \xB7 ${t("library.use", { count: p.useCount || 0 })}`;
        tagRow.appendChild(badge);
        item.appendChild(tagRow);
        const content = document.createElement("div");
        content.className = "pm-muted";
        content.textContent = p.content.slice(0, 140) + (p.content.length > 140 ? "\u2026" : "");
        item.appendChild(content);
        const actions = document.createElement("div");
        actions.className = "pm-actions";
        const writeBtn = document.createElement("button");
        writeBtn.className = "pm-btn";
        writeBtn.textContent = t("btn.write");
        writeBtn.onclick = async () => {
          const ok = writeToInput(p.content);
          if (!ok) {
            navigator.clipboard?.writeText(p.content);
            showMessage(t("toast.copy"));
          } else {
            await touchUseStats(p.id);
            await refreshLibrary();
            showMessage(t("toast.wrote"));
          }
        };
        const editBtn = document.createElement("button");
        editBtn.className = "pm-btn secondary";
        editBtn.textContent = t("btn.edit");
        editBtn.onclick = () => setState({
          route: "savePrompt",
          drawerOpen: true,
          savePromptDraft: {
            id: p.id,
            title: p.title,
            content: p.content,
            folderId: p.folderId,
            tags: (p.tags || []).join(","),
            favorite: p.favorite
          }
        });
        const delBtn = document.createElement("button");
        delBtn.className = "pm-btn secondary";
        delBtn.textContent = t("btn.delete");
        delBtn.onclick = async () => {
          if (!confirm(t("confirm.deletePrompt"))) return;
          await deletePrompt(p.id);
          await refreshLibrary();
        };
        actions.append(writeBtn, editBtn, delBtn);
        item.appendChild(actions);
        list.appendChild(item);
      });
    };
    search.oninput = (e) => {
      setState({ searchTerm: e.target.value }, false);
      renderList();
    };
    section.appendChild(list);
    body.appendChild(section);
    renderList();
  }
  function renderSavePrompt(body) {
    const section = document.createElement("div");
    section.className = "pm-section";
    const titleInput = document.createElement("input");
    titleInput.value = state.savePromptDraft.title;
    titleInput.oninput = (e) => setState({ savePromptDraft: { ...state.savePromptDraft, title: e.target.value } }, false);
    section.appendChild(createField(t("save.title"), titleInput));
    const contentArea = document.createElement("textarea");
    contentArea.value = state.savePromptDraft.content;
    contentArea.oninput = (e) => setState({ savePromptDraft: { ...state.savePromptDraft, content: e.target.value } }, false);
    section.appendChild(createField(t("save.content"), contentArea));
    const tagsInput = document.createElement("input");
    tagsInput.placeholder = t("save.tagsPlaceholder");
    tagsInput.value = state.savePromptDraft.tags;
    tagsInput.oninput = (e) => setState({ savePromptDraft: { ...state.savePromptDraft, tags: e.target.value } }, false);
    section.appendChild(createField(t("save.tags"), tagsInput));
    const favoriteToggle = document.createElement("input");
    favoriteToggle.type = "checkbox";
    favoriteToggle.checked = state.savePromptDraft.favorite;
    favoriteToggle.onchange = (e) => setState({ savePromptDraft: { ...state.savePromptDraft, favorite: e.target.checked } }, false);
    const favWrap = document.createElement("div");
    favWrap.className = "pm-input-inline";
    favWrap.append(favoriteToggle, document.createTextNode(t("save.favorite")));
    section.appendChild(createField(t("save.favorite"), favWrap));
    const folderSelect = document.createElement("select");
    const rootOpt = document.createElement("option");
    rootOpt.value = "";
    rootOpt.textContent = t("folder.root");
    folderSelect.appendChild(rootOpt);
    state.library.folders.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = folderName(f.id);
      if (state.savePromptDraft.folderId === f.id) opt.selected = true;
      folderSelect.appendChild(opt);
    });
    folderSelect.onchange = (e) => setState({
      savePromptDraft: { ...state.savePromptDraft, folderId: e.target.value || void 0 }
    }, false);
    section.appendChild(createField(t("save.folder"), folderSelect));
    const actions = document.createElement("div");
    actions.className = "pm-actions";
    const saveBtn = document.createElement("button");
    saveBtn.className = "pm-btn";
    saveBtn.textContent = t("btn.save");
    saveBtn.onclick = async () => {
      if (!state.savePromptDraft.title.trim() || !state.savePromptDraft.content.trim()) {
        showMessage(t("toast.validation"));
        return;
      }
      await upsertPrompt({
        id: state.savePromptDraft.id,
        title: state.savePromptDraft.title,
        content: state.savePromptDraft.content,
        folderId: state.savePromptDraft.folderId,
        tags: state.savePromptDraft.tags.split(",").map((t2) => t2.trim()).filter(Boolean),
        favorite: state.savePromptDraft.favorite
      });
      await refreshLibrary();
      setState({ route: "library" });
      showMessage(t("toast.saved"));
    };
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "pm-btn secondary";
    cancelBtn.textContent = t("btn.cancel");
    cancelBtn.onclick = () => setState({ route: "library" });
    actions.append(saveBtn, cancelBtn);
    section.appendChild(actions);
    body.appendChild(section);
  }
  function renderSettings(body) {
    const section = document.createElement("div");
    section.className = "pm-section";
    const langInput = document.createElement("input");
    langInput.value = state.settings.preferredLanguage || "";
    langInput.placeholder = t("placeholder.prefLang");
    langInput.oninput = (e) => setState({ settings: { ...state.settings, preferredLanguage: e.target.value } }, false);
    section.appendChild(createField(t("settings.prefLang"), langInput));
    const toneInput = document.createElement("input");
    toneInput.value = state.settings.tone || "";
    toneInput.placeholder = t("placeholder.tone");
    toneInput.oninput = (e) => setState({ settings: { ...state.settings, tone: e.target.value } }, false);
    section.appendChild(createField(t("settings.tone"), toneInput));
    const qualityInput = document.createElement("input");
    qualityInput.value = state.settings.qualityBar || "";
    qualityInput.oninput = (e) => setState({ settings: { ...state.settings, qualityBar: e.target.value } }, false);
    section.appendChild(createField(t("settings.quality"), qualityInput));
    const uiLangSelect = document.createElement("select");
    ["zh", "en"].forEach((lng) => {
      const opt = document.createElement("option");
      opt.value = lng;
      opt.textContent = lng === "zh" ? "\u7B80\u4F53\u4E2D\u6587" : "English";
      if (state.settings.uiLanguage === lng) opt.selected = true;
      uiLangSelect.appendChild(opt);
    });
    uiLangSelect.onchange = (e) => {
      const lng = e.target.value;
      setState({ settings: { ...state.settings, uiLanguage: lng } }, false);
      applyBuilderLocale(lng);
      render();
    };
    section.appendChild(createField(t("settings.uiLanguage"), uiLangSelect));
    const actions = document.createElement("div");
    actions.className = "pm-actions";
    const saveBtn = document.createElement("button");
    saveBtn.className = "pm-btn";
    saveBtn.textContent = t("btn.saveSettings");
    saveBtn.onclick = async () => {
      await setSettings(state.settings);
      await refreshLibrary();
      showMessage(t("toast.savedSettings"));
    };
    actions.appendChild(saveBtn);
    section.appendChild(actions);
    const importExportSection = document.createElement("div");
    importExportSection.className = "pm-section";
    const exportBtn = document.createElement("button");
    exportBtn.className = "pm-btn secondary";
    exportBtn.textContent = t("btn.export");
    exportBtn.onclick = async () => {
      const bundle = await requestExport();
      const text = JSON.stringify(bundle, null, 2);
      await navigator.clipboard?.writeText(text);
      showMessage(t("toast.exportCopied"));
    };
    const importTextarea = document.createElement("textarea");
    importTextarea.placeholder = t("import.placeholder");
    const mergeBtn = document.createElement("button");
    mergeBtn.className = "pm-btn";
    mergeBtn.textContent = t("btn.merge");
    mergeBtn.onclick = async () => {
      try {
        await requestImport(importTextarea.value, "merge");
        await refreshLibrary();
        showMessage(t("toast.importMerge"));
      } catch (err) {
        showMessage(String(err));
      }
    };
    const overwriteBtn = document.createElement("button");
    overwriteBtn.className = "pm-btn danger";
    overwriteBtn.textContent = t("btn.overwrite");
    overwriteBtn.onclick = async () => {
      if (!confirm(t("confirm.overwrite"))) return;
      try {
        await requestImport(importTextarea.value, "overwrite");
        await refreshLibrary();
        showMessage(t("toast.importOverwrite"));
      } catch (err) {
        showMessage(String(err));
      }
    };
    importExportSection.appendChild(exportBtn);
    importExportSection.appendChild(createField(t("import.label"), importTextarea));
    const importActions = document.createElement("div");
    importActions.className = "pm-actions";
    importActions.append(mergeBtn, overwriteBtn);
    importExportSection.appendChild(importActions);
    body.append(section, importExportSection);
  }
  function renderDrawer() {
    drawer.className = `pm-drawer ${state.drawerOpen ? "open" : ""}`;
    const header = document.createElement("header");
    const title = document.createElement("h2");
    const titles = {
      builder: t("title.builder"),
      optimizer: t("title.optimizer"),
      library: t("title.library"),
      settings: t("title.settings"),
      savePrompt: t("title.savePrompt")
    };
    title.textContent = titles[state.route];
    const close = document.createElement("button");
    close.className = "pm-close";
    close.textContent = "\xD7";
    close.onclick = () => setState({ drawerOpen: false });
    header.append(title, close);
    const body = document.createElement("div");
    body.className = "pm-body";
    switch (state.route) {
      case "builder":
        renderBuilder(body);
        break;
      case "optimizer":
        renderOptimizer(body);
        break;
      case "library":
        renderLibrary(body);
        break;
      case "settings":
        renderSettings(body);
        break;
      case "savePrompt":
        renderSavePrompt(body);
        break;
    }
    drawer.innerHTML = "";
    drawer.append(header, body);
    if (!drawer.isConnected) root.appendChild(drawer);
  }
  function render() {
    renderOrb();
    renderRadial();
    renderDrawer();
    renderToast();
  }
  function startDrag() {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    orb.addEventListener("mousedown", (e) => {
      dragging = true;
      offsetX = e.clientX - state.position.x;
      offsetY = e.clientY - state.position.y;
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      state.position = { x, y };
      renderOrb();
      renderRadial();
    });
    window.addEventListener("mouseup", async () => {
      if (!dragging) return;
      dragging = false;
      const updatedSettings = { ...state.settings, iconPosition: state.position };
      setState({ settings: updatedSettings }, false);
      await setSettings(updatedSettings);
    });
  }
  function ensureIconNearInput() {
    if (state.settings.iconPosition) return;
    let placed = false;
    const observer = watchForInput(() => {
      if (placed) return;
      placed = true;
      const pos = computeDefaultIconPosition();
      state.position = pos;
      renderOrb();
      renderRadial();
      observer.disconnect();
    });
    setTimeout(() => observer.disconnect(), 8e3);
  }
  async function refreshLibrary() {
    const [folders, prompts, settings] = await Promise.all([getFolders(), getPrompts(), getSettings()]);
    const profile = buildPreferenceProfile(settings, prompts);
    state = { ...state, library: { folders, prompts }, settings, preferenceProfile: profile };
    applyBuilderLocale(settings.uiLanguage === "en" ? "en" : "zh");
    render();
  }
  async function init() {
    orb.onclick = () => setState({ radialOpen: !state.radialOpen });
    startDrag();
    await refreshLibrary();
    const position = state.settings.iconPosition ?? computeDefaultIconPosition();
    setState({ position });
    render();
    ensureIconNearInput();
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === "OPEN_SAVE_PROMPT") {
        const payload = msg.payload;
        setState({
          drawerOpen: true,
          route: "savePrompt",
          savePromptDraft: {
            title: payload.title,
            content: payload.content,
            tags: "imported",
            favorite: false
          }
        });
        sendResponse({ ok: true });
        return true;
      }
      return false;
    });
  }
  async function requestExport() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "EXPORT_DATA" }, (res) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError.message);
        if (res?.ok) return resolve(res.bundle);
        return reject(res?.error || t("error.export"));
      });
    });
  }
  async function requestImport(json, strategy) {
    return new Promise((resolve, reject) => {
      let bundle;
      try {
        bundle = JSON.parse(json);
      } catch (err) {
        reject(t("error.json"));
        return;
      }
      chrome.runtime.sendMessage({ type: "IMPORT_DATA", payload: { bundle, strategy } }, (res) => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError.message);
        if (res?.ok) return resolve();
        reject(res?.error || t("error.import"));
      });
    });
  }
  init().catch((err) => console.error("Prompt manager init error", err));
})();
