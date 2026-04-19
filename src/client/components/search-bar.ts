import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from './base-component.js';
import { itemsApi } from '../utils/api.js';

@customElement('search-bar')
export class SearchBar extends BaseComponent {
  @state() private _q = '';
  private _timer?: ReturnType<typeof setTimeout>;

  private _input(e: Event) {
    this._q = (e.target as HTMLInputElement).value;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._search(), 380);
  }

  private async _search() {
    this.dispatch({ type: 'SET_LOADING', payload: true });
    this.dispatch({ type: 'SET_SEARCH', payload: this._q });
    try {
      this.dispatch({ type: 'SET_ITEMS', payload: await itemsApi.getAll(this._q) });
    } catch (e: any) {
      this.dispatch({ type: 'SET_ERROR', payload: e.message });
    } finally {
      this.dispatch({ type: 'SET_LOADING', payload: false });
    }
  }

  override render() {
    return html`
      <div style="position:relative;width:100%">
        <!-- Search icon -->
        <svg style="position:absolute;left:13px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:rgba(255,255,255,0.38);pointer-events:none;flex-shrink:0"
             fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3" stroke-linecap="round"/>
        </svg>

        <input
          type="text"
          .value=${this._q}
          @input=${this._input}
          placeholder="Search comics, cards, figures…"
          aria-label="Search marketplace items"
          style="
            width: 100%;
            box-sizing: border-box;
            background: rgba(255,255,255,0.07);
            border: 1.5px solid rgba(255,255,255,0.1);
            border-radius: 50px;
            padding: 10px 38px 10px 38px;
            color: white;
            font-size: 14px;
            font-family: 'DM Sans', system-ui, sans-serif;
            outline: none;
            transition: border-color 0.2s, background 0.2s;
            -webkit-text-fill-color: white;
          "
          @focus=${(e: Event) => {
            const el = e.target as HTMLInputElement;
            el.style.borderColor = 'rgba(245,158,11,0.55)';
            el.style.background = 'rgba(255,255,255,0.1)';
          }}
          @blur=${(e: Event) => {
            const el = e.target as HTMLInputElement;
            el.style.borderColor = 'rgba(255,255,255,0.1)';
            el.style.background = 'rgba(255,255,255,0.07)';
          }}
        />

        <!-- Clear button -->
        ${this._q ? html`
          <button
            @click=${() => { this._q = ''; this._search(); }}
            aria-label="Clear search"
            style="
              position: absolute;
              right: 12px;
              top: 50%;
              transform: translateY(-50%);
              background: rgba(255,255,255,0.1);
              border: none;
              color: rgba(255,255,255,0.55);
              cursor: pointer;
              width: 18px;
              height: 18px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0;
              transition: all 0.18s;
            "
            onmouseover="this.style.background='rgba(255,255,255,0.2)';this.style.color='white'"
            onmouseout="this.style.background='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.55)'"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>` : ''}
      </div>

      <style>
        /* Ensure placeholder is styled correctly */
        search-bar input::placeholder { color: rgba(255,255,255,0.3); }
        search-bar input::-webkit-input-placeholder { color: rgba(255,255,255,0.3); }
      </style>
    `;
  }
}
