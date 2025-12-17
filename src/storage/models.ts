export type Folder = {
  id: string;
  name: string;
  parentId?: string;
  createdAt: number;
};

export type Prompt = {
  id: string;
  folderId?: string;
  title: string;
  content: string;
  tags: string[];
  favorite: boolean;
  useCount: number;
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type IconPosition = {
  x: number;
  y: number;
};

export type Settings = {
  iconPosition?: IconPosition;
  preferredLanguage?: string;
  tone?: string;
  qualityBar?: string;
  defaultGoal?: string;
  uiLanguage?: 'zh' | 'en';
};

export type StorageState = {
  folders: Folder[];
  prompts: Prompt[];
  settings: Settings;
};

export type ExportBundle = {
  schemaVersion: number;
  exportedAt: string;
  folders: Folder[];
  prompts: Prompt[];
  settings: Settings;
};

export type ImportStrategy = 'merge' | 'overwrite';
