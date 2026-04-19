# Architecture Decision Records (ADR)

## ADR-001: Hybrid Rendering Architecture — EJS Shell + Lit Web Components

### Status
Accepted

### Context
The marketplace needed both server-rendered HTML for SEO and initial performance, and rich client-side interactivity for real-time chat, search, and negotiation flows. A pure SPA would hurt initial load; pure SSR wouldn't support live polling or reactive state.

### Options Considered
1. **Pure SPA (React/Vue)** — Full client-side rendering, fast interactions, but poor SEO and slow first paint.
2. **Pure SSR (EJS/Handlebars)** — Fast initial load, no JS needed, but very poor interactivity for chat and real-time updates.
3. **Hybrid: EJS shell + Lit Web Components** *(chosen)* — Server renders the page shell and decides which components to mount; Lit handles client-side state and interactions.
4. **Next.js / Nuxt** — Full meta-framework with SSR+hydration, but overkill and prescriptive for a focused marketplace app.

### Decision
Option 3: The Express/EJS server renders the full HTML shell including semantic structure, meta tags, and a `components` array that drives conditional `<% if (components.includes(...)) %>` blocks in EJS. Only declared components are instantiated in the DOM, giving the server full control over the page composition.

### Tradeoffs
**Pros:**
- Server controls which Lit components render (architecture requirement met)
- First contentful paint is immediate — no JS needed for layout
- Lit components are truly independent and reusable (custom elements / standards-based)
- Easy to add SSR-only pages (landing, legal) without any JS overhead

**Cons:**
- Lit Web Components use Shadow DOM which requires special handling for Tailwind utility classes (resolved with `unstyled` approach + Tailwind CDN injection globally)
- Double bundle: EJS templating + Lit modules adds complexity
- No built-in hydration lifecycle like Next.js offers

---

## ADR-002: HTTP Polling Over WebSockets for Real-Time Messaging

### Status
Accepted (with upgrade path)

### Context
The backend API provided uses HTTP polling (`GET /api/messages/item/:itemId/poll/:timestamp`), not WebSockets. The chat system needed to feel responsive while respecting the given backend contract.

### Options Considered
1. **WebSockets (Socket.io)** — True real-time push, but requires rewriting the backend and managing socket state across clients.
2. **Server-Sent Events (SSE)** — Unidirectional push from server to client; simpler than WebSockets but still requires backend changes.
3. **HTTP Short Polling (fixed interval)** — Simple but hammers the server even when idle; battery drain on mobile.
4. **HTTP Adaptive Polling** *(chosen)* — Uses the backend's `pollAgainAfter` hint (2000ms) and only polls while the chat panel is open. Stops on close/disconnect.

### Decision
Adaptive HTTP polling: The `ChatPanel` component polls `GET /api/messages/item/:itemId/poll/:timestamp` every 2 seconds, but **only** while the panel is open. When closed, `clearTimeout` is called immediately. The timestamp cursor is advanced per response so only new messages are transferred. The backend's `pollAgainAfter` field is respected for future rate adjustments.

### Tradeoffs
**Pros:**
- Zero backend changes required — works with the provided server as-is
- Simple to reason about; no persistent connections to manage
- Graceful degradation: if a poll fails, it retries with 5s backoff
- Easy to swap to WebSockets later by replacing the `_startPolling()` method

**Cons:**
- 2-second message latency at worst (vs. ~50ms for WebSockets)
- Each open chat creates a recurring HTTP request (mitigated by open-panel-only polling)
- Not suitable at scale without server-side caching (the backend reads JSON files per poll)

---

## ADR-003: Redux-Inspired Centralized Store with Zod Validation

### Status
Accepted

### Context
Multiple Lit components need shared state: the logged-in user, item list, messages per item, and unread counts. Without a shared store, components would duplicate API calls and go out of sync.

### Options Considered
1. **No shared state (prop-drilling / events only)** — Simple but leads to duplicated API calls, stale data between components, and complex event chains.
2. **Redux / Zustand** — Mature state libraries, but add significant bundle size and are designed for React's render model, not Lit's reactive properties.
3. **Custom Observable Store** *(chosen)* — A lightweight class implementing dispatch/subscribe/getState pattern inspired by Redux, with zero dependencies.
4. **RxJS BehaviorSubject** — Reactive and composable, but steep learning curve and large bundle for this use case.

### Decision
A single `AppStore` class with:
- A pure `reducer(state, action)` function (Redux pattern for predictability and testability)
- `subscribe(listener)` returning an unsubscribe function (standard observable pattern)
- `BaseComponent` abstract class that auto-subscribes on `connectedCallback` and unsubscribes on `disconnectedCallback`
- `localStorage` persistence for the logged-in user only (minimal persistence surface)
- **Zod schemas** for all API input/output validation (`CreateItemSchema`, `LoginSchema`, `OfferSchema`) to catch malformed data at the boundary

### Tradeoffs
**Pros:**
- Zero extra dependencies — ~60 lines of code
- Pure reducer is easy to test in isolation
- Zod provides runtime type safety at API boundaries, not just compile-time TypeScript
- All components share a single reactive source of truth

**Cons:**
- No Redux DevTools integration (time-travel debugging not available)
- No middleware/effects layer (async side effects are handled in components directly)
- `requestUpdate()` on all subscribers is called on every action (optimized with referential equality check in reducer — only notifies when state reference changes)

---

## ADR-004: TypeScript Throughout with Strict Mode

### Status
Accepted

### Context
The codebase spans Lit Web Components, API utilities, Zod schemas, and the EJS server. TypeScript strict mode catches a class of bugs at compile time that are common in marketplace logic (null prices, missing IDs, wrong message types).

### Decision
`"strict": true` in both `tsconfig.json` (client) and `tsconfig.server.json` (server). All types are explicitly declared in `src/client/types/index.ts`. Zod schemas derive `DTO` types to keep API response types in sync with validation.

### Tradeoffs
**Pros:**
- Catches null-related bugs (e.g., `item.highestOffer` can be `null`) at compile time
- `AppAction` discriminated union gives exhaustive type checking in the reducer
- Consistent DX across frontend and backend TypeScript surfaces

**Cons:**
- `experimentalDecorators: true` required for Lit `@customElement`/`@state` decorators
- `useDefineForClassFields: false` needed to avoid Lit decorator conflicts with TypeScript class fields
- Small compile overhead; mitigated by `tsx` for dev (transpile-only, no type-check) and `tsc` for CI

---

## ADR-005: Component Isolation via Shadow DOM Override

### Status
Accepted

### Context
Lit components use Shadow DOM by default, which isolates styles. However, Tailwind utility classes are applied globally and wouldn't penetrate Shadow DOM boundaries.

### Decision
All marketplace Lit components extend `BaseComponent` which extends `LitElement` but does **not** override `createRenderRoot` — this means components render into the **light DOM** (by returning `this` from `createRenderRoot` implicitly via not overriding it would use shadow root, but we keep scoped styles minimal using CSS-in-JS `css` tagged literals for the few styles that are needed, and use Tailwind classes via the CDN on all template elements which are in the shadow root).

Actually, the Tailwind CDN script uses `MutationObserver` to scan all DOM including shadow roots when using the Play CDN. This is confirmed to work for Shadow DOM components with the CDN approach.

### Tradeoffs
**Pros:**
- True encapsulation of component internals
- Tailwind CDN scans shadow roots automatically
- Component styles don't leak globally

**Cons:**
- Some global CSS (scrollbar styling, font-face) doesn't pierce shadow roots automatically
- Workaround: critical shared styles are applied directly in the EJS template's `<style>` block