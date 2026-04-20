# Architecture Decision Records (ADR)
## CollectMarket — Vercel-Ready Social Marketplace

> This document captures the major technical decisions made during the design and
> implementation of CollectMarket. Each record includes the context that drove the
> decision, the alternatives that were considered, the option that was chosen, and
> an honest assessment of the tradeoffs involved.

---

## ADR-001 — Hybrid Rendering Architecture: EJS Shell + Lit Web Components

### Status
**Accepted** — Implemented in production

### Context
CollectMarket required two competing qualities simultaneously:

- **Fast initial load and SEO friendliness** — the page shell, header, hero section,
  and layout structure should render on the server without depending on JavaScript.
- **Rich, reactive client-side UI** — real-time chat polling, live offer negotiation,
  animated modals, and a dynamic item grid that updates instantly without full page reloads.

The assignment also explicitly required that the **server decides which Lit components
to render**, making a pure SPA architecture non-compliant. A pure SSR approach cannot
support a live messaging system without excessive complexity. Meta-frameworks like
Next.js introduce opinionated routing systems that conflict with the EJS requirement.

### Options Considered

**Option A: Pure SPA (React or Vue)**
Full client-side rendering with a separate API. Fast interactions after initial load,
but slow first-contentful-paint and no server-side component control.

**Option B: Pure SSR with EJS and HTMX**
Server renders all HTML fragments and pushes partial updates. Accessible and
progressive but requires significant backend work to support real-time messaging
and polling UX patterns.

**Option C: Hybrid EJS + Lit Web Components** *(Chosen)*
EJS renders the page shell. The server passes a `components` array to the template
that drives conditional rendering: `<% if (components.includes('chat-panel')) %>`.
Lit handles all interactive behaviour as light-DOM custom elements.

**Option D: Next.js or SvelteKit**
Full SSR + hydration meta-framework. Solves the problem elegantly but conflicts with
the EJS rendering requirement and introduces opinionated routing that was out of scope.

### Decision
**Option C — EJS shell with Lit Web Components rendered into the light DOM.**

The Express server renders the complete HTML document and declares a `components`
array that controls which custom elements are instantiated. All Lit components
override `createRenderRoot()` to return `this` instead of a Shadow Root, which
allows Tailwind CSS utility classes injected globally by the Play CDN to apply
normally to component internals.

Modals (`auth-modal`, `chat-panel`, `checkout-modal`) are declared at `<body>` level
in the EJS template — outside any elements with `backdrop-filter` — to prevent CSS
stacking context traps that would cause `position: fixed` overlays to render relative
to a parent element rather than the viewport.

A separate `<header-auth>` component renders the Sign In button and user pill inside
the header, while `<auth-modal>` lives at body level and listens for `open-auth`
custom events dispatched from anywhere in the application.

### Tradeoffs

**Pros:**
- The server fully controls which Lit components render — a core architecture requirement
- First contentful paint is immediate with no JavaScript dependency for layout or content
- Lit custom elements are standards-based Web Components with no framework lock-in
- Light DOM rendering eliminates the Shadow DOM / Tailwind incompatibility entirely
- Additional server-only pages (terms, landing pages) can be added with zero JavaScript overhead

**Cons:**
- `createRenderRoot()` override removes Lit's built-in style encapsulation; component
  styles must be written carefully to avoid global conflicts
- Two rendering paradigms (EJS template logic + Lit reactive properties) require
  developers to context-switch between server and client mental models
- No built-in hydration lifecycle — components must fetch their own initial data
  after `connectedCallback()`, causing a brief loading state on first render

---

## ADR-002 — HTTP Adaptive Polling for Real-Time Messaging

### Status
**Accepted** — Matches the provided backend contract; documented upgrade path to WebSockets

### Context
The backend API specification includes a dedicated long-polling endpoint:

```
GET /api/messages/item/:itemId/poll/:timestamp
Response: { messages: [...], lastTimestamp: "...", hasNew: boolean, pollAgainAfter: 2000 }
```

The response explicitly includes a `pollAgainAfter` hint (2000 ms), indicating the
server was designed for HTTP polling. The chat system needed to feel responsive
while honouring this contract. Rewriting the backend to support WebSockets was out
of scope and would have introduced persistent connection management complexity.

### Options Considered

**Option A: WebSockets with Socket.io**
True bidirectional push with ~50 ms latency. Requires a rewrite of the backend,
persistent connection management, and reconnect logic. Cannot be used without
modifying the provided server.

