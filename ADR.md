# Architecture Decision Records (ADR)
## CollectMarket — Social Marketplace

> This document captures the major technical decisions made during the design and
> implementation of CollectMarket, including context, alternatives considered,
> the chosen solution, and the tradeoffs involved.

---

## ADR-001 — Hybrid Rendering: EJS Shell + Lit Web Components

### Status
**Accepted** — Implemented in production

### Context
CollectMarket required two competing qualities simultaneously:
- **Fast initial load & SEO-friendliness** — the page shell, header, and hero section
  should render without JavaScript.
- **Rich, reactive UI** — real-time chat, live offer negotiation, dynamic item grids,
  and modals that update instantly without page reloads.

A pure client-side SPA (React/Vue) would hurt first-contentful-paint and SEO. Pure
server-side rendering (classic EJS/Handlebars) can't support a live messaging system
without polling hacks. Meta-frameworks (Next.js, SvelteKit) solve this but introduce
opinionated routing and build complexity incompatible with the EJS requirement.

### Options Considered

| Option | Description |
|---|---|
| Pure SPA (React/Vue) | Full client rendering; fast interactions but slow initial paint, no server component control |
| Pure SSR (EJS) | Fast initial load but no reactive state; requires full page reloads for updates |
| **Hybrid: EJS + Lit** *(chosen)* | Server renders the shell; Lit handles all interactive components in light DOM |
| Next.js / Nuxt | Full meta-framework with SSR+hydration; overkill, conflicts with EJS requirement |
| HTMX | Server-driven HTML fragments; elegant but polling-heavy for real-time chat |

### Decision
**EJS for the page shell, Lit Web Components for all interactive UI.**

The Express/EJS server renders the full HTML document, including a `components` array
that drives conditional `<% if (components.includes('auth-modal')) %>` blocks. Only
components declared by the server are mounted — the server determines what renders.

All Lit components override `createRenderRoot()` to return `this` (light DOM rendering),
which allows Tailwind CSS utility classes to apply normally through the global stylesheet.
Modals are placed at `<body>` level in the EJS template, outside any stacking contexts.

### Tradeoffs

**Pros:**
- Server fully controls which components render — a core architecture requirement
- First contentful paint is immediate (no JS required for layout)
- Lit custom elements are standards-based and framework-agnostic
- Easy to add purely server-rendered pages (legal, landing) with zero JS overhead
- Light DOM rendering solves the Tailwind Shadow DOM incompatibility

**Cons:**
- `createRenderRoot()` override removes Lit's style encapsulation; component styles
  must be careful not to conflict with global styles
- Two separate concerns (EJS template logic + Lit state) add cognitive overhead
- No built-in hydration lifecycle like Next.js — initial data must be fetched by
  components after mount

---

## ADR-002 — HTTP Adaptive Polling for Real-Time Chat

### Status
**Accepted** — Matches backend contract; upgrade path documented

### Context
The backend API provided uses HTTP polling endpoints:
```
GET /api/messages/item/:itemId/poll/:timestamp
```
The response includes a `pollAgainAfter: 2000` hint. The chat system needed to feel
responsive while operating within this constraint. True WebSocket support would require
rewriting the backend server, which was outside scope.

### Options Considered

| Option | Description |
|---|---|
| WebSockets (Socket.io) | True bidirectional push; ~50ms latency; requires backend rewrite |
| Server-Sent Events | Server-to-client push; still requires new backend endpoints |
| Fixed Interval Polling | Simple `setInterval`; hammers server even when chat is inactive |
| **Adaptive HTTP Polling** *(chosen)* | Polls only while chat panel is open; respects `pollAgainAfter` hint |
| Long-Polling | Keeps connection open until new messages; complex error handling |

### Decision
**Adaptive polling: poll every 2 seconds, only while the chat panel is open.**

The `ChatPanel` Lit component starts polling in `openForItem()` and calls
`clearTimeout()` in `close()` and `disconnectedCallback()`. The timestamp cursor
advances with each response so only genuinely new messages are transferred. On poll
failure, the interval backs off to 5 seconds.

```typescript
// Pattern: schedule next poll only after current completes
private _startPoll() {
  this._poll = setTimeout(async () => {
    const result = await messagesApi.poll(itemId, this._lastTs);
    if (result.hasNew) { /* update state */ }
    if (this._open) this._startPoll(); // reschedule only if still open
  }, 2000);
}
```

The unread badge counter uses a separate 8-second interval that polls
`/api/messages/unread/:userId` while a user is logged in.

