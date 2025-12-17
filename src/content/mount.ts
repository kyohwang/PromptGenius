import { shadowStyles } from './styles';

const HOST_ID = 'pm-chatgpt-prompt-manager';

export function mountShell(): { shadow: ShadowRoot; root: HTMLElement } {
  const existing = document.getElementById(HOST_ID);
  if (existing && existing.shadowRoot) {
    const root = existing.shadowRoot.querySelector('.pm-root') as HTMLElement;
    return { shadow: existing.shadowRoot, root };
  }

  const host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = shadowStyles;
  const root = document.createElement('div');
  root.className = 'pm-root';
  shadow.append(style, root);
  document.body.appendChild(host);
  return { shadow, root };
}
