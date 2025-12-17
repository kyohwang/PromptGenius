type InputEl = HTMLTextAreaElement | HTMLElement;

const INPUT_SELECTORS = [
  'div#prompt-textarea.ProseMirror',
  'div#prompt-textarea',
  'div.ProseMirror[contenteditable="true"]',
  'textarea#prompt-textarea',
  'textarea[data-id]',
  'textarea[data-testid]',
  'textarea[aria-label]',
  'textarea[placeholder*="Send a message"]',
  'textarea[placeholder*="Message ChatGPT"]',
  'form textarea',
  'div[contenteditable="true"][data-id]',
  'div[contenteditable="true"][data-testid]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"][aria-label]'
];

function findCandidate(): InputEl | null {
  for (const selector of INPUT_SELECTORS) {
    const el = document.querySelector(selector) as InputEl | null;
    if (el) return el;
  }
  const formFallback = Array.from(document.querySelectorAll('form')).find((form) => form.querySelector('textarea'));
  if (formFallback) return (formFallback.querySelector('textarea') as HTMLTextAreaElement | null) ?? null;
  return null;
}

export function findChatGPTInput(): InputEl | null {
  return findCandidate();
}

export function readInput(): string {
  const el = findChatGPTInput();
  if (!el) return '';
  if (el instanceof HTMLTextAreaElement) return el.value || '';
  return el.textContent || '';
}

function dispatchInput(el: InputEl): void {
  const event = new InputEvent('input', { bubbles: true, data: el instanceof HTMLTextAreaElement ? el.value : el.textContent || '', inputType: 'insertText' });
  el.dispatchEvent(event);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function findSendButton(): HTMLButtonElement | null {
  const selectors = [
    'button[data-testid="send-button"]',
    'button[aria-label*="发送"]',
    'button[aria-label*="send"]',
    'form button[type="submit"]'
  ];
  for (const selector of selectors) {
    const btn = document.querySelector(selector) as HTMLButtonElement | null;
    if (btn) return btn;
  }
  return null;
}

export function writeToInput(text: string): boolean {
  const el = findChatGPTInput();
  if (!el) return false;
  const applyText = (node: HTMLElement) => {
    // ProseMirror prefers <p> wrappers; fall back to textContent if blocked.
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
      /* ignore selection errors */
    }
    dispatchInput(el);
    return true;
  }
  el.focus();
  applyText(el);
  dispatchInput(el);
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  return true;
}

export function submitInput(): boolean {
  const btn = findSendButton();
  if (!btn) return false;
  btn.click();
  return true;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return ch;
    }
  });
}

export function computeDefaultIconPosition(): { x: number; y: number } {
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

export function watchForInput(cb: (el: InputEl) => void): MutationObserver {
  const observer = new MutationObserver(() => {
    const el = findChatGPTInput();
    if (el) cb(el);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}
