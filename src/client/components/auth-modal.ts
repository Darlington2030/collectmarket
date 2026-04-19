import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from './base-component.js';
import { usersApi } from '../utils/api.js';
import { LoginSchema } from '../utils/validators.js';

/**
 * Auth modal — lives at <body> level, NOT inside the header.
 * The header uses a separate <header-auth-trigger> for the sign-in button / user pill.
 * This avoids the backdrop-filter stacking context trap entirely.
 */
@customElement('auth-modal')
export class AuthModal extends BaseComponent {
  @state() private _tab: 'login' | 'register' = 'login';
  @state() private _name = '';
  @state() private _password = '';
  @state() private _confirm = '';
  @state() private _error = '';
  @state() private _loading = false;
  @state() private _open = false;

  // Listen for global open requests
  private _openHandler = (e: Event) => {
    const tab = (e as CustomEvent).detail?.tab || 'login';
    this._openModal(tab);
  };

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('open-auth', this._openHandler);
    window.addEventListener('require-auth', this._openHandler);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('open-auth', this._openHandler);
    window.removeEventListener('require-auth', this._openHandler);
  }

  private _openModal(tab: 'login' | 'register' = 'login') {
    this._tab = tab;
    this._open = true;
    this._error = '';
    this._name = '';
    this._password = '';
    this._confirm = '';
    document.body.style.overflow = 'hidden';
  }

  private _close = () => {
    this._open = false;
    this._error = '';
    this._loading = false;
    document.body.style.overflow = '';
  };

  private _switchTab = (tab: 'login' | 'register') => {
    this._tab = tab;
    this._error = '';
    this._name = '';
    this._password = '';
    this._confirm = '';
  };

  private _handleBackdropClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).dataset.backdrop === 'true') {
      this._close();
    }
  };

  private _submit = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();

    // Validate
    const v = LoginSchema.safeParse({ name: this._name, password: this._password });
    if (!v.success) {
      this._error = v.error.errors[0].message;
      return;
    }
    if (this._tab === 'register') {
      if (this._password !== this._confirm) {
        this._error = 'Passwords do not match';
        return;
      }
    }

    this._loading = true;
    this._error = '';

    try {
      const user = this._tab === 'login'
        ? await usersApi.login({ name: this._name, password: this._password })
        : await usersApi.register({ name: this._name, password: this._password });

      this.dispatch({ type: 'SET_USER', payload: user });
      this._close();
      window.dispatchEvent(new CustomEvent('user-logged-in', { detail: user }));
    } catch (err: any) {
      this._error = err.message ?? 'Something went wrong. Check your connection.';
    } finally {
      this._loading = false;
    }
  };

  override render() {
    if (!this._open) return html``;

    return html`
      <!-- Full-screen backdrop — data-backdrop lets click-outside-to-close work -->
      <div
        data-backdrop="true"
        @click=${this._handleBackdropClick}
        style="
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(0,0,0,0.78);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        ">

        <!-- Modal card -->
        <div
          role="dialog"
          aria-modal="true"
          aria-label="${this._tab === 'login' ? 'Sign in' : 'Create account'}"
          style="
            position: relative;
            width: 100%;
            max-width: 440px;
            background: #0d0d1f;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.06);
            overflow: hidden;
          ">

          <!-- Amber accent bar -->
          <div style="height:3px;background:linear-gradient(90deg,#f59e0b,#ea580c)"></div>

          <div style="padding: 32px 32px 28px;">

            <!-- Close button -->
            <button
              @click=${this._close}
              aria-label="Close modal"
              style="
                position: absolute;
                top: 14px; right: 14px;
                width: 30px; height: 30px;
                display: flex; align-items: center; justify-content: center;
                background: rgba(255,255,255,0.06);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 50%;
                color: rgba(255,255,255,0.5);
                cursor: pointer;
                font-size: 13px;
                font-family: inherit;
                transition: all 0.15s;
              "
              onmouseover="this.style.background='rgba(255,255,255,0.12)';this.style.color='white'"
              onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.color='rgba(255,255,255,0.5)'"
            >✕</button>

            <!-- Logo + title -->
            <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:24px">
              <div style="
                width:52px;height:52px;
                border-radius:16px;
                background:linear-gradient(135deg,#f59e0b,#ea580c);
                display:flex;align-items:center;justify-content:center;
                font-size:24px;color:white;
                margin-bottom:14px;
                box-shadow:0 8px 24px rgba(245,158,11,0.3)
              ">◈</div>
              <h2 style="
                font-size:22px;font-weight:700;color:white;
                margin:0 0 6px;
                font-family:'Playfair Display',Georgia,serif;
                text-align:center
              ">
                ${this._tab === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p style="font-size:13px;color:rgba(255,255,255,0.4);margin:0;text-align:center">
                ${this._tab === 'login'
                  ? 'Sign in to your collector account'
                  : 'Join the marketplace today — free'}
              </p>
            </div>

            <!-- Login / Register tabs -->
            <div style="display:flex;background:rgba(255,255,255,0.05);border-radius:12px;padding:4px;gap:4px;margin-bottom:22px">
              <button
                @click=${() => this._switchTab('login')}
                style="
                  flex:1;padding:10px 8px;
                  font-size:13px;font-weight:600;
                  border-radius:9px;border:none;cursor:pointer;
                  font-family:inherit;transition:all 0.18s;
                  ${this._tab === 'login'
                    ? 'background:linear-gradient(135deg,#f59e0b,#ea580c);color:white;box-shadow:0 4px 12px rgba(245,158,11,0.3)'
                    : 'background:transparent;color:rgba(255,255,255,0.48)'}
                ">
                Sign In
              </button>
              <button
                @click=${() => this._switchTab('register')}
                style="
                  flex:1;padding:10px 8px;
                  font-size:13px;font-weight:600;
                  border-radius:9px;border:none;cursor:pointer;
                  font-family:inherit;transition:all 0.18s;
                  ${this._tab === 'register'
                    ? 'background:linear-gradient(135deg,#f59e0b,#ea580c);color:white;box-shadow:0 4px 12px rgba(245,158,11,0.3)'
                    : 'background:transparent;color:rgba(255,255,255,0.48)'}
                ">
                Create Account
              </button>
            </div>

            <!-- Error message -->
            ${this._error ? html`
              <div style="
                display:flex;align-items:flex-start;gap:9px;
                padding:12px 14px;margin-bottom:18px;
                background:rgba(239,68,68,0.1);
                border:1px solid rgba(239,68,68,0.28);
                border-radius:10px;
                color:#fca5a5;font-size:13px;line-height:1.4
              ">
                <span style="flex-shrink:0;font-size:14px;margin-top:1px">⚠</span>
                <span>${this._error}</span>
              </div>` : ''}

            <!-- Form -->
            <form @submit=${this._submit} novalidate style="display:flex;flex-direction:column;gap:15px">

              <!-- Username field -->
              <div>
                <label style="
                  display:block;
                  font-size:11px;font-weight:600;
                  color:rgba(255,255,255,0.4);
                  text-transform:uppercase;letter-spacing:0.08em;
                  margin-bottom:8px
                ">Username</label>
                <input
                  type="text"
                  autocomplete="username"
                  .value=${this._name}
                  @input=${(e: Event) => { this._name = (e.target as HTMLInputElement).value; }}
                  placeholder="e.g. ComicCollector"
                  style="
                    width:100%;box-sizing:border-box;
                    background:rgba(255,255,255,0.05);
                    border:1.5px solid rgba(255,255,255,0.1);
                    border-radius:12px;
                    padding:13px 16px;
                    color:white;font-size:14px;
                    outline:none;font-family:inherit;
                    transition:border-color 0.2s,background 0.2s;
                  "
                  @focus=${(e: Event) => {
                    (e.target as HTMLInputElement).style.borderColor = 'rgba(245,158,11,0.6)';
                    (e.target as HTMLInputElement).style.background = 'rgba(255,255,255,0.07)';
                  }}
                  @blur=${(e: Event) => {
                    (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)';
                    (e.target as HTMLInputElement).style.background = 'rgba(255,255,255,0.05)';
                  }}
                />
              </div>

              <!-- Password field -->
              <div>
                <label style="
                  display:block;
                  font-size:11px;font-weight:600;
                  color:rgba(255,255,255,0.4);
                  text-transform:uppercase;letter-spacing:0.08em;
                  margin-bottom:8px
                ">Password</label>
                <input
                  type="password"
                  autocomplete="${this._tab === 'login' ? 'current-password' : 'new-password'}"
                  .value=${this._password}
                  @input=${(e: Event) => { this._password = (e.target as HTMLInputElement).value; }}
                  placeholder="••••••••"
                  minlength="3"
                  style="
                    width:100%;box-sizing:border-box;
                    background:rgba(255,255,255,0.05);
                    border:1.5px solid rgba(255,255,255,0.1);
                    border-radius:12px;
                    padding:13px 16px;
                    color:white;font-size:14px;
                    outline:none;font-family:inherit;
                    transition:border-color 0.2s,background 0.2s;
                  "
                  @focus=${(e: Event) => {
                    (e.target as HTMLInputElement).style.borderColor = 'rgba(245,158,11,0.6)';
                    (e.target as HTMLInputElement).style.background = 'rgba(255,255,255,0.07)';
                  }}
                  @blur=${(e: Event) => {
                    (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)';
                    (e.target as HTMLInputElement).style.background = 'rgba(255,255,255,0.05)';
                  }}
                />
              </div>

              <!-- Confirm password — register tab only -->
              ${this._tab === 'register' ? html`
                <div>
                  <label style="
                    display:block;
                    font-size:11px;font-weight:600;
                    color:rgba(255,255,255,0.4);
                    text-transform:uppercase;letter-spacing:0.08em;
                    margin-bottom:8px
                  ">Confirm Password</label>
                  <input
                    type="password"
                    autocomplete="new-password"
                    .value=${this._confirm}
                    @input=${(e: Event) => { this._confirm = (e.target as HTMLInputElement).value; }}
                    placeholder="••••••••"
                    style="
                      width:100%;box-sizing:border-box;
                      background:rgba(255,255,255,0.05);
                      border:1.5px solid rgba(255,255,255,0.1);
                      border-radius:12px;
                      padding:13px 16px;
                      color:white;font-size:14px;
                      outline:none;font-family:inherit;
                      transition:border-color 0.2s,background 0.2s;
                    "
                    @focus=${(e: Event) => {
                      (e.target as HTMLInputElement).style.borderColor = 'rgba(245,158,11,0.6)';
                      (e.target as HTMLInputElement).style.background = 'rgba(255,255,255,0.07)';
                    }}
                    @blur=${(e: Event) => {
                      (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.1)';
                      (e.target as HTMLInputElement).style.background = 'rgba(255,255,255,0.05)';
                    }}
                  />
                </div>` : ''}

              <!-- Submit button -->
              <button
                type="submit"
                ?disabled=${this._loading}
                style="
                  width:100%;padding:14px 20px;
                  background:linear-gradient(135deg,#f59e0b,#ea580c);
                  color:white;font-size:15px;font-weight:700;
                  border-radius:12px;border:none;
                  cursor:${this._loading ? 'not-allowed' : 'pointer'};
                  opacity:${this._loading ? '0.65' : '1'};
                  font-family:inherit;
                  box-shadow:0 6px 24px rgba(245,158,11,0.28);
                  transition:opacity 0.2s,transform 0.15s;
                  margin-top:4px;
                "
                onmouseover="if(!this.disabled){this.style.transform='translateY(-1px)';this.style.boxShadow='0 10px 30px rgba(245,158,11,0.38)'}"
                onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 6px 24px rgba(245,158,11,0.28)'"
              >
                ${this._loading
                  ? html`<span style="display:flex;align-items:center;justify-content:center;gap:8px">
                      <svg style="animation:spin .8s linear infinite" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                      Processing…
                    </span>`
                  : (this._tab === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <!-- Switch tab -->
            <p style="text-align:center;font-size:12px;color:rgba(255,255,255,0.3);margin:18px 0 0">
              ${this._tab === 'login' ? "Don't have an account?" : 'Already have an account?'}
              <button
                @click=${() => this._switchTab(this._tab === 'login' ? 'register' : 'login')}
                style="
                  background:none;border:none;cursor:pointer;
                  font-size:12px;font-family:inherit;
                  color:#fbbf24;text-decoration:underline;margin-left:5px;
                "
              >
                ${this._tab === 'login' ? 'Create one free' : 'Sign in instead'}
              </button>
            </p>

          </div><!-- /padding -->
        </div><!-- /card -->
      </div><!-- /backdrop -->

      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;
  }
}