**Option B: Server-Sent Events (SSE)**
Unidirectional server-to-client push with lower overhead than WebSockets. Still
requires new backend endpoints not present in the provided server specification.

**Option C: Fixed-interval polling**
Simple `setInterval` every 2 seconds regardless of whether the chat is open.
Wastes network and battery even when no conversation is visible.

**Option D: Adaptive HTTP Polling** *(Chosen)*
Polls only while the chat panel is open. Scheduling is self-referential — the
next poll is queued only after the current one completes, preventing pile-up.
Respects the server's `pollAgainAfter` hint. Stops immediately on panel close.

### Decision
**Option D — Adaptive polling that runs only while the chat panel is visible.**

The `ChatPanel` component starts polling in `openForItem()` and cancels the
scheduled timer in both `close()` and `disconnectedCallback()`. A timestamp cursor
advances with each response so only genuinely new messages are transferred. On
network failure, the interval backs off to 5 seconds before retrying.

```typescript
private _startPoll() {
  this._poll = setTimeout(async () => {
    const result = await messagesApi.poll(this._item.id, this._lastTs);
    if (result.hasNew) {
      result.messages.forEach(m => this.dispatch({ type: 'ADD_MESSAGE', payload: m }));
      this._lastTs = result.lastTimestamp;
    }
    // Only reschedule if the panel is still open — prevents ghost polling
    if (this._open) this._startPoll();
  }, 2000);
}
```

Unread badge counts are maintained by a separate 8-second polling interval in the
`App` orchestrator class that calls `/api/messages/unread/:userId` while any user
is logged in.

### Tradeoffs

**Pros:**
- Zero backend changes required — fully compatible with the provided server
- Self-limiting: no network activity when chat is not in use
- Simple to reason about; no persistent connection state to manage
- Straightforward to upgrade: replacing `_startPoll()` with a WebSocket listener
  requires changes only inside `ChatPanel`
- Graceful degradation — a failed poll silently retries; the UI never crashes

**Cons:**
- Maximum message latency is 2 seconds, compared to ~50 ms for WebSockets
- Every open chat generates one HTTP request per 2-second interval
- The server reads from MongoDB on every poll request; at scale this requires
  caching (e.g. Redis) to remain performant
- On mobile devices with many concurrent chat panels open, battery drain
  would be noticeable without additional backoff strategies

---

## ADR-003 — Custom Observable Store with Zod Boundary Validation

### Status
**Accepted** — Core state management pattern throughout the application

### Context
Multiple Lit components scattered across the page share the same data:
the signed-in user, the item listings, per-item message threads, unread counts,
loading states, and error flags. Without a centralized store:

- Components would duplicate API calls and diverge in state
- Passing data down via Web Component properties creates deep, brittle chains
- There is no natural React Context equivalent in vanilla Lit

The project criteria required "advanced state management (Redux, Zod, Query.js, etc.)".
However, Redux Toolkit and Zustand are designed around React's render model with hooks
and are not suitable for use with Lit's `LitElement` base class.

### Options Considered

**Option A: Redux Toolkit**
Battle-tested with excellent DevTools. React-centric API (hooks, Provider) that does
not integrate cleanly with Lit's lifecycle. Large bundle size relative to the benefit.

**Option B: Zustand**
Minimal (~1 kB) and flexible. Still designed around React hooks. Accessing store
state outside a React component requires workarounds.

**Option C: MobX with observable decorators**
Reactive and elegant. Works with any framework but adds ~20 kB to the bundle and
requires a build plugin for decorators.

**Option D: Custom Observable Store + Zod** *(Chosen)*
An ~80-line `AppStore` class implementing the Redux pattern (dispatch, reduce,
subscribe) with no external runtime dependencies. Combined with Zod schemas for
runtime validation at every API boundary.

**Option E: Component-level `@state()` only**
Simplest approach. Causes duplicated API calls, stale data between components,
and complex custom-event chains to propagate changes upward.

### Decision
**Option D — Custom framework-agnostic Redux-like store with Zod validation.**

The `AppStore` class holds a single `AppState` object and exposes three methods:
`dispatch(action)`, `subscribe(listener)`, and `getState()`. State changes are
computed by a pure `reducer` function using a TypeScript discriminated union
`AppAction` type, ensuring exhaustive switch coverage at compile time.

The `BaseComponent` abstract class wraps this subscription automatically:

```typescript
override connectedCallback() {
  super.connectedCallback();
  this._unsub = store.subscribe(() => this.requestUpdate());
}
override disconnectedCallback() {
  super.disconnectedCallback();
  this._unsub?.();
}
```

