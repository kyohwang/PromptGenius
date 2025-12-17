import { buildPreferenceProfile } from '../preference/profile';
import { ExportBundle, Folder, Prompt, Settings } from '../storage/models';
import {
  deletePrompt,
  getFolders,
  getPrompts,
  getSettings,
  setSettings,
  toggleFavorite,
  touchUseStats,
  upsertFolder,
  upsertPrompt
} from '../storage/repo';
import { computeDefaultIconPosition, readInput, submitInput, watchForInput, writeToInput } from './chatgptInput';
import { mountShell } from './mount';

type Route = 'builder' | 'optimizer' | 'library' | 'settings' | 'savePrompt';
type Filter = 'all' | 'favorites' | 'recent';
type Sort = 'recent' | 'title' | 'use';

type BuilderFields = {
  role: string;
  goal: string;
  taskType: string;
  context: string;
  outputSchema: string;
  qualityBar: string;
  constraints: string;
  interactionContract: string;
};

type SavePromptDraft = {
  id?: string;
  title: string;
  content: string;
  folderId?: string;
  tags: string;
  favorite: boolean;
};

type AppState = {
  drawerOpen: boolean;
  radialOpen: boolean;
  route: Route;
  builder: BuilderFields;
  optimizerDraft: string;
  optimizedPrompt: string;
  preferenceProfile: string;
  library: { folders: Folder[]; prompts: Prompt[] };
  searchTerm: string;
  filter: Filter;
  sort: Sort;
  folderFilter?: string;
  selectedPromptId?: string;
  savePromptDraft: SavePromptDraft;
  message?: string;
  position: { x: number; y: number };
  settings: Settings;
};

type Locale = 'zh' | 'en';

