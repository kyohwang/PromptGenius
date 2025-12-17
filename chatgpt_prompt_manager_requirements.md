# ChatGPT Prompt 管理 Chrome 插件（V1）需求文档与技术规格

> 版本：V1（可交付编码）  
> 日期：2025-12-16  
> 数据策略：**所有数据仅存浏览器本地（无服务器、无远程同步）**  
> 生效域名：`chatgpt.com` + `chat.openai.com`

---

## 1. 背景与目标

### 1.1 背景
用户在使用 ChatGPT 时，需要一个便捷工具来：
- 快速生成高质量 Prompt（结构化、可复用）
- 将输入框里的“草稿”快速优化为更好的 Prompt
- 本地管理 Prompt（目录 + 标签 + 搜索 + 收藏）
- 在 ChatGPT 页面里选中文本，右键一键保存为 Prompt

### 1.2 目标（Goals）
1. ChatGPT 会话页面出现可拖动悬浮 icon，通过环形菜单进入各功能。
2. 所有核心功能都在统一的 **右侧抽屉（Right Drawer）** 中完成（生成 / 优化 / 库 / 设置 / 保存）。
3. Prompt 库支持：目录树 + 标签 + 搜索 + 收藏 + 最近使用 + 一键写入输入框。
4. 右键“添加到 Prompt 库…”仅在 ChatGPT 页面出现，并支持保存选中文本。
5. “快速优化”功能：仅使用本地 Prompt 库与本地行为统计归纳出的 **偏好画像**；不读取 ChatGPT 对话内容；不发送历史 Prompt 原文。

### 1.3 非目标（Non-goals）
- 不建设任何后端服务，不做登录/账号体系。
- 不做跨设备同步（可通过 JSON 导入导出解决迁移需求）。
- V1 不做“自动发送消息”与“自动解析对话回复”的强自动化（优化结果回填采用粘贴/剪贴板方式，隐私更强、稳定性更高）。
- V1 不要求在非 ChatGPT 网站上工作（右键与注入均限制在 ChatGPT 域名）。

---

## 2. 生效范围与约束

### 2.1 生效域名
- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

### 2.2 右键菜单范围
- **仅在 ChatGPT 页面**显示右键菜单项：`添加到 Prompt 库…`

### 2.3 数据与隐私约束（必须满足）
- 所有数据仅保存在本地（`chrome.storage.local` / `IndexedDB`）。
- 插件不读取 ChatGPT 对话内容（messages 区域）用于优化。
- 快速优化不发送任何历史 Prompt 原文；只允许发送“偏好画像（规则化描述） + 当前草稿”。

---

## 3. 用户故事（User Stories）

1. 作为用户，我想在 ChatGPT 输入框附近点击一个悬浮按钮，快速打开工具。
2. 作为用户，我想通过向导式表单（但一屏完成）快速生成结构化 Prompt，并写入输入框。
3. 作为用户，我想把输入框里的草稿变成“更专业的 Prompt”，并在同一抽屉里看到要发送的偏好画像。
4. 作为用户，我想浏览我保存的 Prompt（按目录和标签），并一键写入输入框复用。
5. 作为用户，我想在 ChatGPT 页面里选中一段文字，右键保存为 Prompt，并选择目录/标签。
6. 作为用户，我想在设置里管理目录与 Prompt，并能导入/导出 JSON 备份迁移。

---

## 4. 全局 UI 设计（ChatGPT 页面内）

### 4.1 悬浮 Icon（Floating Orb）
**行为**
- 默认悬浮在输入框区域右侧内边（不遮挡输入）。
- 可拖动到任意位置；记住位置（本地保存）。
- 若找不到输入框：降级固定在右下角（距边 24px）。
- 单击：打开/关闭环形菜单。
- 拖动：半透明 + 边缘吸附提示；若开启“吸附输入框”，靠近输入框时自动吸附。

**状态**
- 正常：可点开菜单
- 错误：显示小红点（如找不到输入框或写入失败）