### Tradeoffs

**Pros:**
- Zero backend changes — works with the provided server as-is
- Simple to reason about; no persistent connection state
- Graceful degradation: network errors don't crash the UI
- Easy to swap to WebSockets by replacing `_startPoll()` with a socket listener

**Cons:**
- 2-second maximum message latency (vs ~50ms for WebSockets)
- Every open chat generates HTTP requests every 2 seconds
- Not suitable at scale without server-side caching (the server reads JSON per poll)
- Battery drain on mobile if many chats are open simultaneously

---

## ADR-003 — Redux-Inspired Observable Store with Zod Validation

### Status
**Accepted** — Core state management pattern throughout the app

### Context
Multiple Lit components across the page need to share and react to the same state:
the logged-in user, item listings, per-item messages, unread counts, loading states,
and error flags. Without a shared store:
- Components duplicate API calls
- State diverges between views
- Passing data down via properties creates deep, brittle prop-chains in Web Components

The project required "advanced state management" (Redux, Zod, Query.js, etc.) while
keeping the bundle small and avoiding React-specific libraries.

### Options Considered

| Option | Description |
|---|---|
| Redux Toolkit | Battle-tested; excellent DevTools; designed for React's render model |
| Zustand | Minimal and flexible; still React-centric with hooks API |
| MobX | Observable objects; powerful but adds significant bundle size |
| **Custom Observable Store + Zod** *(chosen)* | ~80 lines; pure TypeScript; framework-agnostic |
| RxJS BehaviorSubject | Reactive streams; steep learning curve; large bundle |
| Component-level state only | Simple but leads to duplicated API calls and stale UI |

### Decision
**A custom `AppStore` class implementing the Redux pattern (dispatch/reduce/subscribe)
with Zod schemas for API boundary validation.**

```typescript
// Pure reducer — predictable, testable, no side effects
function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':     return { ...state, user: action.payload };
    case 'ADD_ITEM':     return { ...state, items: [action.payload, ...state.items] };
    case 'ADD_MESSAGE': {
      const existing = state.messages[action.payload.itemId] ?? [];
      if (existing.find(m => m.id === action.payload.id)) return state; // deduplicate
      return { ...state, messages: { ...state.messages, [action.payload.itemId]: [...existing, action.payload] } };
    }
    // ... discriminated union ensures exhaustive matching
  }
}
```

The `BaseComponent` abstract class auto-subscribes on `connectedCallback` and
unsubscribes on `disconnectedCallback`, so every Lit component gets reactive
updates with zero boilerplate.

**Zod schemas** validate all API inputs at the boundary:
```typescript
export const CreateItemSchema = z.object({
  name: z.string().min(3).max(100),
  price: z.number().positive().max(1_000_000),
  sellerId: z.string().min(1),
  // ...
});
// Runtime type safety at API call sites — catches malformed responses
```

The logged-in user is persisted to `localStorage` so sessions survive page refreshes.

### Tradeoffs

**Pros:**
- Zero external runtime dependencies for state management
- Pure reducer is trivially unit-testable in isolation
- `AppAction` discriminated union gives exhaustive compile-time checking
- Zod catches malformed API responses at runtime, not silently
- No middleware complexity — async side effects are handled in components

