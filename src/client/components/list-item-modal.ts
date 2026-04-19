import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from './base-component.js';
import { itemsApi } from '../utils/api.js';
import { CreateItemSchema } from '../utils/validators.js';

interface Form { name: string; description: string; price: string; image: string; }

@customElement('list-item-modal')
export class ListItemModal extends BaseComponent {
  @state() private _open = false;
  @state() private _loading = false;
  @state() private _err: Record<string, string> = {};
  @state() private _form: Form = { name: '', description: '', price: '', image: '' };

  open() { this._open = true; }
  close() { this._open = false; this._err = {}; this._form = { name: '', description: '', price: '', image: '' }; }

  private _set(k: keyof Form, v: string) {
    this._form = { ...this._form, [k]: v };
    if (this._err[k]) { const { [k]: _, ...rest } = this._err; this._err = rest; }
  }

  private async _submit(e?: Event) {
    e?.preventDefault();
    const u = this.state.user;
    if (!u) { window.dispatchEvent(new CustomEvent('require-auth')); return; }

    const parsed = CreateItemSchema.safeParse({
      name: this._form.name, description: this._form.description,
      price: parseFloat(this._form.price) || 0, image: this._form.image || '',
      sellerId: u.id, sellerName: u.name,
    });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      parsed.error.errors.forEach(x => { e[x.path[0] as string] = x.message; });
      this._err = e; return;
    }
    this._loading = true;
    try {
      const item = await itemsApi.create({ ...parsed.data, image: parsed.data.image || `https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=600` });
      this.dispatch({ type: 'ADD_ITEM', payload: item });
      this.close();
      window.dispatchEvent(new CustomEvent('item-listed', { detail: item }));
    } catch (err: any) { this._err = { _submit: err.message }; }
    finally { this._loading = false; }
  }

  private _inp(k: keyof Form, label: string, opts: { type?: string; multi?: boolean; prefix?: string; placeholder?: string } = {}) {
    const v = this._form[k], er = this._err[k];
    const borderColor = er ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)';
    const baseStyle = `width:100%;box-sizing:border-box;background:rgba(25,25,50,0.95);border:1.5px solid ${borderColor};border-radius:12px;color:#ffffff;font-size:14px;font-family:'DM Sans',system-ui,sans-serif;outline:none;transition:border-color .2s;-webkit-text-fill-color:#ffffff;caret-color:white;`;
    const focusIn  = (e: Event) => { (e.target as HTMLElement).style.borderColor = 'rgba(245,158,11,0.55)'; (e.target as HTMLElement).style.background = 'rgba(30,30,60,0.98)'; };
    const focusOut = (e: Event) => { (e.target as HTMLElement).style.borderColor = borderColor; (e.target as HTMLElement).style.background = 'rgba(25,25,50,0.95)'; };

    return html`
      <div style="margin-bottom:4px">
        <label style="display:block;font-size:10px;font-weight:600;color:rgba(255,255,255,0.42);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">
          ${label}${k !== 'image' ? html` <span style="color:#f87171">*</span>` : ''}
        </label>
        <div style="position:relative">
          ${opts.prefix ? html`<span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.4);font-size:14px;pointer-events:none">${opts.prefix}</span>` : ''}
          ${opts.multi
            ? html`<textarea .value=${v} rows="3"
                     @input=${(e: Event) => this._set(k, (e.target as HTMLTextAreaElement).value)}
                     @focus=${focusIn} @blur=${focusOut}
                     placeholder=${opts.placeholder ?? ''}
                     style="${baseStyle}padding:12px 16px;resize:none;"></textarea>`
            : html`<input
                     type=${opts.type ?? 'text'} .value=${v}
                     @input=${(e: Event) => this._set(k, (e.target as HTMLInputElement).value)}
                     @focus=${focusIn} @blur=${focusOut}
                     placeholder=${opts.placeholder ?? ''}
                     style="${baseStyle}padding:12px ${opts.prefix ? '16px 12px 36px' : '16px'};" />`}
        </div>
        ${er ? html`<p style="margin:5px 0 0;font-size:11px;color:#f87171">${er}</p>` : ''}
      </div>`;
  }

  override render() {
    if (!this._open) return html``;
    return html`
      <div class="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-md" @click=${this.close}></div>
        <div class="relative w-full sm:max-w-lg bg-[#0d0d1f] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

          <div class="h-1 bg-gradient-to-r from-amber-500 to-orange-500 shrink-0"></div>

          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
            <div>
              <h2 class="text-lg font-bold text-white" style="font-family:'Playfair Display',serif">List New Item</h2>
              <p class="text-xs text-white/35 mt-0.5">Add your collectible to the marketplace</p>
            </div>
            <button @click=${this.close} class="w-8 h-8 flex items-center justify-center bg-white/6 hover:bg-white/10 rounded-full text-white/45 hover:text-white transition-all text-sm border-none cursor-pointer">✕</button>
          </div>

          <!-- Body -->
          <div class="overflow-y-auto flex-1">
            <form @submit=${this._submit} class="p-6 space-y-4">
              ${this._err._submit ? html`
                <div class="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-sm">${this._err._submit}</div>` : ''}

              ${this._inp('name', 'Item Name', { placeholder: 'e.g. Spider-Man #1 First Edition' })}
              ${this._inp('description', 'Description', { multi: true, placeholder: 'Condition, rarity, special details…' })}
              ${this._inp('price', 'Price (USD)', { type: 'number', prefix: '$', placeholder: '0' })}
              ${this._inp('image', 'Image URL', { type: 'url', placeholder: 'https://…' })}

              ${this._form.image ? html`
                <div class="rounded-xl overflow-hidden aspect-video bg-white/5">
                  <img src="${this._form.image}" class="w-full h-full object-cover"
                    onerror="this.src='https://via.placeholder.com/600x338?text=Invalid+URL'" />
                </div>` : ''}

              <button type="submit" ?disabled=${this._loading}
                class="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm rounded-xl hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/20">
                ${this._loading ? 'Listing…' : '✦ List for Sale'}
              </button>
            </form>
          </div>
        </div>
      </div>`;
  }
}
