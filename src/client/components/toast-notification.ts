import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { LitElement } from 'lit';

type TType = 'success' | 'error' | 'info';
interface Toast { id: string; msg: string; type: TType; }

@customElement('toast-notification')
export class ToastNotification extends LitElement {
  @state() private _list: Toast[] = [];
  override createRenderRoot() { return this; }

  show(msg: string, type: TType = 'info') {
    const id = Math.random().toString(36).slice(2);
    this._list = [...this._list, { id, msg, type }];
    setTimeout(() => this._rm(id), 4000);
  }

  private _rm(id: string) { this._list = this._list.filter(t => t.id !== id); }

  private _cls(t: TType) {
    const base = 'flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl backdrop-blur-md transition-all';
    if (t === 'success') return `${base} bg-emerald-500/12 border-emerald-500/32 text-emerald-300`;
    if (t === 'error')   return `${base} bg-red-500/12 border-red-500/32 text-red-300`;
    return                      `${base} bg-amber-500/12 border-amber-500/32 text-amber-300`;
  }

  override render() {
    return html`
      <div class="fixed bottom-5 right-4 sm:right-5 z-[300] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-32px)] sm:max-w-sm" role="status" aria-live="polite">
        ${this._list.map(t => html`
          <div class="${this._cls(t.type)} pointer-events-auto" style="animation:toastIn .28s ease-out">
            <span>${t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : '◈'}</span>
            <span class="flex-1">${t.msg}</span>
            <button @click=${() => this._rm(t.id)} class="opacity-55 hover:opacity-90 bg-transparent border-none cursor-pointer text-inherit text-xs ml-1">✕</button>
          </div>`)}
      </div>
      <style>@keyframes toastIn{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}</style>`;
  }
}