### 4.2 环形菜单（Radial Menu）
- 4 个扇区按钮：
  1) 生成 Prompt（Builder）
  2) 快速优化（Optimizer）
  3) Prompt 库（Library）
  4) 设置（Settings）
- 自动防出屏：根据 icon 所在屏幕象限选择展开方向；必要时缩小半径。
- 点击扇区：打开右侧抽屉对应页面，并收起环形菜单。
- 点击空白 / Esc：收起菜单。

### 4.3 右侧抽屉（Right Drawer）
统一承载全部功能页面：
- Builder / Optimizer / Library / Settings / Save Prompt
- Header 固定：标题 + `?`帮助 + `×`关闭
- Body 可滚动
- Footer（按页面需要出现）：主 CTA / 次 CTA

**默认宽度**：400px（可在设置中提供 360/400/460 三档）

### 4.4 全局提示
- Toast：写入成功/保存成功/错误提示
- 抽屉 Banner：隐私承诺（尤其在 Optimizer 页面）

---

## 5. 功能页面（控件级需求）

## 5.1 Builder：生成 Prompt（一屏表单 + 7 要素）

### 5.1.1 页面结构
- Header：`生成 Prompt` + `?` + `×`
- Body：
  - 模板区（小条）
  - 表单区（7 要素）
  - 预览区（实时预览，默认展开）
- Footer：
  - 主：`写入输入框`（覆盖输入框；不自动发送；不自动保存）
  - 次：`保存到库…`（打开 Save Prompt 子页面并预填）

### 5.1.2 表单字段（7 要素）
> 模板参考：你提供的“高效 Prompt 7 大核心要素”。

1) 角色 Role（可选）
- 单行输入

2) 任务/目标（必填）
- 多行输入（2–4 行）
- 校验：为空则禁止写入

3) 任务类型 Task Type（强建议）
- 下拉：分析/审查/设计/解释/批判 + 自定义
- 开关：`只做一种任务类型（推荐）`（默认开）

4) 输入边界 Context（可选但推荐）
- 多行输入（4–6 行），占位提示包含：已知/未知/无需考虑

5) 输出结构 Output Schema（强推荐）
- 多行输入（4–6 行）
- 小下拉“结构模板”用于快速填充常用结构

6) 质量标准 Quality Bar（推荐）
- 多行输入（3–5 行）
- 可点选 chips 快速追加常用质量标准（如“每条结论必须对应依据”“禁止空话”）

7) 约束与禁止项 Constraints（推荐）
- 多行输入（3–5 行）
- chips：禁止输出未要求内容/禁止模糊词/禁止修改代码/禁止给结论等

8) 交互方式 Interaction Contract（可选但建议默认有）
- 多行输入（3–5 行）
- 快捷开关：
  - 信息不足先提问（默认开）+ 数量 1–5（默认 3）
  - 多假设并列（默认开）

> 注：虽然 7 要素中不单列“输出语言/风格”，可作为“质量标准/约束”的可选附加项或放在模板区。

### 5.1.3 预览区
- 只读代码块，实时更新
- 按钮：复制
- 生成规则：
  - 每个已填写字段按段输出；未填字段不输出（除任务必填）
  - 结构清晰、可复用、含交互约束

### 5.1.4 写入输入框（默认覆盖）
- 写入成功：Toast `已写入输入框`
- 找不到输入框：Toast `未检测到输入框（可复制后手动粘贴）` 并高亮“复制”按钮

---

## 5.2 Optimizer：快速优化（仅发送偏好画像 + 草稿）

### 5.2.1 核心原则（必须遵守）
- 不读取 ChatGPT 对话内容
- 不发送历史 Prompt 原文
- 只发送：
  - 本地偏好画像（规则化描述）
  - 当前输入框草稿

### 5.2.2 页面结构
- Header：`快速优化`
- Banner（固定展示）：
  - `✅ 不读取对话内容`
  - `✅ 不发送历史 Prompt 原文`
  - `✅ 仅发送：偏好画像 + 当前草稿`
