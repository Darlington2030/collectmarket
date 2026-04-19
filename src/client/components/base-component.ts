import { LitElement } from 'lit';
import { store } from '../store/app-store.js';
import type { AppState } from '../types/index.js';

export abstract class BaseComponent extends LitElement {
  private _unsub?: () => void;

  /** Render into light DOM so Tailwind utility classes work */
  override createRenderRoot() { return this; }

  override connectedCallback() {
    super.connectedCallback();
    this._unsub = store.subscribe(() => this.requestUpdate());
    this.requestUpdate();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
  }

  protected get state(): Readonly<AppState> { return store.getState(); }
  protected dispatch(a: Parameters<typeof store.dispatch>[0]) { store.dispatch(a); }

  protected $$(price: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(price);
  }

  protected ago(iso: string) {
    const m = Math.floor((Date.now() - +new Date(iso)) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  }
}
