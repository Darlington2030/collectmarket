import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from './base-component.js';
import { itemsApi } from '../utils/api.js';
import type { Item } from '../types/index.js';

@customElement('checkout-modal')
export class CheckoutModal extends BaseComponent {
  @state() private _open = false;
  @state() private _item: Item | null = null;
  @state() private _step: 'review' | 'success' = 'review';
  @state() private _loading = false;
  @state() private _error = '';

  static override styles = css`:host { display: block; }`;

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('open-checkout', (e: Event) => {
      const { item } = (e as CustomEvent).detail;
      this._item = item;
      this._open = true;
      this._step = 'review';
      this._error = '';
    });
  }

  private _close() {
    this._open = false;
    this._item = null;
    this._step = 'review';
  }

  private async _confirmPayment() {
    const user = this.state.user;
    if (!user || !this._item) return;

    this._loading = true;
    this._error = '';
    try {
      const result = await itemsApi.checkout(this._item.id, user.id);
      this.dispatch({ type: 'UPDATE_ITEM', payload: result.item });
      this._step = 'success';
    } catch (e: any) {
      this._error = e.message || 'Checkout failed';
    } finally {
      this._loading = false;
    }
  }

  override render() {
    if (!this._open || !this._item) return html``;

    const item = this._item;
    const user = this.state.user;
    const finalPrice = item.highestOffer ?? item.price;

    return html`
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/75 backdrop-blur-sm" @click=${this._close}></div>

        <div class="relative w-full max-w-md bg-[#0f0f1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          
          ${this._step === 'review' ? html`
            <div class="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <h2 class="text-lg font-bold text-white">Checkout</h2>
              <button @click=${this._close} class="text-white/40 hover:text-white/80 text-xl">✕</button>
            </div>

            <div class="p-6 space-y-5">
              <!-- Item preview -->
              <div class="flex items-center gap-4 p-4 bg-white/4 border border-white/8 rounded-xl">
                <img src="${item.image}" alt="${item.name}"
                  class="w-16 h-16 object-cover rounded-lg bg-white/10 flex-shrink-0"
                  @error=${(e: Event) => { (e.target as HTMLImageElement).style.display='none'; }} />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-white truncate">${item.name}</p>
                  <p class="text-xs text-white/40 mt-0.5">Sold by ${item.sellerName}</p>
                  ${item.highestOffer ? html`
                    <p class="text-xs text-amber-400 mt-1">Negotiated price</p>` : ''}
                </div>
              </div>

              <!-- Price breakdown -->
              <div class="space-y-2 p-4 bg-white/3 rounded-xl border border-white/6">
                ${item.highestOffer ? html`
                  <div class="flex justify-between text-sm">
                    <span class="text-white/50">Original price</span>
                    <span class="text-white/50 line-through">${this.formatPrice(item.price)}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="text-white/50">Your offer</span>
                    <span class="text-green-400">−${this.formatPrice(item.price - item.highestOffer)}</span>
                  </div>
                  <div class="border-t border-white/8 pt-2"></div>` : ''}
                <div class="flex justify-between">
                  <span class="font-semibold text-white">Total</span>
                  <span class="font-black text-xl text-amber-400">${this.formatPrice(finalPrice)}</span>
                </div>
              </div>

              <!-- Payment notice -->
              <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p class="text-xs text-blue-300/80 leading-relaxed">
                  <span class="font-semibold">📋 Note:</span> This is a demo marketplace. Clicking "Confirm Payment" notifies the seller that you've paid. The seller will then confirm and remove the item.
                </p>
              </div>

              ${this._error ? html`
                <div class="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  ${this._error}
                </div>` : ''}
            </div>

            <div class="px-6 pb-6 flex gap-3">
              <button @click=${this._close}
                class="flex-1 py-3 text-sm text-white/60 border border-white/15 rounded-xl hover:border-white/30 hover:text-white/80 transition-all">
                Cancel
              </button>
              <button @click=${this._confirmPayment} ?disabled=${this._loading}
                class="flex-1 py-3 text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-black rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/20">
                ${this._loading ? 'Processing…' : '✓ Confirm Payment'}
              </button>
            </div>
          ` : html`
            <!-- Success state -->
            <div class="p-10 text-center">
              <div class="w-16 h-16 mx-auto mb-4 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center text-2xl">
                ✓
              </div>
              <h3 class="text-xl font-bold text-white mb-2">Payment Confirmed!</h3>
              <p class="text-sm text-white/50 leading-relaxed mb-6">
                You've notified <strong class="text-white/80">${item.sellerName}</strong> of your payment.
                They'll confirm and the item will be removed from the marketplace.
              </p>
              <button @click=${this._close}
                class="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-xl hover:opacity-90 transition-all">
                Back to Marketplace
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  }
}