- Body：
  - 草稿检测区（读取输入框）
  - 优化目标区（语言/结构/详细程度/开关）
  - 偏好画像预览区（透明化）
  - 优化请求预览区（只读）
  - 回填区（粘贴或剪贴板读取优化结果）
- Footer：
  - 主：`写入优化请求到输入框`（覆盖输入框）

### 5.2.3 草稿检测区
- 展示当前输入框内容预览（可折叠）
- 按钮：`刷新读取`
- 空草稿：展示空态，提供跳转按钮到 Builder/Library

### 5.2.4 偏好画像预览区
- 展示将用于生成优化请求的偏好画像（纯规则，不含原文）
- 按钮：`编辑偏好…`（跳转 Settings → 偏好）

### 5.2.5 优化请求预览区
- 展示最终要写入输入框的“优化请求 Prompt”
- 支持复制

### 5.2.6 回填区（不读对话的安全方案）
- 多行输入：用户粘贴 ChatGPT 返回的“优化后的 Prompt”
- 按钮：`从剪贴板读取`（用户触发）
- 主按钮：`回填到输入框`（覆盖）
- 次按钮：`保存到库…`

---

## 5.3 Library：Prompt 库（目录 + 标签）

### 5.3.1 页面结构
- Header：`Prompt 库` + `+ Prompt` + `+ 文件夹` + `×`
- Body：
  - 搜索框（标题/内容/标签）
  - 过滤 chips：全部/收藏/最近使用
  - 排序下拉：最近更新/最近使用/标题
  - 目录树（折叠面板）
  - Prompt 列表
- Prompt 详情页（抽屉二级页）：
  - 标题、目录、标签、内容编辑
  - 写入输入框/复制/保存修改/删除

### 5.3.2 目录管理
- 新建/重命名/删除
- 删除非空目录：提示并提供策略
  - 删除目录并移动内容到“未分类”（默认）

### 5.3.3 Prompt 列表项控件
- 标题 + 摘要 + 标签 chips（最多 3 个）+ 收藏星标
- 快捷按钮：`写入`
- 更多菜单：复制/编辑/移动/删除

### 5.3.4 写入行为
- 默认覆盖输入框
- 写入成功后更新：
  - `useCount += 1`
  - `lastUsedAt = now`

---

## 5.4 Settings：设置（抽屉内）+ Options Page（扩展独立设置页）

### 5.4.1 抽屉 Settings（轻量）
分 Tab：
- 偏好设置（Preferences）
- 数据管理（Data）

#### Preferences（偏好）
- 写入方式：覆盖（V1 固定为覆盖；追加/插入可以展示为灰化选项）
- 写入后聚焦输入框：开
- Builder 默认值：模板/交互合同默认开关
- Optimizer 默认值：语言/详细程度/禁止空话/禁止模糊词
- 悬浮 icon：
  - 吸附输入框：开
  - 记住拖动位置：开
  - 重置位置按钮

#### Data（数据）
- 导出 JSON（V1 必做）
- 导入 JSON（合并/覆盖策略；默认合并）
- 显示本地占用估算
- 清空所有数据（危险操作：二次确认）

### 5.4.2 Options Page（扩展独立设置页）
用于重管理与批量操作：
- 更完整的库管理（批量移动/删除、多选）
- 导入导出
- 数据统计/版本信息
- 重置

> V1 可先做抽屉 Data（已满足），Options Page 做同等功能即可，UI 可更宽更适合批量操作。

---

## 5.5 Save Prompt：保存 Prompt（用于右键保存与 Builder/Optimizer 保存）

### 5.5.1 页面结构
- 标题：`保存到 Prompt 库`
- 字段：
  - 目录选择（下拉 + 新建目录）
  - 标题（必填；默认取内容前 20 字）
  - 标签（可选；自动补全）
  - 内容（大文本；预填）
- Footer：
  - 主：保存
  - 次：保存并写入输入框（可选）

---

## 6. 模板与文案（关键）

## 6.1 Builder 输出模板（默认）
将填写内容组织为可复用 prompt，结构建议如下（可实现为纯字符串拼接）：