const messages = {
  en: {
    'menu.builder': 'Builder',
    'menu.optimizer': 'Optimizer',
    'menu.library': 'Library',
    'menu.settings': 'Settings',
    'title.builder': 'Builder',
    'title.optimizer': 'Optimizer',
    'title.library': 'Library',
    'title.settings': 'Settings',
    'title.savePrompt': 'Save Prompt',
    'builder.role': 'Role',
    'builder.goal': 'Goal *',
    'builder.langPreference': 'Language preference',
    'builder.taskType': 'Task Type',
    'builder.context': 'Context',
    'builder.outputSchema': 'Output Schema',
    'builder.qualityBar': 'Quality Bar',
    'builder.constraints': 'Constraints',
    'builder.interactionContract': 'Interaction Contract',
    'builder.preview': 'Preview',
    'builder.write': 'Write to input',
    'builder.save': 'Save to library',
    'builder.previewIntro': 'Design a prompt with the following blueprint:',
    'builder.previewOutro': 'Respond only with the final prompt wording, concise but complete.',
    'optimizer.draft': 'Current draft (never reads chat history)',
    'optimizer.profile': 'Preference profile',
    'optimizer.request': 'Optimization request prompt',
    'optimizer.readDraft': 'Read from input box',
    'optimizer.generate': 'Generate request',
    'optimizer.oneClick': 'Optimize & send',
    'optimizer.pastePlaceholder': 'Paste optimized prompt here, then write to input',
    'optimizer.pasteApply': 'Apply to input',
    'optimizer.profileEmpty': 'No preference profile yet. Load a draft or use prompts to generate one.',
    'optimizer.pasteLabel': 'Paste back result',
    'optimizer.empty': 'Please enter the prompt to optimize first.',
    'search.label': 'Search',
    'search.placeholder': 'Title / Content / Tags',
    'filter.all': 'All',
    'filter.fav': 'Favorites',
    'filter.recent': 'Recent',
    'sort.recent': 'Sort by updated',
    'sort.title': 'Sort by title',
    'sort.use': 'Sort by usage',
    'folder.all': 'All folders',
    'folder.root': 'Root',
    'folder.new': 'New folder',
    'library.empty': 'No prompts found',
    'library.use': 'Used {count}',
    'btn.write': 'Write',
    'btn.edit': 'Edit',
    'btn.delete': 'Delete',
    'btn.save': 'Save',
    'btn.cancel': 'Cancel',
    'btn.saveSettings': 'Save settings',
    'btn.export': 'Export JSON',
    'btn.merge': 'Merge import',
    'btn.overwrite': 'Overwrite import',
    'save.title': 'Title',
    'save.content': 'Content',
    'save.tags': 'Tags',
    'save.tagsPlaceholder': 'Comma separated tags',
    'save.favorite': 'Favorite',
    'save.folder': 'Folder',
    'settings.prefLang': 'Preferred language',
    'settings.tone': 'Tone',
    'settings.quality': 'Quality bar',
    'settings.uiLanguage': 'UI language',
    'placeholder.prefLang': 'e.g., Chinese / English',
    'placeholder.tone': 'e.g., rigorous, friendly, concise',
    'import.label': 'Import JSON',
    'import.placeholder': 'Paste exported JSON here',
    'toast.wrote': 'Written to ChatGPT input',
    'toast.copy': 'Input not found, copied to clipboard',
    'toast.saved': 'Saved to library',
    'toast.readDraft': 'Draft loaded',
    'toast.createdFolder': 'Folder created',
    'toast.savedSettings': 'Settings saved',
    'toast.importMerge': 'Merge import complete',
    'toast.importOverwrite': 'Overwrite import complete',
    'toast.exportCopied': 'Export JSON copied',
    'toast.validation': 'Title and content are required',
    'confirm.deletePrompt': 'Delete this prompt?',
    'confirm.overwrite': 'Overwrite import will clear existing data. Continue?',
    'error.export': 'Export failed',
    'error.import': 'Import failed',
    'error.json': 'Invalid JSON payload'
  },
  zh: {
    'menu.builder': '生成器',
    'menu.optimizer': '优化器',
    'menu.library': '库',
    'menu.settings': '设置',
    'title.builder': '生成器',
    'title.optimizer': '优化器',
    'title.library': '库',
    'title.settings': '设置',
    'title.savePrompt': '保存 Prompt',
    'builder.role': '角色',
    'builder.goal': '目标*',
    'builder.langPreference': '语言偏好',
    'builder.taskType': '任务类型',
    'builder.context': '上下文',
    'builder.outputSchema': '输出结构',
    'builder.qualityBar': '质量标准',
    'builder.constraints': '约束',
    'builder.interactionContract': '交互约定',
    'builder.preview': '预览',
    'builder.write': '写入输入框',
    'builder.save': '保存到库',
    'builder.previewIntro': '根据以下蓝图设计 Prompt：',
    'builder.previewOutro': '仅输出最终 Prompt 文本，简洁且完整。',
    'optimizer.draft': '当前草稿（不会读取历史对话）',
    'optimizer.profile': '偏好画像',
    'optimizer.request': '优化请求 Prompt（偏好画像 + 草稿）',
    'optimizer.readDraft': '读取输入框草稿',
    'optimizer.generate': '生成优化请求',
    'optimizer.oneClick': '一键优化并发送',
    'optimizer.pastePlaceholder': '将优化后的 Prompt 粘贴到这里，然后写入输入框',
    'optimizer.pasteApply': '回填写入',
    'optimizer.profileEmpty': '暂无偏好画像，可尝试加载草稿或使用过的 Prompt。',
    'optimizer.pasteLabel': '回填优化结果',
    'optimizer.empty': '请先输入待优化的内容。',
    'search.label': '搜索',
    'search.placeholder': '标题 / 内容 / 标签',
    'filter.all': '全部',
    'filter.fav': '收藏',
    'filter.recent': '最近使用',
    'sort.recent': '按更新时间',
    'sort.title': '按标题',
    'sort.use': '按使用次数',
    'folder.all': '所有目录',
    'folder.root': 'Root',
    'folder.new': '新建目录',
    'library.empty': '暂无匹配的 Prompt',
    'library.use': '使用 {count}',
    'btn.write': '写入',
    'btn.edit': '编辑',
    'btn.delete': '删除',
    'btn.save': '保存',
    'btn.cancel': '取消',
    'btn.saveSettings': '保存设置',
    'btn.export': '导出 JSON',
    'btn.merge': '合并导入',
    'btn.overwrite': '覆盖导入',
    'save.title': '标题',
    'save.content': '内容',
    'save.tags': '标签',
    'save.tagsPlaceholder': '逗号分隔标签',
    'save.favorite': '收藏',
    'save.folder': '目录',
    'settings.prefLang': '偏好语言',
    'settings.tone': '语气',
    'settings.quality': '质量标准',
    'settings.uiLanguage': '界面语言',
    'placeholder.prefLang': '例如：中文 / English',
    'placeholder.tone': '例如：严谨、友好、简洁',
    'import.label': '导入 JSON',
    'import.placeholder': '粘贴导出的 JSON 数据',
    'toast.wrote': '已写入 ChatGPT 输入框',
    'toast.copy': '未找到输入框，已复制文本',
    'toast.saved': '已保存到库',
    'toast.readDraft': '已读取当前草稿',
    'toast.createdFolder': '已创建目录',
    'toast.savedSettings': '设置已保存',
    'toast.importMerge': '合并导入完成',
    'toast.importOverwrite': '覆盖导入完成',
    'toast.exportCopied': '导出 JSON 已复制',
    'toast.validation': '标题和内容不能为空',
    'confirm.deletePrompt': '删除该 Prompt？',
    'confirm.overwrite': '覆盖导入会清空现有数据，确认继续？',
    'error.export': '导出失败',
    'error.import': '导入失败',
    'error.json': 'JSON 解析失败'
  }
} as const;

type MessageKey = keyof typeof messages.en;

function currentLocale(): Locale {
  return state.settings.uiLanguage === 'en' ? 'en' : 'zh';
}