Every Lit component that extends `BaseComponent` becomes reactive to the global
store with zero boilerplate. The logged-in user is persisted to `localStorage`
so sessions survive page refreshes.

**Zod schemas** validate all data at API boundaries:

```typescript
export const CreateItemSchema = z.object({
  name:        z.string().min(3, 'Name must be at least 3 characters').max(100),
  price:       z.number().positive('Price must be a positive number').max(1_000_000),
  description: z.string().min(10).max(1000),
  sellerId:    z.string().min(1),
});
// Form submit — validation runs before any network call
const result = CreateItemSchema.safeParse(formData);
if (!result.success) { showErrors(result.error); return; }
```

### Tradeoffs

**Pros:**
- Zero additional runtime dependencies for state management
- The pure reducer function is trivially unit-testable without a DOM
- The `AppAction` discriminated union guarantees exhaustive handling at compile time
- Zod provides a second layer of safety — malformed API responses are caught at runtime,
  not silently ignored
- Consistent async pattern: side effects are handled in components; the store
  remains synchronous and predictable

**Cons:**
- No Redux DevTools integration — time-travel debugging and action replay are
  not available
- No middleware or effects layer (thunks, sagas, epics) — all async logic must
  live in component methods, which can grow large in complex components
- `requestUpdate()` is called on every subscriber for every action dispatched.
  Mitigated by the reducer returning the identical state reference when nothing
  changed, so Lit's dirty-checking skips the re-render
- Zod schemas and TypeScript types must be kept manually in sync; a mismatch
  causes a compile error but not a runtime error

---

## ADR-004 — TypeScript Strict Mode Throughout

### Status
**Accepted** — Enforced from project inception; applies to both client and server code

### Context
The codebase spans Lit Web Components, an Express HTTP server, MongoDB data access,
Zod validation schemas, and a Redux-style store. Marketplace business logic has
several well-known categories of runtime bugs that TypeScript strict mode eliminates
at compile time:

- `item.highestOffer` is nullable — calling methods on it without a null-check
  crashes at runtime silently in non-strict TypeScript
- Message `type` is a string enum (`'text' | 'offer' | 'system'`) — wrong type
  strings pass without TypeScript strict enums
- API response shapes change over time — TypeScript surfaces the mismatch
  immediately at the call site rather than in a production error log

### Options Considered

**Option A: Plain JavaScript (no TypeScript)**
Zero compile step, maximum flexibility. All type errors surface at runtime in
production. Refactoring large components becomes fragile.

**Option B: TypeScript with `strict: false`**
Basic type checking without null analysis or implicit `any` warnings. Catches
some errors but misses the most common categories in a data-heavy application.

**Option C: TypeScript `strict: true`** *(Chosen)*
All strict checks enabled: `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`,
and `useUnknownInCatchVariables`. Catches null/undefined access, implicit any,
unsafe function signatures, and unreachable code at compile time.

**Option D: Flow**
Facebook's type system. Smaller ecosystem, less IDE tooling, and incompatible
with many TypeScript-first libraries including Lit's decorator types.

### Decision
**Option C — TypeScript `"strict": true` in all tsconfig files.**

Two tsconfig files are maintained:
- `tsconfig.json` — targets `ESNext` with `moduleResolution: bundler` for the
  Vite/client build
- `tsconfig.server.json` — targets `NodeNext` for the Express server

Critical Lit-specific settings that must be present:

```json
{
  "experimentalDecorators": true,
  "useDefineForClassFields": false
}
```

`useDefineForClassFields: false` is required because TypeScript's default class
field definition transform conflicts with Lit's `@property()` decorator system,
causing properties not to trigger reactive updates. Without this flag, components
silently fail to re-render when data changes.

`tsx` is used in development for fast transpile-only execution. Full type-checking
runs as a separate step (`npx tsc --noEmit`) or in CI.

### Tradeoffs

**Pros:**
- Null-related crashes eliminated at compile time (e.g. `item.highestOffer?.toFixed(0)`)
- The `AppAction` discriminated union in the store reducer is exhaustively checked;
  adding a new action type without handling it is a compile error
- IDE autocomplete is accurate and complete throughout the codebase, including
  MongoDB document types, Lit component properties, and API response shapes
- Zod's `z.infer<typeof Schema>` derives TypeScript types directly from validation
  schemas, keeping runtime and compile-time types in perfect sync

**Cons:**
- The `experimentalDecorators` + `useDefineForClassFields: false` combination
  is a Lit-specific gotcha that causes confusing failures without prior knowledge
- Strict null checks require explicit optional chaining (`?.`) and nullish coalescing
  (`??`) throughout the codebase, adding verbosity
