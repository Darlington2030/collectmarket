import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from './base-component.js';
import { itemsApi } from '../utils/api.js';
import type { Item } from '../types/index.js';

@customElement('item-detail-modal')
export class ItemDetailModal extends BaseComponent {
  @state() private _item: Item | null = null;
  @state() private _open = false;
  @state() private _del = false;

  openForItem(item: Item) { this._item = item; this._open = true; }
  close() { this._open = false; setTimeout(() => { this._item = null; }, 300); }

  private _chat() {
    this.close();
    window.dispatchEvent(new CustomEvent('open-chat', { detail: this._item }));
  }

  private _signIn() {
    this.close();
    window.dispatchEvent(new CustomEvent('require-auth'));
  }

  private async _del_item() {
    if (!this._item || !confirm('Remove this listing?')) return;
    this._del = true;
    try { await itemsApi.delete(this._item.id); this.dispatch({ type: 'REMOVE_ITEM', payload: this._item.id }); this.close(); }
    catch (e: any) { alert(e.message); }
    finally { this._del = false; }
  }

  override render() {
    if (!this._open || !this._item) return html``;
    const item = this._item, u = this.state.user, isSeller = u?.id === item.sellerId;

    return html`
      <div class="fixed inset-0 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-md" @click=${this.close}></div>
        <div class="relative w-full sm:max-w-2xl bg-[#0d0d1f] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

          <button @click=${this.close}
            class="absolute top-3.5 right-3.5 z-10 w-8 h-8 flex items-center justify-center bg-black/50 backdrop-blur-sm text-white/55 hover:text-white rounded-full transition-colors text-sm border-none cursor-pointer">✕</button>

          <!-- Image -->
          <div class="relative shrink-0" style="aspect-ratio:16/9;background:rgba(255,255,255,.04)">
            <img src="${item.image}" alt="${item.name}"
              class="w-full h-full object-cover"
              onerror="this.src='https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=700'" />
            <div class="absolute inset-0 bg-gradient-to-t from-[#0d0d1f] via-transparent to-transparent"></div>
          </div>

          <!-- Content -->
          <div class="overflow-y-auto flex-1 p-5 sm:p-6">
            <div class="flex items-start justify-between gap-4 mb-3">
              <h2 class="text-xl sm:text-2xl font-bold text-white leading-tight" style="font-family:'Playfair Display',serif">${item.name}</h2>
              <div class="shrink-0 text-right">
                <div class="text-2xl font-bold text-amber-400" style="font-family:'Playfair Display',serif">${this.$$(item.price)}</div>
                ${item.highestOffer ? html`<p class="text-xs text-emerald-400/80 mt-0.5">Best offer: ${this.$$(item.highestOffer)}</p>` : ''}
              </div>
            </div>

            <p class="text-sm text-white/55 leading-relaxed mb-5">${item.description}</p>

            <!-- Seller -->
            <div class="flex items-center gap-3 p-3 bg-white/4 border border-white/7 rounded-xl mb-5">
              <div class="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-sm font-bold text-white shrink-0">${item.sellerName[0].toUpperCase()}</div>
              <div>
                <p class="text-sm font-semibold text-white/80">${item.sellerName}</p>
                <p class="text-xs text-white/35">Listed ${this.ago(item.createdAt)}</p>
              </div>
              ${isSeller ? html`<span class="ml-auto px-2.5 py-1 bg-amber-500/12 border border-amber-500/28 text-amber-400 text-xs rounded-full font-semibold">Your listing</span>` : ''}
            </div>

            ${item.paymentStatus === 'paid' ? html`
              <div class="p-3.5 bg-blue-500/8 border border-blue-500/22 rounded-xl mb-5 text-center">
                <p class="text-blue-300 font-semibold text-sm">💳 Payment Submitted</p>
                <p class="text-white/35 text-xs mt-1">${isSeller ? 'Confirm sale to complete the transaction' : 'Awaiting seller confirmation'}</p>
              </div>` : ''}

            <!-- Actions -->
            <div class="flex gap-3 flex-wrap">
              ${!isSeller && u ? html`
                <button @click=${this._chat}
                  class="flex-1 min-w-[140px] py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm rounded-xl hover:opacity-90 transition-all shadow-lg shadow-amber-500/18 border-none cursor-pointer">
                  💬 Message Seller
                </button>` : ''}

              ${!u ? html`
                <button @click=${this._signIn}
                  class="flex-1 min-w-[140px] py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm rounded-xl hover:opacity-90 transition-all shadow-lg shadow-amber-500/18 border-none cursor-pointer">
                  Sign in to Contact
                </button>` : ''}

              ${isSeller ? html`
                <button @click=${this._del_item} ?disabled=${this._del}
                  class="px-5 py-3 bg-red-500/8 border border-red-500/22 text-red-400 hover:bg-red-500/15 font-semibold text-sm rounded-xl transition-all cursor-pointer disabled:opacity-50">
                  ${this._del ? 'Removing…' : 'Remove Listing'}
                </button>` : ''}
            </div>
          </div>
        </div>
      </div>`;
  }
}
