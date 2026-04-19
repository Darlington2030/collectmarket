import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BaseComponent } from './base-component.js';

/**
 * Lives inside the header — shows Sign In button OR user pill.
 * Dispatches 'open-auth' event picked up by <auth-modal> at body level.
 * NO modals here — avoids backdrop-filter stacking context trap.
 */
@customElement('header-auth')
export class HeaderAuth extends BaseComponent {

  private _openLogin = () => {
    window.dispatchEvent(new CustomEvent('open-auth', { detail: { tab: 'login' } }));
  };

  private _logout = () => {
    this.dispatch({ type: 'SET_USER', payload: null });
    window.dispatchEvent(new CustomEvent('toast', { detail: { msg: 'Signed out successfully', type: 'info' } }));
  };

  override render() {
    const u = this.state.user;

    if (u) return html`
      <div style="display:flex;align-items:center;gap:8px">
        <!-- User pill (desktop) -->
        <div style="
          display:none;
          align-items:center;gap:8px;
          padding:5px 12px 5px 6px;
          background:rgba(255,255,255,0.07);
          border:1px solid rgba(255,255,255,0.1);
          border-radius:50px;
          @media(min-width:640px){display:flex}
        " class="hidden sm:flex">
          <div style="
            width:26px;height:26px;border-radius:50%;
            background:linear-gradient(135deg,#fbbf24,#ea580c);
            display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:700;color:white;flex-shrink:0
          ">${u.name[0].toUpperCase()}</div>
          <span style="font-size:13px;font-weight:500;color:rgba(255,255,255,0.82);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.name}</span>
        </div>
        <!-- Avatar only (mobile) -->
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:linear-gradient(135deg,#fbbf24,#ea580c);
          display:flex;align-items:center;justify-content:center;
          font-size:13px;font-weight:700;color:white;flex-shrink:0
        " class="sm:hidden">${u.name[0].toUpperCase()}</div>
        <!-- Sign out -->
        <button
          @click=${this._logout}
          style="
            padding:6px 13px;
            font-size:12px;font-weight:500;
            color:rgba(255,255,255,0.48);
            border:1px solid rgba(255,255,255,0.12);
            border-radius:50px;background:transparent;
            cursor:pointer;font-family:inherit;
            transition:all 0.18s;
          "
          onmouseover="this.style.color='white';this.style.borderColor='rgba(255,255,255,0.28)'"
          onmouseout="this.style.color='rgba(255,255,255,0.48)';this.style.borderColor='rgba(255,255,255,0.12)'"
        >Sign out</button>
      </div>`;

    return html`
      <button
        @click=${this._openLogin}
        style="
          padding:9px 20px;
          background:linear-gradient(135deg,#f59e0b,#ea580c);
          color:white;font-size:13px;font-weight:600;
          border-radius:50px;border:none;
          cursor:pointer;font-family:inherit;
          box-shadow:0 4px 16px rgba(245,158,11,0.25);
          transition:opacity 0.18s,transform 0.15s;
          white-space:nowrap;
        "
        onmouseover="this.style.opacity='0.88';this.style.transform='translateY(-1px)'"
        onmouseout="this.style.opacity='1';this.style.transform='translateY(0)'"
      >Sign In</button>`;
  }
}