**Cons:**
- No Redux DevTools time-travel debugging
- No middleware/effects layer (thunks, sagas) — async must live in components
- `requestUpdate()` called on all subscribers per dispatch; mitigated by referential
  equality check (reducer returns same reference if state didn't change)
- Must manually keep Zod schemas in sync with TypeScript types

---

## ADR-004 — TypeScript Strict Mode Throughout

### Status
**Accepted** — Enforced from day one

### Context
The codebase spans Lit Web Components, Express API routes, Zod schemas, and the Redux-
style store. Marketplace logic has several classes of common bugs that TypeScript strict
mode catches at compile time:
- `item.highestOffer` can be `null` — accessing `.toFixed()` on null crashes at runtime
- Message `type` is a string enum; wrong type strings silently pass without TypeScript
- API response shapes change — TypeScript surfaces the mismatch immediately

### Options Considered

| Option | Description |
|---|---|
| No TypeScript (plain JS) | Zero setup; no compile step; runtime errors only |
| TypeScript with `strict: false` | Some safety; misses null checks and implicit any |
| **TypeScript `strict: true`** *(chosen)* | All strict checks; catches null, any, unreachable code |
| Flow | Facebook's type system; smaller ecosystem; less tooling support |

### Decision
`"strict": true` in both `tsconfig.json` (client) and `tsconfig.server.json` (server).
All domain types are centralized in `src/client/types/index.ts`. Zod `infer<>` derives
DTO types from schemas to keep them in sync:

```typescript
export const ItemSchema = z.object({
  id: z.string(),
  price: z.number(),
  highestOffer: z.number().nullable(),  // TypeScript forces null checks everywhere
  status: z.enum(['active', 'pending_payment', 'sold']),
  // ...
});
export type ItemDTO = z.infer<typeof ItemSchema>;
```

Lit decorators require `experimentalDecorators: true` and `useDefineForClassFields: false`
to avoid a conflict between TypeScript's class fields transform and Lit's property system.
`tsx` is used for development (transpile-only, fast) while `tsc` validates types in CI.

### Tradeoffs

**Pros:**
- Null-related bugs caught at compile time (e.g., `item.highestOffer?.toFixed(0)`)
- `AppAction` discriminated union gives exhaustive `switch` checking in the reducer
- IDE autocomplete is accurate and complete throughout the codebase
- Zod + TypeScript creates a double safety net: compile-time + runtime

**Cons:**
- `experimentalDecorators` + `useDefineForClassFields: false` is a non-obvious Lit
  gotcha that causes confusing errors without documentation
- Slightly longer build cycle for type-checking (mitigated by `tsx` in dev)
- Strict null checks require more explicit optional chaining (`?.` and `??`)
  throughout, especially when reading MongoDB documents

---

## ADR-005 — Embedded Full-Stack Server (No Separate Backend)

### Status
**Accepted** — Simplifies deployment; critical for Vercel compatibility

### Context
Originally the project had a separate backend (port 3001) proxied through the frontend
(port 4000). This caused multiple failure modes in practice:
- Backend process died between bash invocations in the development environment
- Vercel cannot run two persistent processes; only one serverless function is supported
- The HTTP proxy added latency and a failure point for every API call
- Developers had to start two servers to run the application

### Options Considered

| Option | Description |
|---|---|
| Separate processes (original) | Clean separation of concerns; two ports; proxy required |
| **Embedded routes in single server** *(chosen)* | All API routes co-located with EJS server; one `npm start` |
| Microservices | Overkill for a marketplace MVP; complex orchestration |
| Serverless functions (per-route) | Vercel-native; requires refactoring every route to a separate file |

### Decision
**All Express API routes are defined directly in `src/server/index.ts` alongside the
EJS page routes.** The server exports `app` for Vercel's serverless wrapper:

```typescript
// Single entry point — works both locally and on Vercel
export const app = express();
// ... all routes defined here ...

// Only start listening when running locally (not on Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Running on ${PORT}`));
}
export default app;
```

For Vercel, `api/index.ts` re-exports the app and `vercel.json` routes all traffic
through it. For local development, `tsx src/server/index.ts` starts a standard HTTP
server on port 4000.

### Tradeoffs

**Pros:**
- Single `npm start` command runs the entire application
- Zero latency between "frontend" and "backend" — no HTTP hop for API calls
- Vercel deployment works without any architectural changes
- Simpler mental model: one process, one port, one log stream

**Cons:**
- Frontend and API concerns are co-located, reducing separation
- Scaling frontend and API independently is not possible without splitting again
- A bug in any API route can crash the page server (mitigated by Express error middleware)
- Bundling `node_modules` for Vercel is larger than a dedicated API-only package

---

## Bonus Feature Checklist

| Feature | Status | Notes |
|---|---|---|
| ✅ Advanced State Management | **Implemented** | Custom Redux-like `AppStore` with Zod validation (ADR-003) |
| ✅ Fully Responsive Design | **Implemented** | Mobile-first grid (1→2→3→4 cols), bottom-sheet modals on mobile, collapsible search, responsive hero |
| ✅ TypeScript Usage | **Implemented** | Strict mode throughout; discriminated unions; Zod-inferred types (ADR-004) |
| ✅ Checkout & Payment Flow | **Implemented** | Buyer checkout modal → `POST /checkout` → seller notification → seller confirm → item removed |
| ✅ Direct Messaging | **Implemented** | HTTP adaptive polling (ADR-002); per-item message threads; read receipts |
| ✅ Price Negotiation | **Implemented** | Offer → Accept/Reject → Checkout with negotiated price |
| ✅ Search | **Implemented** | Debounced keyword search; server-side filtering |
| ✅ Hybrid SSR + CSR | **Implemented** | EJS shell + Lit Web Components (ADR-001) |
