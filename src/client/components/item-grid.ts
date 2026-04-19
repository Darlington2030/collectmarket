import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BaseComponent } from './base-component.js';
import { itemsApi } from '../utils/api.js';
import './item-card.js';

@customElement('item-grid')
export class ItemGrid extends BaseComponent {
  override async connectedCallback() {
    super.connectedCallback();
    await this._load();
  }

  private async _load() {
    this.dispatch({ type: 'SET_LOADING', payload: true });
    this.dispatch({ type: 'SET_ERROR', payload: null });
    try {
      this.dispatch({ type: 'SET_ITEMS', payload: await itemsApi.getAll(this.state.searchQuery) });
    } catch (e: any) {
      this.dispatch({ type: 'SET_ERROR', payload: e.message });
    } finally {
      this.dispatch({ type: 'SET_LOADING', payload: false });
    }
  }

  override render() {
    const { items, isLoading, error, searchQuery } = this.state;

    if (isLoading) return html`
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        ${Array(8).fill(0).map(() => html`
          <div class="bg-white/[.03] border border-white/8 rounded-2xl overflow-hidden animate-pulse">
            <div class="aspect-[4/3] bg-white/[.06]"></div>
            <div class="p-4 space-y-2.5">
              <div class="h-3.5 bg-white/[.06] rounded-md w-4/5"></div>
              <div class="h-3 bg-white/[.04] rounded-md w-full"></div>
              <div class="h-3 bg-white/[.04] rounded-md w-3/5"></div>
              <div class="h-5 bg-amber-500/8 rounded-md w-2/5 mt-3"></div>
            </div>
          </div>`)}
      </div>`;

    if (error) return html`
      <div class="flex flex-col items-center py-24 text-center gap-4">
        <div class="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl">⚡</div>
        <div>
          <p class="text-white/55 font-semibold text-lg mb-1">Connection error</p>
          <p class="text-white/30 text-sm mb-4">Make sure the backend is running on port 3000</p>
          <button @click=${this._load}
            class="px-5 py-2 bg-white/6 border border-white/15 text-white/65 hover:text-white text-sm rounded-xl transition-all">
            Retry
          </button>
        </div>
      </div>`;

    if (!items.length) return html`
      <div class="flex flex-col items-center py-24 text-center gap-4">
        <div class="w-16 h-16 rounded-2xl bg-amber-500/8 border border-amber-500/15 flex items-center justify-center text-3xl">◈</div>
        <div>
          <p class="text-white/55 font-semibold text-lg mb-1">
            ${searchQuery ? `No results for "${searchQuery}"` : 'No listings yet'}
          </p>
          <p class="text-white/28 text-sm">
            ${searchQuery ? 'Try a different keyword' : 'Be the first to list a collectible!'}
          </p>
        </div>
      </div>`;

    return html`
      <div>
        <p class="text-xs text-white/35 mb-5">
          <span class="text-white/60 font-semibold">${items.length}</span>
          item${items.length !== 1 ? 's' : ''}
          ${searchQuery ? html` for <span class="text-amber-400">"${searchQuery}"</span>` : ' on the market'}
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          ${items.map(it => html`<item-card .item=${it}></item-card>`)}
        </div>
      </div>`;
  }
}