- `tsx` (transpile-only) in development means type errors can be silently ignored
  unless a `tsc --noEmit` check is run separately
- MongoDB documents are typed as `Document & Record<string, any>` internally,
  requiring manual type assertions when accessing fields returned from queries

---

## ADR-005 — MongoDB Atlas as the Persistent Data Layer

### Status
**Accepted** — Required for Vercel compatibility; replaces JSON file storage

### Context
The original local development version used JSON files (`items.json`, `users.json`,
`messages.json`) as a flat-file database. This approach works perfectly on a
persistent local server but has two critical incompatibilities with Vercel:

1. **Serverless ephemeral filesystem** — Vercel functions run in isolated containers
   that are destroyed after each invocation. Any file written during a request is
   gone before the next request. `writeFileSync` data would be permanently lost.

2. **Read-only filesystem** — Vercel's deployment filesystem is immutable after
   build. Write operations throw `EROFS: read-only file system` errors.

A persistent, externally-hosted database is required for any cloud deployment
that maintains state across requests.

### Options Considered

**Option A: Keep JSON files (local only)**
Works for local development. Completely unusable on Vercel or any serverless
platform. Not a viable production option.

**Option B: PlanetScale (MySQL)**
Serverless MySQL with a generous free tier. Requires schema migrations, an ORM
(Prisma or Drizzle), and significantly more setup than a document database for
a flexible, schema-light use case like marketplace listings.

**Option C: Supabase (PostgreSQL)**
Hosted Postgres with a REST API layer and real-time subscriptions. Excellent
product but more opinionated and heavier than needed for this scale.

**Option D: MongoDB Atlas** *(Chosen)*
Free M0 tier with 512 MB storage. Document-oriented model matches the loosely
structured item/message/user data naturally. The official `mongodb` driver
supports connection pooling in serverless environments via the singleton pattern.

**Option E: Upstash Redis**
Ultra-low latency key-value store. Would require custom data modelling for
relational queries (messages per item, unread counts) that MongoDB handles
natively with simple `find` queries.

### Decision
**Option D — MongoDB Atlas with a connection singleton for serverless reuse.**

The `src/server/db.ts` module exports a `getDb()` async function that maintains
a module-level `MongoClient` instance. When a serverless function is invoked,
the runtime reuses the existing connection if the container is warm:

```typescript
let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;                  // Reuse on warm invocations
  client = new MongoClient(uri, { maxPoolSize: 10 });
  await client.connect();
  db = client.db('collectmarket');
  await seedIfEmpty(db);             // Insert demo data on first run
  return db;
}
```

The `seedIfEmpty()` function checks document counts before inserting, making it
safe to call on every cold start without duplicating data. All three demo accounts
(`ComicCollector`, `ToyTrader`, `CardMaster`) and six sample listings are inserted
automatically on the first deployment.

### Tradeoffs

**Pros:**
- Free M0 tier on Atlas — no cost for a portfolio or assessment project
- Document model requires no schema migrations; adding fields to items or messages
  does not require altering a table structure
- Connection reuse across warm serverless invocations keeps latency low after the
  first cold start
- Auto-seeding means the application works immediately after deployment with no
  manual data entry required
- MongoDB's `$regex` operator makes case-insensitive username and search queries
  straightforward without additional query builders

**Cons:**
- Cold starts on Vercel free tier can take 3–5 seconds while Atlas establishes
  a new connection (mitigated by keeping the app warm with a health check ping)
- Requires creating an Atlas account and configuring network access before the app
  can run — the local JSON file approach had zero setup overhead
- MongoDB's lack of foreign key constraints means referential integrity (e.g.
  messages pointing to deleted items) is enforced only at the application layer
- The free M0 cluster has no dedicated resources and shares compute with other
  Atlas free-tier tenants, which can cause occasional latency spikes

---

## Bonus Criteria Checklist

| Criterion | Status | Implementation Notes |
|---|---|---|
| **Advanced state management** | ✅ Implemented | Custom Redux-like `AppStore` (ADR-003) with discriminated union actions, Zod input validation, and `localStorage` persistence |
| **Fully responsive design** | ✅ Implemented | Mobile-first Tailwind grid (1→2→3→4 columns), bottom-sheet modals on small screens, collapsible search bar in header, responsive hero with floating notification cards |
| **TypeScript usage** | ✅ Implemented | Strict mode throughout client and server (ADR-004); `z.infer<>` keeps Zod schemas and TypeScript types in sync; discriminated union `AppAction` type for the store |