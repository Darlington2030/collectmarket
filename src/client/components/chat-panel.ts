import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from './base-component.js';
import { itemsApi, messagesApi } from '../utils/api.js';
import { OfferSchema } from '../utils/validators.js';
import type { Item, Message } from '../types/index.js';

const INPUT_STYLE = `
  box-sizing: border-box;
  background: rgba(30, 30, 55, 0.9);
  border: 1.5px solid rgba(255,255,255,0.15);
  border-radius: 12px;
  color: #ffffff;
  font-size: 14px;
  font-family: 'DM Sans', system-ui, sans-serif;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  -webkit-text-fill-color: #ffffff;
`;

@customElement('chat-panel')
export class ChatPanel extends BaseComponent {
  @state() private _item: Item | null = null;
  @state() private _open = false;
  @state() private _text = '';
  @state() private _offerMode = false;
  @state() private _offerPrice = '';
  @state() private _offerErr = '';
  @state() private _sending = false;
  @state() private _checkingOut = false;
  private _lastTs = new Date(0).toISOString();
  private _poll?: ReturnType<typeof setTimeout>;

  // Listen for open-chat events from anywhere (badge, chat button, detail modal)
  private _openHandler = (e: Event) => {
    this.openForItem((e as CustomEvent).detail as Item);
  };

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('open-chat', this._openHandler);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('open-chat', this._openHandler);
    clearTimeout(this._poll);
  }

  openForItem(item: Item) {
    this._item = item;
    this._open = true;
    this._lastTs = new Date(0).toISOString();
    this._offerMode = false;
    this._offerPrice = '';
    this._offerErr = '';
    this._text = '';
    document.body.style.overflow = 'hidden';
    this._loadMsgs();
  }

  close() {
    this._open = false;
    clearTimeout(this._poll);
    this._item = null;
    this._text = '';
    document.body.style.overflow = '';
  }

  private async _loadMsgs() {
    if (!this._item) return;
    try {
      const msgs = await messagesApi.getForItem(this._item.id);
      this.dispatch({ type: 'SET_MESSAGES', payload: { itemId: this._item.id, messages: msgs } });
      if (msgs.length) this._lastTs = msgs[msgs.length - 1].timestamp;
      if (this.state.user) {
        await messagesApi.markRead(this.state.user.id, this._item.id);
        // Clear unread count for this item immediately in store
        const updated = { ...this.state.unreadCounts };
        delete updated[this._item.id];
        this.dispatch({ type: 'SET_UNREAD', payload: updated });
      }
      this._scrollBottom();
      this._startPoll();
    } catch {}
  }

  private _startPoll() {
    clearTimeout(this._poll);
    this._poll = setTimeout(async () => {
      if (!this._item || !this._open) return;
      try {
        const r = await messagesApi.poll(this._item.id, this._lastTs);
        if (r.hasNew) {
          r.messages.forEach(m => this.dispatch({ type: 'ADD_MESSAGE', payload: m }));
          this._lastTs = r.lastTimestamp;
          const upd = await itemsApi.getById(this._item.id);
          this._item = upd;
          this.dispatch({ type: 'UPDATE_ITEM', payload: upd });
          this._scrollBottom();
          if (this.state.user) {
            await messagesApi.markRead(this.state.user.id, this._item.id);
            const updated = { ...this.state.unreadCounts };
            delete updated[this._item.id];
            this.dispatch({ type: 'SET_UNREAD', payload: updated });
          }
        }
      } catch {}
      if (this._open) this._startPoll();
    }, 2000);
  }

  private _scrollBottom() {
    setTimeout(() => {
      const el = this.querySelector('.chat-msgs') as HTMLElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 60);
  }

  private async _send() {
    if (!this._text.trim() || !this._item || !this.state.user || this._sending) return;
    this._sending = true;
    try {
      const m = await messagesApi.send({
        itemId: this._item.id,
        senderId: this.state.user.id,
        senderName: this.state.user.name,
        content: this._text.trim(),
      });
      this.dispatch({ type: 'ADD_MESSAGE', payload: m });
      this._lastTs = m.timestamp;
      this._text = '';
      this._scrollBottom();
    } catch {}
    finally { this._sending = false; }
  }

  private async _sendOffer() {
    if (!this._item || !this.state.user) return;
    const p = OfferSchema.safeParse({ price: parseFloat(this._offerPrice) });
    if (!p.success) { this._offerErr = p.error.errors[0].message; return; }
    this._sending = true; this._offerErr = '';
    try {
      const m = await messagesApi.send({
        itemId: this._item.id,
        senderId: this.state.user.id,
        senderName: this.state.user.name,
        content: `Offer: ${this.$$(p.data.price)}`,
        type: 'offer',
        price: p.data.price,
        originalPrice: this._item.price,
      });
      this.dispatch({ type: 'ADD_MESSAGE', payload: m });
      this._lastTs = m.timestamp;
      this._offerMode = false;
      this._offerPrice = '';
      this._scrollBottom();
    } catch (e: any) { this._offerErr = e.message; }
    finally { this._sending = false; }
  }

  private async _respond(id: string, status: 'accepted' | 'rejected') {
    try {
      const u = await messagesApi.respondToOffer(id, status);
      this.dispatch({ type: 'UPDATE_MESSAGE', payload: u });
      if (status === 'accepted' && this._item) {
        const ui = await itemsApi.getById(this._item.id);
        this._item = ui;
        this.dispatch({ type: 'UPDATE_ITEM', payload: ui });
      }
    } catch {}
  }

  private async _checkout() {
    if (!this._item || !this.state.user) return;
    this._checkingOut = true;
    try {
      const r = await itemsApi.checkout(this._item.id, this.state.user.id);
      this._item = r.item;
      this.dispatch({ type: 'UPDATE_ITEM', payload: r.item });
      await messagesApi.send({
        itemId: this._item.id,
        senderId: 'system',
        senderName: 'System',
        content: `💳 ${this.state.user.name} submitted payment — awaiting seller confirmation.`,
        type: 'system',
      });
    } catch {}
    finally { this._checkingOut = false; }
  }

  private async _confirmSale() {
    if (!this._item || !this.state.user || !confirm('Confirm sale? Item will be removed.')) return;
    try {
      await itemsApi.confirmSale(this._item.id, this.state.user.id);
      this.dispatch({ type: 'REMOVE_ITEM', payload: this._item.id });
      this.close();
    } catch {}
  }

  private _bubble(m: Message) {
    const u = this.state.user;
    const isOwn = m.senderId === u?.id;
    const isSystem = m.senderId === 'system' || m.type === 'system';
    const item = this._item;
    const isSeller = item && u?.id === item.sellerId;

    if (isSystem) return html`
      <div style="display:flex;justify-content:center;margin:10px 0">
        <span style="padding:5px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:50px;font-size:11px;color:rgba(255,255,255,0.45)">
          ${m.content}
        </span>
      </div>`;

    if (m.type === 'offer') {
      const canRespond = isSeller && m.status === 'pending';
      const canCheckout = !isSeller && m.status === 'accepted' && item?.paymentStatus !== 'paid';
      const statusColor = m.status === 'accepted' ? '#34d399' : m.status === 'rejected' ? '#f87171' : 'rgba(255,255,255,0.4)';
      const statusLabel = m.status === 'accepted' ? '✓ Accepted' : m.status === 'rejected' ? '✗ Rejected' : '⏳ Pending';

      return html`
        <div style="display:flex;justify-content:${isOwn ? 'flex-end' : 'flex-start'};margin-bottom:12px">
          <div style="max-width:280px;width:100%">
            <div style="background:linear-gradient(135deg,rgba(245,158,11,0.14),rgba(234,88,12,0.08));border:1px solid rgba(245,158,11,0.28);border-radius:16px;padding:16px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span style="font-size:10px;font-weight:700;color:rgba(245,158,11,0.8);text-transform:uppercase;letter-spacing:0.06em">Price Offer</span>
                <span style="font-size:11px;color:${statusColor}">${statusLabel}</span>
              </div>
              <div style="font-size:26px;font-weight:700;color:#f59e0b;font-family:'Playfair Display',serif;line-height:1">${this.$$(m.price!)}</div>
              ${m.originalPrice ? html`<p style="font-size:10px;color:rgba(255,255,255,0.35);margin:3px 0 0">vs asking ${this.$$(m.originalPrice)}</p>` : ''}
              ${canCheckout ? html`
                <button @click=${() => this._checkout()} ?disabled=${this._checkingOut}
                  style="margin-top:12px;width:100%;padding:10px;background:linear-gradient(135deg,#10b981,#0d9488);color:white;font-size:12px;font-weight:700;border-radius:10px;border:none;cursor:pointer;font-family:inherit;disabled:opacity:0.5">
                  ${this._checkingOut ? 'Processing…' : '💳 Checkout & Pay'}
                </button>` : ''}
              ${canRespond ? html`
                <div style="display:flex;gap:8px;margin-top:12px">
                  <button @click=${() => this._respond(m.id, 'accepted')}
                    style="flex:1;padding:9px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.38);color:#34d399;font-size:12px;font-weight:700;border-radius:9px;cursor:pointer;font-family:inherit">
                    ✓ Accept
                  </button>
                  <button @click=${() => this._respond(m.id, 'rejected')}
                    style="flex:1;padding:9px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#f87171;font-size:12px;font-weight:700;border-radius:9px;cursor:pointer;font-family:inherit">
                    ✗ Decline
                  </button>
                </div>` : ''}
            </div>
            <p style="font-size:10px;color:rgba(255,255,255,0.22);margin:4px 0 0;padding:0 4px;text-align:${isOwn ? 'right' : 'left'}">${isOwn ? 'You' : m.senderName} · ${this.ago(m.timestamp)}</p>
          </div>
        </div>`;
    }

    return html`
      <div style="display:flex;justify-content:${isOwn ? 'flex-end' : 'flex-start'};margin-bottom:8px">
        <div style="max-width:72%">
          <div style="
            padding:10px 14px;
            border-radius:${isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
            font-size:14px;line-height:1.5;
            ${isOwn
              ? 'background:linear-gradient(135deg,rgba(245,158,11,0.28),rgba(234,88,12,0.18));border:1px solid rgba(245,158,11,0.22);color:rgba(255,255,255,0.92)'
              : 'background:rgba(255,255,255,0.09);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.85)'}
          ">${m.content}</div>
          <p style="font-size:10px;color:rgba(255,255,255,0.22);margin:3px 0 0;padding:0 4px;text-align:${isOwn ? 'right' : 'left'}">${isOwn ? 'You' : m.senderName} · ${this.ago(m.timestamp)}</p>
        </div>
      </div>`;
  }

  override render() {
    if (!this._open || !this._item) return html``;
    const item = this._item;
    const u = this.state.user;
    const msgs = this.state.messages[item.id] ?? [];
    const isSeller = u?.id === item.sellerId;

    return html`
      <!-- Backdrop -->
      <div style="position:fixed;inset:0;z-index:8000;display:flex;align-items:flex-end;justify-content:center"
           @click=${(e: Event) => { if ((e.target as HTMLElement).dataset.backdrop === 'true') this.close(); }}>
        <div data-backdrop="true" style="position:absolute;inset:0;background:rgba(0,0,0,0.62);backdrop-filter:blur(8px)"></div>

        <!-- Chat panel -->
        <div style="
          position:relative;
          width:100%;max-width:480px;
          background:#0d0d1f;
          border:1px solid rgba(255,255,255,0.1);
          border-radius:20px 20px 0 0;
          box-shadow:0 -20px 60px rgba(0,0,0,0.5);
          display:flex;flex-direction:column;
          height:85vh;max-height:680px;
          overflow:hidden;
        ">

          <!-- Header bar -->
          <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0">
            <img
              src="${item.image}"
              alt="${item.name}"
              style="width:42px;height:42px;border-radius:10px;object-fit:cover;background:rgba(255,255,255,0.05);flex-shrink:0"
              onerror="this.src='https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=80'"
            />
            <div style="min-width:0;flex:1">
              <p style="font-size:14px;font-weight:600;color:white;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.name}</p>
              <p style="font-size:13px;font-weight:700;color:#f59e0b;margin:2px 0 0;font-family:'Playfair Display',serif">${this.$$(item.price)}</p>
            </div>
            ${isSeller && item.paymentStatus === 'paid' ? html`
              <button @click=${() => this._confirmSale()}
                style="padding:7px 13px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);color:#34d399;font-size:11px;font-weight:700;border-radius:10px;cursor:pointer;font-family:inherit;flex-shrink:0">
                ✓ Confirm Sale
              </button>` : ''}
            <button @click=${() => this.close()}
              style="flex-shrink:0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:50%;color:rgba(255,255,255,0.5);cursor:pointer;font-size:13px;font-family:inherit;transition:all 0.18s"
              onmouseover="this.style.background='rgba(255,255,255,0.12)';this.style.color='white'"
              onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.color='rgba(255,255,255,0.5)'">
              ✕
            </button>
          </div>

          <!-- Messages area -->
          <div class="chat-msgs" style="flex:1;overflow-y:auto;padding:16px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.08) transparent">
            ${!msgs.length ? html`
              <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;opacity:0.5">
                <div style="font-size:36px;margin-bottom:12px">💬</div>
                <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0">No messages yet</p>
                <p style="color:rgba(255,255,255,0.3);font-size:12px;margin:6px 0 0">Start the conversation!</p>
              </div>` : msgs.map(m => this._bubble(m))}
          </div>

          <!-- Input area -->
          ${u ? html`
            <div style="padding:10px 13px 13px;border-top:1px solid rgba(255,255,255,0.07);flex-shrink:0">

              <!-- Offer input row -->
              ${this._offerMode ? html`
                <div style="margin-bottom:10px;padding:12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:12px">
                  <p style="font-size:10px;font-weight:600;color:rgba(245,158,11,0.75);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px">Make an Offer (USD)</p>
                  <div style="display:flex;gap:8px;align-items:center">
                    <div style="position:relative;flex:1">
                      <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.5);font-size:14px;pointer-events:none">$</span>
                      <input
                        type="number"
                        .value=${this._offerPrice}
                        @input=${(e: Event) => { this._offerPrice = (e.target as HTMLInputElement).value; this._offerErr = ''; }}
                        @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this._sendOffer()}
                        placeholder="${Math.round(item.price * 0.9)}"
                        style="${INPUT_STYLE}width:100%;padding:9px 10px 9px 26px;"
                        @focus=${(e: Event) => { (e.target as HTMLElement).style.borderColor = 'rgba(245,158,11,0.55)'; }}
                        @blur=${(e: Event) => { (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
                      />
                    </div>
                    <button @click=${() => this._sendOffer()} ?disabled=${this._sending}
                      style="padding:9px 16px;background:#f59e0b;color:white;font-size:12px;font-weight:700;border-radius:9px;border:none;cursor:pointer;font-family:inherit;transition:opacity 0.18s"
                      onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                      Send
                    </button>
                    <button @click=${() => { this._offerMode = false; this._offerErr = ''; }}
                      style="padding:9px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.5);font-size:12px;border-radius:9px;cursor:pointer;font-family:inherit">
                      ✕
                    </button>
                  </div>
                  ${this._offerErr ? html`<p style="color:#f87171;font-size:11px;margin:6px 0 0">${this._offerErr}</p>` : ''}
                </div>` : ''}

              <!-- Message row -->
              <div style="display:flex;align-items:center;gap:8px">

                <!-- Offer toggle button (buyers only) -->
                ${!isSeller ? html`
                  <button
                    @click=${() => { this._offerMode = !this._offerMode; }}
                    title="Make a price offer"
                    style="
                      flex-shrink:0;width:38px;height:38px;
                      display:flex;align-items:center;justify-content:center;
                      background:rgba(245,158,11,0.12);
                      border:1px solid rgba(245,158,11,0.28);
                      color:#fbbf24;font-size:14px;font-weight:700;
                      border-radius:11px;cursor:pointer;font-family:inherit;
                      transition:all 0.18s;
                    "
                    onmouseover="this.style.background='rgba(245,158,11,0.22)'"
                    onmouseout="this.style.background='rgba(245,158,11,0.12)'"
                  >$</button>` : ''}

                <!-- Message input -->
                <input
                  type="text"
                  .value=${this._text}
                  @input=${(e: Event) => { this._text = (e.target as HTMLInputElement).value; }}
                  @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) this._send(); }}
                  placeholder="Type a message…"
                  style="${INPUT_STYLE}flex:1;padding:11px 14px;border-radius:12px;"
                  @focus=${(e: Event) => { (e.target as HTMLElement).style.borderColor = 'rgba(245,158,11,0.5)'; (e.target as HTMLElement).style.background = 'rgba(30,30,60,0.95)'; }}
                  @blur=${(e: Event) => { (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.target as HTMLElement).style.background = 'rgba(30,30,55,0.9)'; }}
                />

                <!-- Send button -->
                <button
                  @click=${() => this._send()}
                  ?disabled=${this._sending || !this._text.trim()}
                  style="
                    flex-shrink:0;width:38px;height:38px;
                    display:flex;align-items:center;justify-content:center;
                    background:#f59e0b;color:white;
                    border-radius:11px;border:none;cursor:pointer;
                    transition:all 0.18s;
                    opacity:${!this._text.trim() ? '0.35' : '1'};
                  "
                  onmouseover="if(this.textContent.trim()){this.style.background='#fbbf24'}"
                  onmouseout="this.style.background='#f59e0b'"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                  </svg>
                </button>
              </div>
            </div>
          ` : html`
            <div style="padding:14px;border-top:1px solid rgba(255,255,255,0.07);text-align:center;flex-shrink:0">
              <p style="font-size:13px;color:rgba(255,255,255,0.4);margin:0">
                <button @click=${() => window.dispatchEvent(new CustomEvent('require-auth'))}
                  style="color:#f59e0b;background:none;border:none;cursor:pointer;font-size:13px;font-family:inherit;text-decoration:underline">
                  Sign in
                </button>
                to chat with the seller
              </p>
            </div>`}
        </div>
      </div>

      <style>
        .chat-msgs::-webkit-scrollbar { width: 3px; }
        .chat-msgs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        chat-panel input { caret-color: white !important; }
        chat-panel input::placeholder { color: rgba(255,255,255,0.3) !important; }
      </style>
    `;
  }
}
