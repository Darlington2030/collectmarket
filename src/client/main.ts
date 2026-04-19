import './components/auth-modal.js';
import './components/header-auth.js';
import './components/search-bar.js';
import './components/item-card.js';
import './components/item-grid.js';
import './components/list-item-modal.js';
import './components/chat-panel.js';
import './components/item-detail-modal.js';
import './components/toast-notification.js';

import { store } from './store/app-store.js';
import { messagesApi } from './utils/api.js';

class App {
  private detail!: HTMLElement & { openForItem(i: unknown): void };
  private list!:   HTMLElement & { open(): void };
  private toast!:  HTMLElement & { show(msg: string, type?: string): void };
  private _unreadInterval?: ReturnType<typeof setInterval>;

  init() {
    this.detail = document.querySelector('item-detail-modal') as any;
    this.list   = document.querySelector('list-item-modal')   as any;
    this.toast  = document.querySelector('toast-notification') as any;
    this._wire();
    this._pollUnread();
  }

  private _wire() {
    // open-chat is now handled directly by <chat-panel> component itself

    // Open detail modal
    window.addEventListener('open-detail', (e: Event) => {
      this.detail?.openForItem((e as CustomEvent).detail);
    });

    // Auth gate
    window.addEventListener('require-auth', () => {
      window.dispatchEvent(new CustomEvent('open-auth', { detail: { tab: 'login' } }));
    });

    // Toast events
    window.addEventListener('toast', (e: Event) => {
      const { msg, type } = (e as CustomEvent).detail ?? {};
      this.toast?.show(msg, type);
    });

    // Login success toast
    window.addEventListener('user-logged-in', (e: Event) => {
      const u = (e as CustomEvent).detail;
      this.toast?.show(`Welcome, ${u.name}! 👋`, 'success');
    });

    // List Item button
    document.getElementById('list-item-btn')?.addEventListener('click', () => {
      if (!store.getState().user) {
        this.toast?.show('Sign in to list an item', 'info');
        window.dispatchEvent(new CustomEvent('open-auth', { detail: { tab: 'login' } }));
        return;
      }
      this.list?.open();
    });

    // Hero sell CTA
    document.getElementById('hero-sell-btn')?.addEventListener('click', () => {
      document.getElementById('list-item-btn')?.click();
    });
  }

  private _pollUnread() {
    const poll = async () => {
      const u = store.getState().user;
      if (!u) return;
      try {
        const { byItem } = await messagesApi.getUnread(u.id);
        store.dispatch({ type: 'SET_UNREAD', payload: byItem });
      } catch { /* silent */ }
    };
    poll();
    this._unreadInterval = setInterval(poll, 8_000);
  }
}

const boot = () => new App().init();
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', boot)
  : boot();
