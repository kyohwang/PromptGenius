import { generateId } from '../utils/id';
import {
  ExportBundle,
  Folder,
  ImportStrategy,
  Prompt,
  Settings,
  StorageState
} from './models';

const STORAGE_KEY = 'promptManagerState';
const SCHEMA_VERSION = 1;

const defaultState: StorageState = {
  folders: [],
  prompts: [],
  settings: {
    preferredLanguage: 'English',
    tone: 'Concise and friendly',
    qualityBar: 'Structured, testable, and specific outputs',
    uiLanguage: 'zh'
  }
};

function normalizeState(state?: StorageState): StorageState {
  if (!state) return { ...defaultState, folders: [], prompts: [] };
  return {
    folders: state.folders ?? [],
    prompts: state.prompts ?? [],
    settings: { ...defaultState.settings, ...(state.settings ?? {}) }
  };
}

function getStore(): chrome.storage.StorageArea {
  // chrome is available in the extension runtime; fallback for dev preview.
  return chrome?.storage?.local ?? ({} as chrome.storage.StorageArea);
}

function getFromStorage(): Promise<StorageState> {
  return new Promise((resolve) => {
    getStore().get([STORAGE_KEY], (result) => {
      resolve(normalizeState(result?.[STORAGE_KEY] as StorageState | undefined));
    });
  });
}

function setToStorage(state: StorageState): Promise<void> {
  return new Promise((resolve) => {
    getStore().set({ [STORAGE_KEY]: state }, () => resolve());
  });
}

export async function getState(): Promise<StorageState> {
  return getFromStorage();
}

export async function clearAll(): Promise<void> {
  const cleared: StorageState = { folders: [], prompts: [], settings: defaultState.settings };
  await setToStorage(cleared);
}

export async function getFolders(): Promise<Folder[]> {
  const state = await getFromStorage();
  return state.folders;
}

export async function getPrompts(): Promise<Prompt[]> {
  const state = await getFromStorage();
  return state.prompts;
}

export async function upsertFolder(folder: Partial<Folder> & { name: string; id?: string; parentId?: string }): Promise<Folder> {
  const state = await getFromStorage();
  const now = Date.now();
  const id = folder.id ?? generateId('fld');
  const entry: Folder = {
    id,
    name: folder.name,
    parentId: folder.parentId,
    createdAt: folder.id ? folder.createdAt ?? now : now
  };
  const existingIndex = state.folders.findIndex((f) => f.id === id);
  if (existingIndex >= 0) {
    state.folders[existingIndex] = { ...state.folders[existingIndex], ...entry };
  } else {
    state.folders.push(entry);
  }
  await setToStorage(state);
  return entry;
}

export async function deleteFolder(folderId: string): Promise<void> {
  const state = await getFromStorage();
  state.folders = state.folders.filter((f) => f.id !== folderId);
  state.prompts = state.prompts.map((p) => (p.folderId === folderId ? { ...p, folderId: undefined } : p));
  await setToStorage(state);
}

export async function upsertPrompt(prompt: Partial<Prompt> & { title: string; content: string; id?: string }): Promise<Prompt> {
  const state = await getFromStorage();
  const now = Date.now();
  const id = prompt.id ?? generateId('pmt');
  const existingIndex = state.prompts.findIndex((p) => p.id === id);
  const base: Prompt = {
    id,
    folderId: prompt.folderId,
    title: prompt.title,
    content: prompt.content,
    tags: prompt.tags ?? [],
    favorite: prompt.favorite ?? false,
    useCount: prompt.useCount ?? 0,
    lastUsedAt: prompt.lastUsedAt,
    createdAt: prompt.id ? prompt.createdAt ?? now : now,
    updatedAt: now
  };
  if (existingIndex >= 0) {
    state.prompts[existingIndex] = { ...state.prompts[existingIndex], ...base, updatedAt: now };
  } else {
    state.prompts.push(base);
  }
  await setToStorage(state);
  return base;
}

export async function deletePrompt(id: string): Promise<void> {
  const state = await getFromStorage();
  state.prompts = state.prompts.filter((p) => p.id !== id);
  await setToStorage(state);
}

export async function touchUseStats(id: string): Promise<void> {
  const state = await getFromStorage();
  const idx = state.prompts.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const prompt = state.prompts[idx];
  state.prompts[idx] = { ...prompt, useCount: (prompt.useCount ?? 0) + 1, lastUsedAt: Date.now() };
  await setToStorage(state);
}

export async function toggleFavorite(id: string): Promise<void> {
  const state = await getFromStorage();
  const idx = state.prompts.findIndex((p) => p.id === id);
  if (idx < 0) return;
  state.prompts[idx] = { ...state.prompts[idx], favorite: !state.prompts[idx].favorite, updatedAt: Date.now() };
  await setToStorage(state);
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const state = await getFromStorage();
  state.settings = { ...state.settings, ...patch };
  await setToStorage(state);
  return state.settings;
}

export async function getSettings(): Promise<Settings> {
  const state = await getFromStorage();
  return state.settings;
}

export async function searchPrompts(term: string, filter: 'all' | 'favorites' | 'recent' = 'all'): Promise<Prompt[]> {
  const normalized = term.trim().toLowerCase();
  const prompts = await getPrompts();
  let filtered = prompts;
  if (filter === 'favorites') {
    filtered = filtered.filter((p) => p.favorite);
  } else if (filter === 'recent') {
    filtered = filtered
      .filter((p) => !!p.lastUsedAt)
      .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
  }
  if (!normalized) return filtered;
  return filtered.filter((p) => {
    const tags = (p.tags ?? []).join(' ').toLowerCase();
    return (
      p.title.toLowerCase().includes(normalized) ||
      p.content.toLowerCase().includes(normalized) ||
      tags.includes(normalized)
    );
  });
}

export async function exportData(): Promise<ExportBundle> {
  const state = await getFromStorage();
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    folders: state.folders,
    prompts: state.prompts,
    settings: state.settings
  };
}

export async function importData(bundle: ExportBundle, strategy: ImportStrategy): Promise<void> {
  if (strategy === 'overwrite') {
    await setToStorage({
      folders: bundle.folders ?? [],
      prompts: (bundle.prompts ?? []).map((p) => ({ ...p, id: generateId('pmt') })),
      settings: bundle.settings ?? defaultState.settings
    });
    return;
  }

  const current = await getFromStorage();
  const folderIdMap = new Map<string, string>();
  const mergedFolders: Folder[] = [...current.folders];
  for (const folder of bundle.folders ?? []) {
    const newId = generateId('fld');
    folderIdMap.set(folder.id, newId);
    mergedFolders.push({ ...folder, id: newId, parentId: folder.parentId ? folderIdMap.get(folder.parentId) : folder.parentId });
  }

  const mergedPrompts: Prompt[] = [...current.prompts];
  for (const prompt of bundle.prompts ?? []) {
    mergedPrompts.push({
      ...prompt,
      id: generateId('pmt'),
      folderId: prompt.folderId ? folderIdMap.get(prompt.folderId) : prompt.folderId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  const mergedSettings: Settings = { ...current.settings, ...(bundle.settings ?? {}) };
  await setToStorage({ folders: mergedFolders, prompts: mergedPrompts, settings: mergedSettings });
}