function builderDefaults(locale: Locale): BuilderFields {
  if (locale === 'en') {
    return {
      role: 'Expert prompt architect',
      goal: '',
      taskType: 'Planning',
      context: 'Provide necessary background and assumptions.',
      outputSchema: 'Numbered steps, checkpoints, and acceptance criteria.',
      qualityBar: 'Clear, testable, specific, with examples.',
      constraints: 'Avoid ambiguity; include examples; mark inputs/outputs.',
      interactionContract: 'Ask for missing info before proceeding.'
    };
  }
  return {
    role: '专业提示词设计师',
    goal: '',
    taskType: '规划',
    context: '提供必要的背景、依赖与假设。',
    outputSchema: '分点输出，包含检查点和验收标准。',
    qualityBar: '清晰、可验证、具体，并给出示例。',
    constraints: '避免含糊；标注输入/输出；必要时提供样例。',
    interactionContract: '信息不足时先提问再执行。'
  };
}

function t(key: MessageKey, params?: Record<string, string | number>): string {
  const lang = currentLocale();
  let template = messages[lang][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      template = template.replace(`{${k}}`, String(v));
    }
  }
  return template;
}

function applyBuilderLocale(locale: Locale): void {
  const defaults = builderDefaults(locale);
  const prevDefaults = builderDefaults(lastLocaleApplied);
  const next: BuilderFields = { ...state.builder };
  let changed = false;
  (Object.keys(defaults) as (keyof BuilderFields)[]).forEach((key) => {
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

const initialBuilder: BuilderFields = builderDefaults('zh');

const { shadow, root } = mountShell();
const orb = document.createElement('div');
const radial = document.createElement('div');
const drawer = document.createElement('div');
const toast = document.createElement('div');

let state: AppState = {
  drawerOpen: false,
  radialOpen: false,
  route: 'builder',
  builder: initialBuilder,
  optimizerDraft: '',
  optimizedPrompt: '',
  preferenceProfile: '',
  library: { folders: [], prompts: [] },
  searchTerm: '',
  filter: 'all',
  sort: 'recent',
  folderFilter: undefined,
  selectedPromptId: undefined,
  savePromptDraft: { title: '', content: '', tags: '', favorite: false },
  position: computeDefaultIconPosition(),
  settings: {}
};

let lastLocaleApplied: Locale = 'zh';

function setState(patch: Partial<AppState>, renderNow = true): void {
  state = { ...state, ...patch };
  if (renderNow) render();
}

function showMessage(msg: string, ttl = 2200): void {
  state.message = msg;
  renderToast();
  setTimeout(() => {
    if (state.message === msg) {
      state.message = undefined;
      renderToast();
    }
  }, ttl);
}

function buildPromptPreview(fields: BuilderFields): string {
  const langPref = state.settings.preferredLanguage?.trim() || (currentLocale() === 'zh' ? '中文' : 'English');
  const blocks = [
    `${t('builder.role')}: ${fields.role || 'Skilled assistant'}`,
    `${t('builder.goal')}: ${fields.goal || '[define goal]'}`,
    `${t('builder.langPreference')}: ${langPref}`,
    fields.taskType ? `${t('builder.taskType')}: ${fields.taskType}` : '',
    fields.context ? `${t('builder.context')}: ${fields.context}` : '',
    fields.outputSchema ? `${t('builder.outputSchema')}: ${fields.outputSchema}` : '',
    fields.qualityBar ? `${t('builder.qualityBar')}: ${fields.qualityBar}` : '',
    fields.constraints ? `${t('builder.constraints')}: ${fields.constraints}` : '',
    fields.interactionContract ? `${t('builder.interactionContract')}: ${fields.interactionContract}` : ''
  ].filter(Boolean);
  return `${t('builder.previewIntro')}\n${blocks.map((b) => `- ${b}`).join('\n')}\n${t('builder.previewOutro')}`;
}

function buildOptimizerPrompt(profile: string, draft: string): string {
  const trimmed = draft.trim();
  return [
    'You are a prompt optimizer. Improve the provided draft using the preferences.',
    `Preference profile: ${profile}`,
    'Draft to optimize:',
    '---',
    trimmed || '[empty]',
    '---',
    'Return only the optimized prompt. Keep the user intent intact, enhance structure, and clarify inputs/outputs.'
  ].join('\n');
}

function renderOrb(): void {
  orb.className = 'pm-orb';
  orb.textContent = 'PM';
  orb.style.left = `${state.position.x}px`;
  orb.style.top = `${state.position.y}px`;
  if (!orb.isConnected) root.appendChild(orb);
}

function renderRadial(): void {
  radial.className = 'pm-radial';
  const radius = state.radialOpen ? (isNearEdge(state.position) ? 60 : 80) : 0;
  const size = 2 * radius + 20;
  radial.style.width = `${size}px`;
  radial.style.height = `${size}px`;
  radial.style.left = `${Math.min(Math.max(state.position.x - radius, 4), window.innerWidth - size - 4)}px`;
  radial.style.top = `${Math.min(Math.max(state.position.y - radius, 4), window.innerHeight - size - 4)}px`;
  radial.innerHTML = '';
  radial.style.display = state.radialOpen ? 'block' : 'none';
  if (state.radialOpen) {
    const sectors: { route: Route; label: string }[] = [
      { route: 'builder', label: t('menu.builder') },
      { route: 'optimizer', label: t('menu.optimizer') },
      { route: 'library', label: t('menu.library') },
      { route: 'settings', label: t('menu.settings') }
    ];
    sectors.forEach((sector, index) => {
      const btn = document.createElement('div');
      btn.className = 'pm-sector';
      const angle = (index / sectors.length) * Math.PI * 2;
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

function isNearEdge(pos: { x: number; y: number }): boolean {
  const { innerWidth, innerHeight } = window;
  return pos.x < 140 || pos.x > innerWidth - 140 || pos.y < 140 || pos.y > innerHeight - 140;
}

function renderToast(): void {
  toast.className = 'pm-toast';
  toast.textContent = state.message || '';
  toast.style.display = state.message ? 'block' : 'none';
  if (!toast.isConnected) root.appendChild(toast);
}

function createField(label: string, inputEl: HTMLElement): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pm-field';
  const lbl = document.createElement('label');
  lbl.textContent = label;
  wrap.append(lbl, inputEl);
  return wrap;
}

function renderBuilder(body: HTMLElement): void {
  const section = document.createElement('div');
  section.className = 'pm-section';
  let previewBox: HTMLTextAreaElement;
  let writeBtn: HTMLButtonElement;
  let saveBtn: HTMLButtonElement;
  const fields: (keyof BuilderFields)[] = ['role', 'goal', 'taskType', 'context', 'outputSchema', 'qualityBar', 'constraints', 'interactionContract'];
  fields.forEach((key) => {
    const isLong = ['context', 'constraints', 'interactionContract', 'outputSchema'].includes(key);
    const input = isLong ? document.createElement('textarea') : document.createElement('input');
    input.value = (state.builder as any)[key] || '';
    input.oninput = (e) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      const next = { ...state.builder, [key]: target.value };
      setState({ builder: next }, false);
      const updatedPreview = buildPromptPreview(next);
      if (previewBox) previewBox.value = updatedPreview;
      if (writeBtn) writeBtn.disabled = !next.goal.trim();
      if (saveBtn) saveBtn.disabled = !next.goal.trim();
    };
    const labels: Record<keyof BuilderFields, MessageKey> = {
      role: 'builder.role',
      goal: 'builder.goal',
      taskType: 'builder.taskType',
      context: 'builder.context',
      outputSchema: 'builder.outputSchema',
      qualityBar: 'builder.qualityBar',
      constraints: 'builder.constraints',
      interactionContract: 'builder.interactionContract'
    };
    section.appendChild(createField(t(labels[key]), input));
  });

  previewBox = document.createElement('textarea');
  previewBox.readOnly = true;
  previewBox.value = buildPromptPreview(state.builder);
  section.appendChild(createField(t('builder.preview'), previewBox));

  const actions = document.createElement('div');
  actions.className = 'pm-actions';
  writeBtn = document.createElement('button');
  writeBtn.className = 'pm-btn';
  writeBtn.textContent = t('builder.write');
  writeBtn.disabled = !state.builder.goal.trim();
  writeBtn.onclick = () => {
    const previewText = buildPromptPreview(state.builder);
    const ok = writeToInput(previewText);
    if (!ok) {
      navigator.clipboard?.writeText(previewText);
      showMessage(t('toast.copy'));
    } else {
      showMessage(t('toast.wrote'));
    }
  };

  saveBtn = document.createElement('button');
  saveBtn.className = 'pm-btn secondary';
  saveBtn.textContent = t('builder.save');
  saveBtn.disabled = !state.builder.goal.trim();
  saveBtn.onclick = () => {
    const previewText = buildPromptPreview(state.builder);
    setState(
      {
        route: 'savePrompt',
        drawerOpen: true,
        savePromptDraft: {
          title: state.builder.goal.slice(0, 50) || t('title.savePrompt'),
          content: previewText,
          tags: 'builder',
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

function renderOptimizer(body: HTMLElement): void {
  const section = document.createElement('div');
  section.className = 'pm-section';

  const draftArea = document.createElement('textarea');
  draftArea.value = state.optimizerDraft;
  draftArea.oninput = (e) => {
    setState({ optimizerDraft: (e.target as HTMLTextAreaElement).value }, false);
  };
  section.appendChild(createField(t('optimizer.draft'), draftArea));

  const profileBox = document.createElement('textarea');
  profileBox.readOnly = true;
  profileBox.value = state.preferenceProfile || t('optimizer.profileEmpty');
  section.appendChild(createField(t('optimizer.profile'), profileBox));

  const optimizedBox = document.createElement('textarea');
  optimizedBox.readOnly = true;
  optimizedBox.value = state.optimizedPrompt || '';
  section.appendChild(createField(t('optimizer.request'), optimizedBox));

  const actions = document.createElement('div');
  actions.className = 'pm-actions';

  const loadBtn = document.createElement('button');
  loadBtn.className = 'pm-btn secondary';
  loadBtn.textContent = t('optimizer.readDraft');
  loadBtn.onclick = () => {
    const next = readInput();
    setState({ optimizerDraft: next }, false);
    draftArea.value = next;
    showMessage(t('toast.readDraft'));
  };

  const genBtn = document.createElement('button');
  genBtn.className = 'pm-btn';
  genBtn.textContent = t('optimizer.oneClick');
  genBtn.onclick = () => {
    const draft = readInput().trim() || state.optimizerDraft.trim();
    if (!draft) {
      showMessage(t('optimizer.empty'));
      return;
    }
    const langPref = state.settings.uiLanguage === 'en' ? 'English' : '中文';
    const prefix = `请结合我的历史会话记录，帮我优化下面的prompt：交互语言：${langPref}。`;
    const combined = `${prefix}\n\n${draft}`;
    const ok = writeToInput(combined);
    if (!ok) {
      navigator.clipboard?.writeText(combined);
      showMessage(t('toast.copy'));
      return;
    }
    const sent = submitInput();
    if (sent) {
      showMessage(t('toast.wrote'));
    } else {
      showMessage(t('toast.copy'));
    }
  };

  actions.append(loadBtn, genBtn);
  section.appendChild(actions);

  const pasteBox = document.createElement('textarea');
  pasteBox.placeholder = t('optimizer.pastePlaceholder');
  pasteBox.oninput = (e) => {
    const value = (e.target as HTMLTextAreaElement).value;
    pasteBox.dataset.value = value;
  };
  section.appendChild(createField(t('optimizer.pasteLabel'), pasteBox));

  const pasteActions = document.createElement('div');
  pasteActions.className = 'pm-actions';
  const pasteBtn = document.createElement('button');
  pasteBtn.className = 'pm-btn';
  pasteBtn.textContent = t('optimizer.pasteApply');
  pasteBtn.onclick = () => {
    const value = pasteBox.dataset.value || '';
    const ok = writeToInput(value);
    if (!ok) {
      navigator.clipboard?.writeText(value);
      showMessage(t('toast.copy'));
    } else {
      showMessage(t('toast.wrote'));
    }
  };
  pasteActions.appendChild(pasteBtn);
  section.appendChild(pasteActions);

  body.appendChild(section);
}

function folderName(folderId?: string): string {
  if (!folderId) return t('folder.root');
  const chain: string[] = [];
  let current = state.library.folders.find((f) => f.id === folderId);
  let guard = 0;
  while (current && guard < 10) {
    chain.unshift(current.name);
    current = current.parentId ? state.library.folders.find((f) => f.id === current?.parentId) : undefined;
    guard++;
  }
  return chain.join(' / ') || t('folder.root');
}

function filteredPrompts(): Prompt[] {
  let list = state.library.prompts;
  if (state.filter === 'favorites') list = list.filter((p) => p.favorite);
  if (state.filter === 'recent') list = list.filter((p) => !!p.lastUsedAt);
  if (state.folderFilter) list = list.filter((p) => p.folderId === state.folderFilter);
  if (state.searchTerm.trim()) {
    const term = state.searchTerm.toLowerCase();
    list = list.filter((p) => {
      const tags = (p.tags || []).join(' ').toLowerCase();
      return p.title.toLowerCase().includes(term) || p.content.toLowerCase().includes(term) || tags.includes(term);
    });
  }
  if (state.sort === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title));
  if (state.sort === 'use') list = [...list].sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0));
  if (state.sort === 'recent') list = [...list].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return list;
}

function renderLibrary(body: HTMLElement): void {
  const section = document.createElement('div');
  section.className = 'pm-section';
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = t('search.placeholder');
  search.value = state.searchTerm;
  section.appendChild(createField(t('search.label'), search));

  const filterRow = document.createElement('div');
  filterRow.className = 'pm-filters';
  const filterButtons: HTMLButtonElement[] = [];
  const updateFilterButtons = () => {
    filterButtons.forEach((btn) => {
      btn.className = `pm-pill ${btn.dataset.value === state.filter ? 'active' : ''}`;
    });
  };
  ['all', 'favorites', 'recent'].forEach((f) => {
    const pill = document.createElement('button');
    pill.dataset.value = f;
    pill.className = `pm-pill ${state.filter === f ? 'active' : ''}`;
    pill.textContent = f === 'all' ? t('filter.all') : f === 'favorites' ? t('filter.fav') : t('filter.recent');
    pill.onclick = () => {
      setState({ filter: f as Filter }, false);
      updateFilterButtons();
      renderList();
    };
    filterButtons.push(pill);
    filterRow.appendChild(pill);
  });

  const sortSelect = document.createElement('select');
  ['recent', 'title', 'use'].forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s === 'recent' ? t('sort.recent') : s === 'title' ? t('sort.title') : t('sort.use');
    if (state.sort === s) opt.selected = true;
    sortSelect.appendChild(opt);
  });
  sortSelect.onchange = (e) => {
    setState({ sort: (e.target as HTMLSelectElement).value as Sort }, false);
    renderList();
  };
  filterRow.appendChild(sortSelect);

  const folderSelect = document.createElement('select');
  const rootOpt = document.createElement('option');
  rootOpt.value = '';
  rootOpt.textContent = t('folder.all');
  if (!state.folderFilter) rootOpt.selected = true;
  folderSelect.appendChild(rootOpt);
  state.library.folders.forEach((f) => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = folderName(f.id);
    if (state.folderFilter === f.id) opt.selected = true;
    folderSelect.appendChild(opt);
  });
  folderSelect.onchange = (e) => {
    const val = (e.target as HTMLSelectElement).value;
    setState({ folderFilter: val || undefined }, false);
    renderList();
  };
  filterRow.appendChild(folderSelect);

  const addFolderBtn = document.createElement('button');
  addFolderBtn.className = 'pm-btn secondary';
  addFolderBtn.textContent = t('folder.new');
  addFolderBtn.onclick = async () => {
    const name = prompt(t('folder.new'));
    if (!name) return;
    await upsertFolder({ name, parentId: state.folderFilter });
    await refreshLibrary();
    showMessage(t('toast.createdFolder'));
  };
  filterRow.appendChild(addFolderBtn);

  section.appendChild(filterRow);

  const list = document.createElement('div');
  list.className = 'pm-list';

  const renderList = () => {
    list.innerHTML = '';
    const prompts = filteredPrompts();
    if (!prompts.length) {
      const empty = document.createElement('div');
      empty.className = 'pm-muted';
      empty.textContent = t('library.empty');
      list.appendChild(empty);
      return;
    }
    prompts.forEach((p) => {
      const item = document.createElement('div');
      item.className = 'pm-item';
      const titleRow = document.createElement('div');
      titleRow.className = 'pm-item-title';
      const title = document.createElement('div');
      title.textContent = p.title;
      const meta = document.createElement('div');
      meta.className = 'pm-inline';
      const favToggle = document.createElement('button');
      favToggle.className = 'pm-btn secondary';
      favToggle.textContent = p.favorite ? '★' : '☆';
      favToggle.onclick = async () => {
        await toggleFavorite(p.id);
        await refreshLibrary();
      };
      meta.appendChild(favToggle);
      titleRow.append(title, meta);
      item.appendChild(titleRow);

      const tagRow = document.createElement('div');
      tagRow.className = 'pm-inline';
      if (p.tags?.length) {
        p.tags.forEach((t) => {
          const tag = document.createElement('span');
          tag.className = 'pm-tag';
          tag.textContent = t;
          tagRow.appendChild(tag);
        });
      }
      const badge = document.createElement('span');
      badge.className = 'pm-badge';
      badge.textContent = `${folderName(p.folderId)} · ${t('library.use', { count: p.useCount || 0 })}`;
      tagRow.appendChild(badge);
      item.appendChild(tagRow);

      const content = document.createElement('div');
      content.className = 'pm-muted';
      content.textContent = p.content.slice(0, 140) + (p.content.length > 140 ? '…' : '');
      item.appendChild(content);

      const actions = document.createElement('div');
      actions.className = 'pm-actions';
      const writeBtn = document.createElement('button');
      writeBtn.className = 'pm-btn';
      writeBtn.textContent = t('btn.write');
      writeBtn.onclick = async () => {
        const ok = writeToInput(p.content);
        if (!ok) {
          navigator.clipboard?.writeText(p.content);
          showMessage(t('toast.copy'));
        } else {
          await touchUseStats(p.id);
          await refreshLibrary();
          showMessage(t('toast.wrote'));
        }
      };

      const editBtn = document.createElement('button');
      editBtn.className = 'pm-btn secondary';
      editBtn.textContent = t('btn.edit');
      editBtn.onclick = () =>
        setState({
          route: 'savePrompt',
          drawerOpen: true,
          savePromptDraft: {
            id: p.id,
            title: p.title,
            content: p.content,
            folderId: p.folderId,
            tags: (p.tags || []).join(','),
            favorite: p.favorite
          }
        });

      const delBtn = document.createElement('button');
      delBtn.className = 'pm-btn secondary';
      delBtn.textContent = t('btn.delete');
      delBtn.onclick = async () => {
        if (!confirm(t('confirm.deletePrompt'))) return;
        await deletePrompt(p.id);
        await refreshLibrary();
      };

      actions.append(writeBtn, editBtn, delBtn);
      item.appendChild(actions);
      list.appendChild(item);
    });
  };

  search.oninput = (e) => {
    setState({ searchTerm: (e.target as HTMLInputElement).value }, false);
    renderList();
  };

  section.appendChild(list);
  body.appendChild(section);
  renderList();
}

function renderSavePrompt(body: HTMLElement): void {
  const section = document.createElement('div');
  section.className = 'pm-section';

  const titleInput = document.createElement('input');
  titleInput.value = state.savePromptDraft.title;
  titleInput.oninput = (e) =>
    setState({ savePromptDraft: { ...state.savePromptDraft, title: (e.target as HTMLInputElement).value } }, false);
  section.appendChild(createField(t('save.title'), titleInput));

  const contentArea = document.createElement('textarea');
  contentArea.value = state.savePromptDraft.content;
  contentArea.oninput = (e) =>
    setState({ savePromptDraft: { ...state.savePromptDraft, content: (e.target as HTMLTextAreaElement).value } }, false);
  section.appendChild(createField(t('save.content'), contentArea));

  const tagsInput = document.createElement('input');
  tagsInput.placeholder = t('save.tagsPlaceholder');
  tagsInput.value = state.savePromptDraft.tags;
  tagsInput.oninput = (e) =>
    setState({ savePromptDraft: { ...state.savePromptDraft, tags: (e.target as HTMLInputElement).value } }, false);
  section.appendChild(createField(t('save.tags'), tagsInput));

  const favoriteToggle = document.createElement('input');
  favoriteToggle.type = 'checkbox';
  favoriteToggle.checked = state.savePromptDraft.favorite;
  favoriteToggle.onchange = (e) =>
    setState({ savePromptDraft: { ...state.savePromptDraft, favorite: (e.target as HTMLInputElement).checked } }, false);
  const favWrap = document.createElement('div');
  favWrap.className = 'pm-input-inline';
  favWrap.append(favoriteToggle, document.createTextNode(t('save.favorite')));
  section.appendChild(createField(t('save.favorite'), favWrap));

  const folderSelect = document.createElement('select');
  const rootOpt = document.createElement('option');
  rootOpt.value = '';
  rootOpt.textContent = t('folder.root');
  folderSelect.appendChild(rootOpt);
  state.library.folders.forEach((f) => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = folderName(f.id);
    if (state.savePromptDraft.folderId === f.id) opt.selected = true;
    folderSelect.appendChild(opt);
  });
  folderSelect.onchange = (e) =>
    setState({
      savePromptDraft: { ...state.savePromptDraft, folderId: (e.target as HTMLSelectElement).value || undefined }
    }, false);
  section.appendChild(createField(t('save.folder'), folderSelect));

  const actions = document.createElement('div');
  actions.className = 'pm-actions';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'pm-btn';
  saveBtn.textContent = t('btn.save');
  saveBtn.onclick = async () => {
    if (!state.savePromptDraft.title.trim() || !state.savePromptDraft.content.trim()) {
      showMessage(t('toast.validation'));
      return;
    }
    await upsertPrompt({
      id: state.savePromptDraft.id,
      title: state.savePromptDraft.title,
      content: state.savePromptDraft.content,
      folderId: state.savePromptDraft.folderId,
      tags: state.savePromptDraft.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      favorite: state.savePromptDraft.favorite
    });
    await refreshLibrary();
    setState({ route: 'library' });
    showMessage(t('toast.saved'));
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'pm-btn secondary';
  cancelBtn.textContent = t('btn.cancel');
  cancelBtn.onclick = () => setState({ route: 'library' });

  actions.append(saveBtn, cancelBtn);
  section.appendChild(actions);
  body.appendChild(section);
}

function renderSettings(body: HTMLElement): void {
  const section = document.createElement('div');
  section.className = 'pm-section';

  const langInput = document.createElement('input');
  langInput.value = state.settings.preferredLanguage || '';
  langInput.placeholder = t('placeholder.prefLang');
  langInput.oninput = (e) =>
    setState({ settings: { ...state.settings, preferredLanguage: (e.target as HTMLInputElement).value } }, false);
  section.appendChild(createField(t('settings.prefLang'), langInput));

  const toneInput = document.createElement('input');
  toneInput.value = state.settings.tone || '';
  toneInput.placeholder = t('placeholder.tone');
  toneInput.oninput = (e) => setState({ settings: { ...state.settings, tone: (e.target as HTMLInputElement).value } }, false);
  section.appendChild(createField(t('settings.tone'), toneInput));

  const qualityInput = document.createElement('input');
  qualityInput.value = state.settings.qualityBar || '';
  qualityInput.oninput = (e) =>
    setState({ settings: { ...state.settings, qualityBar: (e.target as HTMLInputElement).value } }, false);
  section.appendChild(createField(t('settings.quality'), qualityInput));

  const uiLangSelect = document.createElement('select');
  ['zh', 'en'].forEach((lng) => {
    const opt = document.createElement('option');
    opt.value = lng;
    opt.textContent = lng === 'zh' ? '简体中文' : 'English';
    if (state.settings.uiLanguage === lng) opt.selected = true;
    uiLangSelect.appendChild(opt);
  });
  uiLangSelect.onchange = (e) => {
    const lng = (e.target as HTMLSelectElement).value as Locale;
    setState({ settings: { ...state.settings, uiLanguage: lng } }, false);
    applyBuilderLocale(lng);
    render();
  };
  section.appendChild(createField(t('settings.uiLanguage'), uiLangSelect));

  const actions = document.createElement('div');
  actions.className = 'pm-actions';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'pm-btn';
  saveBtn.textContent = t('btn.saveSettings');
  saveBtn.onclick = async () => {
    await setSettings(state.settings);
    await refreshLibrary();
    showMessage(t('toast.savedSettings'));
  };
  actions.appendChild(saveBtn);
  section.appendChild(actions);

  const importExportSection = document.createElement('div');
  importExportSection.className = 'pm-section';
  const exportBtn = document.createElement('button');
  exportBtn.className = 'pm-btn secondary';
  exportBtn.textContent = t('btn.export');
  exportBtn.onclick = async () => {
    const bundle = await requestExport();
    const text = JSON.stringify(bundle, null, 2);
    await navigator.clipboard?.writeText(text);
    showMessage(t('toast.exportCopied'));
  };

  const importTextarea = document.createElement('textarea');
  importTextarea.placeholder = t('import.placeholder');

  const mergeBtn = document.createElement('button');
  mergeBtn.className = 'pm-btn';
  mergeBtn.textContent = t('btn.merge');
  mergeBtn.onclick = async () => {
    try {
      await requestImport(importTextarea.value, 'merge');
      await refreshLibrary();
      showMessage(t('toast.importMerge'));
    } catch (err) {
      showMessage(String(err));
    }
  };

  const overwriteBtn = document.createElement('button');
  overwriteBtn.className = 'pm-btn danger';
  overwriteBtn.textContent = t('btn.overwrite');
  overwriteBtn.onclick = async () => {
    if (!confirm(t('confirm.overwrite'))) return;
    try {
      await requestImport(importTextarea.value, 'overwrite');
      await refreshLibrary();
      showMessage(t('toast.importOverwrite'));
    } catch (err) {
      showMessage(String(err));
    }
  };

  importExportSection.appendChild(exportBtn);
  importExportSection.appendChild(createField(t('import.label'), importTextarea));
  const importActions = document.createElement('div');
  importActions.className = 'pm-actions';
  importActions.append(mergeBtn, overwriteBtn);
  importExportSection.appendChild(importActions);

  body.append(section, importExportSection);
}

function renderDrawer(): void {
  drawer.className = `pm-drawer ${state.drawerOpen ? 'open' : ''}`;
  const header = document.createElement('header');
  const title = document.createElement('h2');
  const titles: Record<Route, string> = {
    builder: t('title.builder'),
    optimizer: t('title.optimizer'),
    library: t('title.library'),
    settings: t('title.settings'),
    savePrompt: t('title.savePrompt')
  };
  title.textContent = titles[state.route];
  const close = document.createElement('button');
  close.className = 'pm-close';
  close.textContent = '×';
  close.onclick = () => setState({ drawerOpen: false });
  header.append(title, close);

  const body = document.createElement('div');
  body.className = 'pm-body';
  switch (state.route) {
    case 'builder':
      renderBuilder(body);
      break;
    case 'optimizer':
      renderOptimizer(body);
      break;
    case 'library':
      renderLibrary(body);
      break;
    case 'settings':
      renderSettings(body);
      break;
    case 'savePrompt':
      renderSavePrompt(body);
      break;
  }

  drawer.innerHTML = '';
  drawer.append(header, body);
  if (!drawer.isConnected) root.appendChild(drawer);
}

function render(): void {
  renderOrb();
  renderRadial();
  renderDrawer();
  renderToast();
}

function startDrag(): void {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  orb.addEventListener('mousedown', (e) => {
    dragging = true;
    offsetX = e.clientX - state.position.x;
    offsetY = e.clientY - state.position.y;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    state.position = { x, y };
    renderOrb();
    renderRadial();
  });
  window.addEventListener('mouseup', async () => {
    if (!dragging) return;
    dragging = false;
    const updatedSettings = { ...state.settings, iconPosition: state.position };
    setState({ settings: updatedSettings }, false);
    await setSettings(updatedSettings);
  });
}

function ensureIconNearInput(): void {
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
  setTimeout(() => observer.disconnect(), 8000);
}

async function refreshLibrary(): Promise<void> {
  const [folders, prompts, settings] = await Promise.all([getFolders(), getPrompts(), getSettings()]);
  const profile = buildPreferenceProfile(settings, prompts);
  state = { ...state, library: { folders, prompts }, settings, preferenceProfile: profile };
  applyBuilderLocale(settings.uiLanguage === 'en' ? 'en' : 'zh');
  render();
}

async function init(): Promise<void> {
  orb.onclick = () => setState({ radialOpen: !state.radialOpen });
  startDrag();
  await refreshLibrary();
  const position = state.settings.iconPosition ?? computeDefaultIconPosition();
  setState({ position });
  render();
  ensureIconNearInput();

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'OPEN_SAVE_PROMPT') {
      const payload = msg.payload as { title: string; content: string };
      setState({
        drawerOpen: true,
        route: 'savePrompt',
        savePromptDraft: {
          title: payload.title,
          content: payload.content,
          tags: 'imported',
          favorite: false
        }
      });
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });
}

async function requestExport(): Promise<ExportBundle> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'EXPORT_DATA' }, (res) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError.message);
      if (res?.ok) return resolve(res.bundle as ExportBundle);
      return reject(res?.error || t('error.export'));
    });
  });
}

async function requestImport(json: string, strategy: 'merge' | 'overwrite'): Promise<void> {
  return new Promise((resolve, reject) => {
    let bundle: ExportBundle;
    try {
      bundle = JSON.parse(json);
    } catch (err) {
      reject(t('error.json'));
      return;
    }
    chrome.runtime.sendMessage({ type: 'IMPORT_DATA', payload: { bundle, strategy } }, (res) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError.message);
      if (res?.ok) return resolve();
      reject(res?.error || t('error.import'));
    });
  });
}

init().catch((err) => console.error('Prompt manager init error', err));
