import type { AppState, AppAction, Item, Message, User, Listener } from '../types/index.js';

// ─────────────────────────────────────────────
//  Reducer
// ─────────────────────────────────────────────

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };

    case 'SET_ITEMS':
      return { ...state, items: action.payload };

    case 'ADD_ITEM':
      return { ...state, items: [action.payload, ...state.items] };

    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(i => i.id === action.payload.id ? action.payload : i),
      };

    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.id !== action.payload) };

    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_ACTIVE_ITEM':
      return { ...state, activeItemId: action.payload };

    case 'SET_MESSAGES':
      return {
        ...state,
        messages: { ...state.messages, [action.payload.itemId]: action.payload.messages },
      };

    case 'ADD_MESSAGE': {
      const existing = state.messages[action.payload.itemId] ?? [];
      // Deduplicate by id
      if (existing.find(m => m.id === action.payload.id)) return state;
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.itemId]: [...existing, action.payload],
        },
      };
    }

    case 'UPDATE_MESSAGE': {
      const msgs = state.messages[action.payload.itemId] ?? [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.itemId]: msgs.map(m =>
            m.id === action.payload.id ? action.payload : m
          ),
        },
      };
    }

    case 'SET_UNREAD':
      return { ...state, unreadCounts: action.payload };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────
//  Store (Observable Redux-like)
// ─────────────────────────────────────────────

class AppStore {
  private state: AppState;
  private listeners: Set<Listener> = new Set();
  private persistKey = 'marketplace_user';

  constructor() {
    const savedUser = this.loadUser();
    this.state = {
      user: savedUser,
      items: [],
      searchQuery: '',
      isLoading: false,
      error: null,
      activeItemId: null,
      messages: {},
      unreadCounts: {},
    };
  }

  getState(): Readonly<AppState> {
    return this.state;
  }

  dispatch(action: AppAction): void {
    const prev = this.state;
    this.state = reducer(this.state, action);

    // Persist user changes
    if (action.type === 'SET_USER') {
      if (action.payload) {
        localStorage.setItem(this.persistKey, JSON.stringify(action.payload));
      } else {
        localStorage.removeItem(this.persistKey);
      }
    }

    if (prev !== this.state) {
      this.listeners.forEach(l => l());
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(this.persistKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // Selectors
  select<T>(selector: (s: AppState) => T): T {
    return selector(this.state);
  }

  get user() { return this.state.user; }
  get items() { return this.state.items; }
  get isLoading() { return this.state.isLoading; }
  get error() { return this.state.error; }
  getMessages(itemId: string) { return this.state.messages[itemId] ?? []; }
  getUnreadCount(itemId: string) { return this.state.unreadCounts[itemId] ?? 0; }
}

// Singleton export
export const store = new AppStore();
export type { AppStore };
