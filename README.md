# ChatGPT Prompt Manager (Chrome Extension)

Chrome MV3 extension that adds a floating prompt builder/optimizer/library to chatgpt.com & chat.openai.com. All data stays in `chrome.storage.local`; no network requests or telemetry.

## Quick start
1. Install deps: `npm install`
2. Build: `npm run build`
3. Load in Chrome: `chrome://extensions` -> Enable Developer Mode -> Load unpacked -> select `dist/`.

## Features
- Floating orb (draggable, position saved) with radial menu (Builder / Optimizer / Library / Settings).
- Right-side drawer for all pages; state persists when closed.
- ChatGPT input helper works with textarea or contenteditable; writes and dispatches `input` events (fallback copies if input not found).
- Prompt Library: folders (with parentId), tags, favorites, search, filters (all/favorites/recent), sorting, usage stats, write to input, edit/delete.
- Builder: fields for Role/Goal/TaskType/Context/OutputSchema/QualityBar/Constraints/InteractionContract with live preview; write to input or save to library.
- Optimizer: uses local preference profile + current draft only (no chat history); generates optimization request and supports paste-back to input.
- Context menu on ChatGPT pages: “添加到 Prompt 库…” pre-fills Save Prompt with selected text.
- Import/Export JSON (merge with new IDs or overwrite after confirmation); available in drawer Settings and options page.

## Privacy
- No remote requests or telemetry.
- All prompts, folders, and settings are stored locally via `chrome.storage.local`.

## Options page
Accessible via extension details -> Options. Supports importing/exporting JSON, editing preference settings, and clearing data.
