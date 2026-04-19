import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseComponent } from './base-component.js';
import type { Item } from '../types/index.js';

@customElement('item-card')
export class ItemCard extends BaseComponent {
  @property({ type: Object }) item!: Item;

  override render() {
    const { item } = this;
    if (!item) return html``;
    const user = this.state.user;
    const isSeller = user?.id === item.sellerId;
    const unread = this.state.unreadCounts[item.id] ?? 0;

    const openDetail = () =>
      window.dispatchEvent(new CustomEvent('open-detail', { detail: item }));

    // Unread badge click — opens chat directly, stops card click
    const openChatFromBadge = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      if (!user) {
        window.dispatchEvent(new CustomEvent('require-auth'));
      } else {
        window.dispatchEvent(new CustomEvent('open-chat', { detail: item }));
      }
    };

    const handleContact = (e: Event) => {
      e.stopPropagation();
      if (!user) {
        window.dispatchEvent(new CustomEvent('require-auth'));
      } else {
        window.dispatchEvent(new CustomEvent('open-chat', { detail: item }));
      }
    };

    return html`
      <article
        @click=${openDetail}
        @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && openDetail()}
        tabindex="0" role="button"
        aria-label="View details for ${item.name}"
        style="
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          outline: none;
        "
        onmouseover="this.style.borderColor='rgba(245,158,11,0.3)';this.style.background='rgba(255,255,255,0.055)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 12px 32px rgba(0,0,0,0.35)'"
        onmouseout="this.style.borderColor='rgba(255,255,255,0.08)';this.style.background='rgba(255,255,255,0.035)';this.style.transform='translateY(0)';this.style.boxShadow='none'"
      >

        <!-- Image section -->
        <div style="position:relative;aspect-ratio:4/3;overflow:hidden;background:rgba(255,255,255,0.05);flex-shrink:0">
          <img
            src="${item.image || 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=500'}"
            alt="${item.name}"
            loading="lazy"
            style="width:100%;height:100%;object-fit:cover;transition:transform 0.45s"
            onmouseover="this.style.transform='scale(1.05)'"
            onmouseout="this.style.transform='scale(1)'"
            onerror="this.src='https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=500'"
          />

          ${item.paymentStatus === 'paid' ? html`
            <span style="position:absolute;top:10px;left:10px;padding:2px 9px;background:rgba(59,130,246,0.9);border-radius:50px;font-size:10px;font-weight:600;color:white">
              Payment Pending
            </span>` : ''}

          ${isSeller ? html`
            <span style="position:absolute;top:10px;right:10px;padding:2px 9px;background:rgba(245,158,11,0.9);border-radius:50px;font-size:10px;font-weight:600;color:white">
              Your listing
            </span>` : ''}

          <!-- Unread badge — clicking opens the chat directly -->
          ${unread > 0 ? html`
            <button
              @click=${openChatFromBadge}
              aria-label="View ${unread} unread message${unread > 1 ? 's' : ''}"
              title="You have ${unread} unread message${unread > 1 ? 's' : ''} — click to open chat"
              style="
                position: absolute;
                bottom: 10px;
                right: 10px;
                min-width: 22px;
                height: 22px;
                padding: 0 5px;
                background: #ef4444;
                border: 2px solid rgba(13,13,31,0.8);
                border-radius: 50px;
                color: white;
                font-size: 11px;
                font-weight: 700;
                font-family: inherit;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 3px;
                transition: all 0.18s;
                animation: badgePulse 2s ease-in-out infinite;
              "
              onmouseover="this.style.transform='scale(1.15)';this.style.background='#dc2626'"
              onmouseout="this.style.transform='scale(1)';this.style.background='#ef4444'"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              ${unread}
            </button>` : ''}
        </div>

        <!-- Body -->
        <div style="padding:16px;display:flex;flex-direction:column;flex:1">
          <h3 style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.88);line-height:1.4;margin:0 0 6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
            ${item.name}
          </h3>
          <p style="font-size:11px;color:rgba(255,255,255,0.38);line-height:1.5;margin:0 0 14px;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
            ${item.description}
          </p>

          <!-- Price row -->
          <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:8px">
            <div>
              <div style="font-size:20px;font-weight:700;color:#f59e0b;line-height:1;font-family:'Playfair Display',serif">
                ${this.$$(item.price)}
              </div>
              ${item.highestOffer ? html`
                <div style="font-size:10px;color:rgba(52,211,153,0.85);margin-top:3px">
                  Best: ${this.$$(item.highestOffer)}
                </div>` : ''}
            </div>

            ${!isSeller ? html`
              <button
                @click=${handleContact}
                aria-label="${user ? 'Chat about ' + item.name : 'Sign in to contact seller'}"
                style="
                  display: flex;
                  align-items: center;
                  gap: 5px;
                  padding: 7px 13px;
                  font-size: 11px;
                  font-weight: 600;
                  border-radius: 10px;
                  flex-shrink: 0;
                  cursor: pointer;
                  font-family: inherit;
                  transition: all 0.18s;
                  ${user
                    ? 'background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);color:#fbbf24'
                    : 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.6)'}
                "
                onmouseover="this.style.opacity='0.8'"
                onmouseout="this.style.opacity='1'"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  ${user
                    ? html`<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>`
                    : html`<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>`}
                </svg>
                ${user ? 'Chat' : 'Sign in'}
              </button>` : ''}
          </div>

          <!-- Seller meta -->
          <div style="display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06)">
            <div style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#ec4899);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:white;flex-shrink:0">
              ${item.sellerName[0].toUpperCase()}
            </div>
            <span style="font-size:11px;color:rgba(255,255,255,0.38);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.sellerName}</span>
            <span style="font-size:10px;color:rgba(255,255,255,0.22);margin-left:auto;flex-shrink:0">${this.ago(item.createdAt)}</span>
          </div>
        </div>
      </article>

      <style>
        @keyframes badgePulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50% { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
        }
      </style>
    `;
  }
}