- 角色：{role}
- 任务：{goal}
- 任务类型：{taskType}（本次只执行该任务类型，不扩展其他方向）
- 输入边界：{context}
- 输出结构：{outputSchema}
- 质量标准：{qualityBar}
- 约束与禁止项：{constraints}
- 交互方式：{interactionContract}

未填写的段落不输出（任务必填）。

## 6.2 Optimizer “优化请求 Prompt”模板（默认）
> 必须只包含：偏好画像（规则化） + 当前草稿。不得包含历史 prompt 原文。

建议模板：

- 你是一名 Prompt 工程师。
- 目标：将“草稿”优化为高质量 Prompt。
- 请严格按我的偏好画像生成最终 Prompt。
- **只输出最终 Prompt，不要解释。**
- （可选）用 ```text 包裹输出，便于复制。

偏好画像：
{preferenceProfile}

草稿：
<<<
{draft}
>>>

---

## 7. 本地数据结构（JSON 级）

### 7.1 Folder
- id: string
- name: string
- parentId: string|null
- createdAt: number
- updatedAt: number

### 7.2 Prompt
- id: string
- title: string
- content: string
- folderId: string
- tags: string[]
- createdAt: number
- updatedAt: number
- lastUsedAt: number|null
- useCount: number
- isFavorite: boolean
- source:
  - type: "selection" | "builder" | "manual" | "import"
  - url?: string
  - createdOnDomain?: "chatgpt.com" | "chat.openai.com"

### 7.3 Settings
- schemaVersion: number
- iconPosition:
  - mode: "anchorInput" | "free"
  - x?: number
  - y?: number
- writeBehavior: "overwrite"
- builderDefaults:
  - templateId: string
  - askClarify: boolean
  - clarifyCount: number
  - multiAssumption: boolean
- optimizerDefaults:
  - language: "zh"|"en"
  - detailLevel: "concise"|"standard"|"detailed"
  - banFluff: boolean
  - banVague: boolean

### 7.4 导入导出 JSON 格式
导出内容包含：
- schemaVersion
- exportedAt
- folders[]
- prompts[]
- settings
- tagIndex（可选）

导入策略：
- 合并（默认）：ID 冲突则重写新 ID，目录同名默认创建副本目录
- 覆盖：清空后写入

---

## 8. 权限与 Manifest（设计要求）

**必须**
- `storage`
- `contextMenus`
- `host_permissions`：
  - `https://chatgpt.com/*`
  - `https://chat.openai.com/*`
- content_scripts 或 `scripting` 注入 UI

**不需要**
- 任何网络权限
- 读取全站点权限

---

## 9. 边界与降级策略

- 找不到输入框：允许复制预览内容；Toast 提示；icon 显示错误点。
- 不读取对话：优化回填采用粘贴/剪贴板读取方案。
- 数据丢失风险：设置页展示提示；V1 必须提供导出备份。

---

## 10. 验收清单（QA）

- 悬浮 icon 出现、可拖动、位置可记忆
- 环形菜单 4 扇区可用且不出屏
- Builder：必填校验、预览实时、写入覆盖成功
- Optimizer：草稿读取、偏好画像透明化、生成请求写入、回填可用
- Library：目录/标签/搜索/收藏/写入/使用统计更新
- 右键保存：选中文本保存成功，目录/标签可选
- 导入导出：JSON 可用；合并与覆盖策略正确

---

## 附录 A：你提供的“高效 Prompt 7 要素”摘要（用于帮助文案）
1) 角色 Role：具体、有边界  
2) 任务类型 Task Type：一次只做一种任务类型  
3) 输入边界 Context：已知/未知但重要/无需考虑  
4) 输出结构 Output Schema：明确层级与顺序  
5) 质量标准 Quality Bar：每条结论要有依据；禁止空话  
6) 约束与禁止项 Constraints：越会用越会“禁止”  
7) 交互方式 Interaction Contract：信息不足先提问；多假设并列  

